/**
 * What the Href Links pages read (audit, 10 October 2026).
 *
 * Every read is the server's own (the tables are closed to sessions, migration
 * 107), after the page or action decided who may see it; a page is always read
 * together with its site, so one site's page never opens under the other's
 * address. Reads go a page at a time (page_urls already passed the 1,000 rows
 * one read returns) and a failed read throws: it used to read as "No pages
 * yet" or as zeros.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LANGUAGES, isPageDone, type SiteCode } from './rules'

export interface SiteRow {
  id: string
  code: SiteCode
  name: string
  domain: string | null
  languages: string[]
  wp_dev_url: string | null
  wp_live_url: string | null
  monday_board_id: string | null
}

export interface PageListRow {
  id: string
  name: string
  langStatus: Record<string, { hasUrl: boolean; confirmed: boolean }>
  /** Flagged after a language config change or a changed link: the hreflang may be stale. */
  needsUpdate?: boolean
  /** Intentional opt-out: counts as done in progress; shown faded in the list. */
  notRelevant?: boolean
  /** ISO timestamp: first date every language went live. History only. */
  confirmedDoneAt?: string | null
  /** Done by the one rule (rules.ts): every current language live, or Not relevant. */
  done: boolean
}

export interface ActivityRow {
  id: string
  received_at: string
  monday_item_id: string | null
  page_name: string | null
  result: string | null
}

// The typed client infers the row (embeds included) from PAGE_SELECT, a
// literal; reads assign to PageDbRow without a cast, so a select that drifts
// from this shape fails the build instead of the page (audit, 13 October 2026).
type PageDbRow = {
  id: string; name: string; needs_hreflang_update: boolean | null; confirmed_done_at: string | null
  not_relevant: boolean | null
  page_urls: { language_code: string; url: string }[]
  confirmations: { language_code: string; confirmed_on_live: boolean | null }[]
}

const PAGE_SELECT = 'id, name, needs_hreflang_update, confirmed_done_at, not_relevant, page_urls(language_code, url), confirmations(language_code, confirmed_on_live)'

function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`Href Links could not read ${what}: ${error.message}`)
}

export async function loadSite(code: SiteCode): Promise<SiteRow> {
  const { data, error } = await createAdminClient().from('sites')
    .select('id, code, name, domain, languages, wp_dev_url, wp_live_url, monday_board_id')
    .eq('code', code).maybeSingle()
  failed('the site', error)
  if (!data) throw new Error(`Href Links has no site "${code}"`)
  const s = data as unknown as SiteRow
  return { ...s, languages: s.languages?.length ? s.languages : DEFAULT_LANGUAGES[code] }
}

function toListRow(p: PageDbRow, siteLanguages: string[]): PageListRow {
  const urls = new Set(p.page_urls.map(u => u.language_code))
  const confirmed = new Set(p.confirmations.filter(c => c.confirmed_on_live).map(c => c.language_code))
  const langStatus: PageListRow['langStatus'] = {}
  for (const lang of siteLanguages) langStatus[lang] = { hasUrl: urls.has(lang), confirmed: confirmed.has(lang) }
  const notRelevant = p.not_relevant ?? false
  return {
    id: p.id,
    name: p.name,
    langStatus,
    needsUpdate: p.needs_hreflang_update ?? undefined,
    confirmedDoneAt: p.confirmed_done_at,
    notRelevant,
    done: isPageDone({ notRelevant, confirmed }, siteLanguages),
  }
}

async function pagesOf(siteId: string): Promise<PageDbRow[]> {
  const out: PageDbRow[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await createAdminClient().from('pages').select(PAGE_SELECT)
      .eq('site_id', siteId).order('id').range(from, from + 499)
    failed('the pages', error)
    const page: PageDbRow[] = data ?? []
    out.push(...page)
    if ((data ?? []).length < 500) break
  }
  return out
}

export async function getSitePageData(code: SiteCode): Promise<{
  site: SiteRow; rows: PageListRow[]; done: number; activity: ActivityRow[]
}> {
  const site = await loadSite(code)
  const [pages, activity] = await Promise.all([pagesOf(site.id), getRecentActivity(site.monday_board_id)])
  const rows = pages.map(p => toListRow(p, site.languages))
  return { site, rows, done: rows.filter(r => r.done).length, activity }
}

