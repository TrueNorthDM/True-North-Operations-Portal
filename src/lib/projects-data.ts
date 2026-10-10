// Data layer for the Projects overview page, access filtering, stale-page
// grouping, and per-site progress stats. Kept out of the page component so the
// page stays presentational (audit M6/DT-07).

import { createClient } from '@/lib/supabase/server'
import { getAccessibleSiteIds } from '@/lib/auth/access'

export interface ProjectStats {
  /** Pages shipped in the trailing 14 days (confirmed_done_at within window). */
  recentCompletions: number
  /** Pages we consider "done" overall, fully live OR explicitly set aside. */
  totalDone: number
  /** Pages still pending work. */
  remaining: number
}

// Fallback language sets when a site row has none configured yet.
const DEFAULT_LANGUAGES: Record<string, string[]> = {
  aaaf: ['en', 'pt', 'es', 'sw'],
  hfa: ['en', 'sw'],
}

export interface ProjectsOverview {
  /** Site codes the user can reach, or null when access can't be evaluated (fail open). */
  accessibleCodes: Set<string>
  /**
   * Pages that are **ready to apply**: every site language already has a URL,
   * the page isn't set aside (not_relevant), and it isn't fully live yet, so
   * SEO 2 can generate + paste the hreflang and confirm it. Grouped by site.
   */
  readyBySite: Record<string, { id: string; name: string }[]>
  totalReady: number
  statsBySite: Record<string, ProjectStats>
}

export async function getProjectsOverview(): Promise<ProjectsOverview> {
  const supabase = await createClient()

  // Access enforcement: only reachable projects. Admins + ungranted
  // (unrestricted) projects pass; null = couldn't evaluate → fail closed.
  const [{ data: siteRows }, accessibleIds] = await Promise.all([
    supabase.from('sites').select('id, code'),
    getAccessibleSiteIds(),
  ])
  // null means the check itself failed, so nothing is treated as reachable.
  const accessibleCodes = new Set(
    accessibleIds === null ? [] : (siteRows ?? []).filter(s => accessibleIds.has(s.id)).map(s => s.code),
  )

  // One pass over pages with their URLs + confirmations. From it we derive both
  // the per-site progress stats AND the "ready to apply" notification list.
  //
  // A plain embed and a page at a time (audit, 10 October 2026): the query had
  // "sites!inner", which the server's proxy has refused since the move on 5
  // October, and with the error ignored both cards showed 0 done, 0 remaining
  // and never a page ready to apply. A failed read now stops the page.
  type Row = {
    id: string; name: string; confirmed_done_at: string | null; not_relevant: boolean | null
    sites: { code: string; languages: string[] | null } | null
    page_urls: { language_code: string }[]
    confirmations: { language_code: string; confirmed_on_live: boolean }[]
  }
  const pageRows: Row[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from('pages')
      .select('id, name, confirmed_done_at, not_relevant, sites(code, languages), page_urls(language_code), confirmations(language_code, confirmed_on_live)')
      .order('id').range(from, from + 499)
    if (error) throw new Error(`The Href Links overview could not read the pages: ${error.message}`)
    pageRows.push(...((data ?? []) as unknown as Row[]))
    if ((data ?? []).length < 500) break
  }

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS)

  const readyBySite: Record<string, { id: string; name: string }[]> = { aaaf: [], hfa: [] }
  const statsBySite: Record<string, ProjectStats> = {
    aaaf: { recentCompletions: 0, totalDone: 0, remaining: 0 },
    hfa: { recentCompletions: 0, totalDone: 0, remaining: 0 },
  }

  for (const p of pageRows) {
    if (!p.sites) continue
    const code = p.sites.code
    const stats = statsBySite[code]
    if (!stats) continue

    // Progress stats (unchanged): done = confirmed live OR set aside.
    const isDone = p.confirmed_done_at != null || p.not_relevant === true
    if (isDone) stats.totalDone++
    else stats.remaining++
    if (p.confirmed_done_at && new Date(p.confirmed_done_at) >= twoWeeksAgo) {
      stats.recentCompletions++
    }

    // Ready to apply: all languages have a URL, not set aside, not yet all live.
    const langs = (p.sites.languages as string[] | null) ?? DEFAULT_LANGUAGES[code] ?? []
    const urls = new Set((p.page_urls as { language_code: string }[]).map(u => u.language_code))
    const liveConfirmed = new Set(
      (p.confirmations as { language_code: string; confirmed_on_live: boolean }[])
        .filter(c => c.confirmed_on_live)
        .map(c => c.language_code),
    )
    const allUrlsReady = langs.length > 0 && langs.every(l => urls.has(l))
    const allLive = langs.every(l => liveConfirmed.has(l))
    if (!p.not_relevant && allUrlsReady && !allLive && readyBySite[code]) {
      readyBySite[code].push({ id: p.id, name: p.name })
    }
  }

  const totalReady = Object.values(readyBySite).reduce((n, list) => n + list.length, 0)

  return { accessibleCodes, readyBySite, totalReady, statsBySite }
}
