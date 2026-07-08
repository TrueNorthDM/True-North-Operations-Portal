// Data layer for the Projects overview page — access filtering, stale-page
// grouping, and per-site progress stats. Kept out of the page component so the
// page stays presentational (audit M6/DT-07).

import { createClient } from '@/lib/supabase/server'
import { getAccessibleSiteIds } from '@/lib/auth/access'

export interface ProjectStats {
  /** Pages shipped in the trailing 14 days (confirmed_done_at within window). */
  recentCompletions: number
  /** Pages we consider "done" overall — fully live OR explicitly set aside. */
  totalDone: number
  /** Pages still pending work. */
  remaining: number
}

export interface ProjectsOverview {
  /** Site codes the user can reach, or null when access can't be evaluated (fail open). */
  accessibleCodes: Set<string> | null
  /** Pages flagged for an hreflang update, grouped by site code. */
  staleBySite: Record<string, { id: string; name: string }[]>
  totalStale: number
  statsBySite: Record<string, ProjectStats>
}

export async function getProjectsOverview(): Promise<ProjectsOverview> {
  const supabase = await createClient()

  // Access enforcement: only reachable projects. Admins + ungranted
  // (unrestricted) projects pass; null = couldn't evaluate → fail open.
  const [{ data: siteRows }, accessibleIds] = await Promise.all([
    supabase.from('sites').select('id, code'),
    getAccessibleSiteIds(),
  ])
  const accessibleCodes =
    accessibleIds === null
      ? null
      : new Set((siteRows ?? []).filter(s => accessibleIds.has(s.id)).map(s => s.code))

  const { data: stalePages } = await supabase
    .from('pages')
    .select('id, name, site_id, sites!inner(code, name)')
    .eq('needs_hreflang_update', true)
  const staleBySite: Record<string, { id: string; name: string }[]> = { aaaf: [], hfa: [] }
  for (const p of stalePages ?? []) {
    const code = p.sites.code
    if (staleBySite[code]) staleBySite[code].push({ id: p.id, name: p.name })
  }
  const totalStale = (stalePages ?? []).length

  // Per-site stats — one query, aggregated in JS (cheaper than 6 COUNT(*)s).
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS)
  const { data: allPages } = await supabase
    .from('pages')
    .select('confirmed_done_at, not_relevant, sites!inner(code)')
  const statsBySite: Record<string, ProjectStats> = {
    aaaf: { recentCompletions: 0, totalDone: 0, remaining: 0 },
    hfa: { recentCompletions: 0, totalDone: 0, remaining: 0 },
  }
  for (const p of allPages ?? []) {
    const code = p.sites.code
    const s = statsBySite[code]
    if (!s) continue
    const isDone = p.confirmed_done_at != null || p.not_relevant === true
    if (isDone) s.totalDone++
    else s.remaining++
    // "Recent" = confirmed live in last 14 days. Not-relevant pages don't count.
    if (p.confirmed_done_at && new Date(p.confirmed_done_at) >= twoWeeksAgo) {
      s.recentCompletions++
    }
  }

  return { accessibleCodes, staleBySite, totalStale, statsBySite }
}