/** One page of this site, or null when there is none (including one of the other site). */
export async function loadSitePage(site: SiteRow, id: string): Promise<(PageListRow & {
  savedUrls: { language_code: string; url: string }[]
  confirmations: { language_code: string; confirmed_on_live: boolean }[]
}) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await createAdminClient().from('pages').select(PAGE_SELECT)
    .eq('id', id).eq('site_id', site.id).maybeSingle()
  failed('the page', error)
  if (!data) return null
  const p: PageDbRow = data
  return {
    ...toListRow(p, site.languages),
    savedUrls: p.page_urls,
    confirmations: p.confirmations.map(c => ({ language_code: c.language_code, confirmed_on_live: c.confirmed_on_live ?? false })),
  }
}

/**
 * The site's recent Monday activity, failures included, for the feed on its
 * page (decided 10 October 2026: show it, so the SEO team sees a Run Link that
 * failed). The webhook prefixes each result with the door it came in by
 * ("secret-url · "), which the feed's filter and wording did not expect.
 */
export async function getRecentActivity(boardId: string | null, limit = 20): Promise<ActivityRow[]> {
  if (!boardId) return []
  const db = createAdminClient()
  const { data: events, error } = await db.from('monday_events')
    .select('id, received_at, monday_item_id, result')
    .eq('board_id', boardId)
    .not('result', 'like', '%skipped:column %')
    .not('result', 'is', null)
    .order('received_at', { ascending: false })
    .limit(limit)
  failed('the activity', error)
  const rows = (events ?? []) as { id: string; received_at: string; monday_item_id: string | null; result: string | null }[]
  if (!rows.length) return []

  const itemIds = [...new Set(rows.map(r => r.monday_item_id).filter((x): x is string => !!x))]
  const nameByItem = new Map<string, string>()
  if (itemIds.length) {
    const { data: joins, error: joinErr } = await db.from('page_urls').select('monday_item_id, pages(name)').in('monday_item_id', itemIds)
    failed('the page names', joinErr)
    for (const j of (joins ?? []) as unknown as { monday_item_id: string | null; pages: { name: string } | null }[]) {
      if (j.monday_item_id && j.pages?.name) nameByItem.set(j.monday_item_id, j.pages.name)
    }
  }
  return rows.map(r => ({
    id: r.id,
    received_at: r.received_at,
    monday_item_id: r.monday_item_id,
    page_name: r.monday_item_id ? nameByItem.get(r.monday_item_id) ?? null : null,
    result: (r.result ?? '').replace(/^(secret-url|legacy-url) · /, '') || null,
  }))
}

export interface ProjectStats { recentCompletions: number; totalDone: number; remaining: number }

export interface ProjectsOverview {
  /** Ready to apply: every language has a URL, not set aside, not yet done. */
  readyBySite: Record<string, { id: string; name: string }[]>
  totalReady: number
  statsBySite: Record<string, ProjectStats>
  /** Each site's current languages and domain, from Settings rather than written into the page. */
  sites: Record<string, { languages: string[]; domain: string | null }>
}

export async function getProjectsOverview(): Promise<ProjectsOverview> {
  const db = createAdminClient()
  const { data: siteRows, error } = await db.from('sites').select('id, code, languages, domain')
  failed('the sites', error)
  const sitesList = ((siteRows ?? []) as { id: string; code: string; languages: string[] | null; domain: string | null }[])

  const twoWeeksAgo = Date.now() - 14 * 86_400_000
  const readyBySite: ProjectsOverview['readyBySite'] = {}
  const statsBySite: ProjectsOverview['statsBySite'] = {}
  const sites: ProjectsOverview['sites'] = {}

  for (const s of sitesList) {
    const code = s.code as SiteCode
    const languages = s.languages?.length ? s.languages : DEFAULT_LANGUAGES[code] ?? []
    sites[code] = { languages, domain: s.domain }
    const stats: ProjectStats = { recentCompletions: 0, totalDone: 0, remaining: 0 }
    const ready: { id: string; name: string }[] = []
    for (const p of await pagesOf(s.id)) {
      const row = toListRow(p, languages)
      if (row.done) stats.totalDone++
      else stats.remaining++
      if (p.confirmed_done_at && Date.parse(p.confirmed_done_at) >= twoWeeksAgo) stats.recentCompletions++
      const allUrls = languages.every(l => row.langStatus[l]?.hasUrl)
      if (!row.notRelevant && allUrls && !row.done) ready.push({ id: p.id, name: p.name })
    }
    statsBySite[code] = stats
    readyBySite[code] = ready
  }

  const totalReady = Object.values(readyBySite).reduce((n, list) => n + list.length, 0)
  return { readyBySite, totalReady, statsBySite, sites }
}
