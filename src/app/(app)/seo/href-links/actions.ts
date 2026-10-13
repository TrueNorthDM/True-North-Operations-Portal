'use server'

// The Href Links page actions: delete, Not relevant, save the links, confirm a
// language live (moved out of src/app/actions.ts, audit, 10 October 2026).
//
// Each one finds the page's site from the page itself, never from the caller,
// and refuses unless the person has Href Links. Both sites are open to
// everyone with the tool (decided 13 October 2026). The tables are the
// server's own (migration 107). A step that fails is said, not answered "ok",
// and the database's wording stays in the server log.

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hrefLinksPage, hrefLinksSite, ROUTES } from '@/lib/nav/routes'
import { checkPageUrl, DEFAULT_LANGUAGES, isSiteCode, type SiteCode } from '@/lib/href-links/rules'
import type { LanguageCode } from '@/lib/types/database.types'

type Result = { ok: boolean; error?: string }
type Db = ReturnType<typeof createAdminClient>

interface PageCtx {
  db: Db
  page: { id: string; name: string; confirmed_done_at: string | null }
  site: { id: string; code: SiteCode; languages: string[]; domain: string | null; monday_board_id: string | null }
}

const NOT_SAVED = 'Not saved. Try again in a moment.'

function notSaved(error: { message: string }): { ok: false; error: string } {
  console.error('[href links]', error.message)
  return { ok: false, error: NOT_SAVED }
}

/** The page, its site, and whether this person may change it. */
async function pageGate(pageId: string): Promise<PageCtx | { ok: false; error: string }> {
  if (!(await allowedTo('href-links'))) return { ok: false, error: 'Href Links is not open to your access.' }
  if (typeof pageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(pageId)) return { ok: false, error: 'That page does not exist.' }
  const db = createAdminClient()
  const { data, error } = await db.from('pages')
    .select('id, name, confirmed_done_at, sites(id, code, languages, domain, monday_board_id)')
    .eq('id', pageId).maybeSingle()
  if (error) return notSaved(error)
  const row = data as unknown as (PageCtx['page'] & { sites: PageCtx['site'] | null }) | null
  if (!row?.sites || !isSiteCode(row.sites.code)) return { ok: false, error: 'That page does not exist.' }
  const site = { ...row.sites, languages: row.sites.languages?.length ? row.sites.languages : DEFAULT_LANGUAGES[row.sites.code] }
  return { db, page: { id: row.id, name: row.name, confirmed_done_at: row.confirmed_done_at }, site }
}

const refresh = (code: SiteCode, pageId?: string) => {
  revalidatePath(hrefLinksSite(code))
  if (pageId) revalidatePath(hrefLinksPage(code, pageId))
  revalidatePath(ROUTES.hrefLinks)
}

/**
 * Deletes the page and its links and confirmations (cascade). Only the local
 * copy: Run Link in Monday creates it again. Logged to the activity feed under
 * the person who deleted it.
 */
export async function deletePage(input: { pageId: string }): Promise<Result> {
  const g = await pageGate(input.pageId)
  if (!('db' in g)) return g
  const { data: { user } } = await (await createClient()).auth.getUser()

  const { error } = await g.db.from('pages').delete().eq('id', g.page.id)
  if (error) return notSaved(error)

  const { error: logErr } = await g.db.from('monday_events').insert({
    event_type: 'system.page_deleted',
    board_id: g.site.monday_board_id,
    monday_item_id: null,
    column_id: null,
    result: `ok:deleted "${g.page.name}" by ${user?.email ?? 'unknown'}`,
    processed_at: new Date().toISOString(),
  })
  // The page is gone either way; a missing feed line is said in the log.
  if (logErr) console.error('[href links] the delete was not added to the activity feed:', logErr.message)

  refresh(g.site.code)
  return { ok: true }
}

/** Not relevant: out of scope on purpose, so it counts as done. */
export async function setPageNotRelevant(input: { pageId: string; value: boolean }): Promise<Result> {
  const g = await pageGate(input.pageId)
  if (!('db' in g)) return g
  const { error } = await g.db.from('pages').update({ not_relevant: input.value === true }).eq('id', g.page.id)
  if (error) return notSaved(error)
  refresh(g.site.code, g.page.id)
  return { ok: true }
}

/**
 * Saves a page's links, one per language; an empty field removes that one.
 *
 * Each link must be https and a page on the site's own domain (decided
 * 10 October 2026); the bare domain is written with "www". One link refused
 * means nothing is saved, and the answer names which and why.
 *
 * A changed link on a language already confirmed live takes that
 * confirmation away and flags the page: WordPress still carries the old tags
 * (decided 10 October 2026). Otherwise saving clears a pending flag.
 */
