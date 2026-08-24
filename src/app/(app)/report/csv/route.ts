/**
 * GET /report/csv?tab=&scope=&period=&team=
 *
 * The rows behind whatever the Report is showing, as a file.
 *
 * The parameters are resolved exactly as the page resolves them, through the
 * same functions: a level 1 person who edits ?scope=everyone gets their own
 * work here too, and a tab their level cannot see falls back to Overview. An
 * export that answered the URL more literally than the page would be a way
 * around the permissions rather than a copy of what is on screen.
 *
 * Auth: the proxy requires a session, my-work gates the surface, and
 * report-export gates the file, which is the same grant the Time report uses.
 */

import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { resolveTab } from '@/components/report/ReportTabs'
import { resolvePeriod, resolveScope, SCOPE_LABEL } from '@/lib/report/scope'
import { loadReportOverview } from '@/lib/report/data'
import { loadReportPeople } from '@/lib/report/people'
import { loadWaits } from '@/lib/report/waits'
import { loadWorkload } from '@/lib/report/workload-data'
import { exportName, overviewCsv, peopleCsv, toFile, waitsCsv, workloadCsv } from '@/lib/report/csv'
import { loadMethod } from '@/lib/report/method'
import { readRecording } from '@/lib/report/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  await requireSurface('report')

  const access = await loadAccess()
  if (!access.can('report-export')) {
    return new Response('Not allowed to export the Report.', {
      status: 403, headers: { 'Content-Type': 'text/plain' },
    })
  }

  const level = directoryLevel(access.can)
  const url = new URL(request.url)
  const tab = resolveTab(url.searchParams.get('tab') ?? undefined, level)
  const scope = resolveScope(url.searchParams.get('scope') ?? undefined, level)
  const period = resolvePeriod(url.searchParams.get('period') ?? undefined)
  const team = url.searchParams.get('team') || null

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)

  const filters = scope === 'me' ? { personId: me?.id ?? null } : { teamId: team }

  let lines: string[]
  if (tab === 'people') {
    lines = peopleCsv(await loadReportPeople(supabase, { ...filters, period }))
  } else if (tab === 'workload') {
    lines = workloadCsv((await loadWorkload(supabase, { ...filters, period })).people)
  } else if (tab === 'waits') {
    const { steps, stuck } = await loadWaits(supabase, { ...filters, period })
    lines = waitsCsv(steps, stuck)
  } else if (tab === 'method') {
    const { sources } = await loadMethod(supabase, await readRecording(supabase))
    lines = ['Source,State,Cadence,What it carries',
      ...sources.map(s => [s.name, s.state, s.cadence, s.what].map(v =>
        /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(','))]
  } else {
    lines = overviewCsv((await loadReportOverview(supabase, { ...filters, period })).overview)
  }

  const name = `${exportName(tab, SCOPE_LABEL[scope], period)}.csv`
  // HTTP headers are Latin-1, so an accented name needs an ASCII fallback
  // alongside the RFC 5987 form that carries the real one.
  const ascii = name.replace(/[^\x20-\x7e]/g, '-')

  return new Response(toFile(lines), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