export async function savePageUrls(input: {
  pageId: string
  urls: { language_code: string; url: string }[]
}): Promise<Result & { rejected?: { language_code: string; reason: string }[] }> {
  const g = await pageGate(input.pageId)
  if (!('db' in g)) return g
  const list = Array.isArray(input.urls) ? input.urls : []

  const toUpsert: { page_id: string; language_code: LanguageCode; url: string }[] = []
  const toDelete: string[] = []
  const rejected: { language_code: string; reason: string }[] = []
  for (const u of list) {
    const lang = String(u?.language_code ?? '')
    if (!g.site.languages.includes(lang)) { rejected.push({ language_code: lang, reason: 'This site does not publish in that language.' }); continue }
    const raw = String(u?.url ?? '').trim()
    if (raw === '') { toDelete.push(lang); continue }
    const check = checkPageUrl(raw, g.site.domain)
    if (!check.ok) { rejected.push({ language_code: lang, reason: check.reason }); continue }
    toUpsert.push({ page_id: g.page.id, language_code: lang as LanguageCode, url: check.url })
  }
  if (rejected.length) {
    return { ok: false, error: 'Nothing was saved: fix the links marked below.', rejected }
  }

  // What is there now, to see which live languages get a different link.
  const [{ data: before, error: beforeErr }, { data: confs, error: confErr }] = await Promise.all([
    g.db.from('page_urls').select('language_code, url').eq('page_id', g.page.id),
    g.db.from('confirmations').select('language_code, confirmed_on_live').eq('page_id', g.page.id),
  ])
  if (beforeErr || confErr) return notSaved((beforeErr ?? confErr)!)
  const was = new Map(((before ?? []) as { language_code: string; url: string }[]).map(r => [r.language_code, r.url]))
  const live = new Set(((confs ?? []) as { language_code: string; confirmed_on_live: boolean | null }[])
    .filter(c => c.confirmed_on_live).map(c => c.language_code))
  const changedLive = [
    ...toUpsert.filter(u => live.has(u.language_code) && was.has(u.language_code) && was.get(u.language_code) !== u.url).map(u => u.language_code as string),
    ...toDelete.filter(l => live.has(l) && was.has(l)),
  ]

  if (toUpsert.length) {
    const { error } = await g.db.from('page_urls').upsert(toUpsert, { onConflict: 'page_id,language_code' })
    if (error) return notSaved(error)
  }
  if (toDelete.length) {
    const { error } = await g.db.from('page_urls').delete().eq('page_id', g.page.id).in('language_code', toDelete as LanguageCode[])
    if (error) return notSaved(error)
  }
  if (changedLive.length) {
    const { error } = await g.db.from('confirmations').update({ confirmed_on_live: false, confirmed_at: null })
      .eq('page_id', g.page.id).in('language_code', changedLive as LanguageCode[])
    if (error) return notSaved(error)
  }
  const { error: flagErr } = await g.db.from('pages').update({ needs_hreflang_update: changedLive.length > 0 }).eq('id', g.page.id)
  if (flagErr) return notSaved(flagErr)

  refresh(g.site.code, g.page.id)
  return { ok: true }
}

/**
 * Confirms (or un-confirms) one language live on WordPress.
 *   1. Only with a saved link: tags that were never generated cannot be live.
 *   2. confirmed_at is stamped when it goes live and cleared when it does not.
 *   3. The first time every current language is live, the page's
 *      confirmed_done_at is stamped, once, even with two people confirming at
 *      the same moment. It is history: never cleared.
 */
export async function toggleConfirmation(input: { pageId: string; languageCode: string; value: boolean }): Promise<Result> {
  const g = await pageGate(input.pageId)
  if (!('db' in g)) return g
  const lang = String(input.languageCode ?? '')
  if (!g.site.languages.includes(lang)) return { ok: false, error: 'This site does not publish in that language.' }
  const value = input.value === true

  if (value) {
    const { data: urlRow, error } = await g.db.from('page_urls').select('id')
      .eq('page_id', g.page.id).eq('language_code', lang as LanguageCode).maybeSingle()
    if (error) return notSaved(error)
    if (!urlRow) return { ok: false, error: 'Enter the link first.' }
  }

  const nowIso = new Date().toISOString()
  const { error } = await g.db.from('confirmations').upsert({
    page_id: g.page.id,
    language_code: lang as LanguageCode,
    confirmed_on_live: value,
    confirmed_at: value ? nowIso : null,
  }, { onConflict: 'page_id,language_code' })
  if (error) return notSaved(error)

  if (value) {
    const stamped = await stampDoneOnce(g.db, g.page.id, g.site.languages, nowIso)
    if (stamped) return stamped
  }

  refresh(g.site.code, g.page.id)
  return { ok: true }
}

/** Stamps confirmed_done_at when every language is live and it is not set yet. Null when fine. */
async function stampDoneOnce(db: Db, pageId: string, languages: string[], nowIso: string): Promise<Result | null> {
  const { data: confs, error } = await db.from('confirmations').select('language_code, confirmed_on_live').eq('page_id', pageId)
  if (error) return notSaved(error)
  const liveSet = new Set(((confs ?? []) as { language_code: string; confirmed_on_live: boolean | null }[])
    .filter(c => c.confirmed_on_live).map(c => c.language_code))
  if (!languages.length || !languages.every(l => liveSet.has(l))) return null
  // Only where still empty: of two at once, one stamps and the other does nothing.
  const { error: updErr } = await db.from('pages').update({ confirmed_done_at: nowIso }).eq('id', pageId).is('confirmed_done_at', null)
  return updErr ? notSaved(updErr) : null
}
