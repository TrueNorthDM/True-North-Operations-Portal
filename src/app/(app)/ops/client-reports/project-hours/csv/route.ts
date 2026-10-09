/**
 * GET /ops/client-reports/project-hours/csv?from=YYYY-MM&to=YYYY-MM&type=client|internal
 *
 * Project Hours & Others as a spreadsheet, in the two shapes the report itself
 * has:
 *   internal → the People tab: one row per project per person, with hours.
 *              Names, so it does not leave the building.
 *   client   → the Costs tab: one row per project, with the balance, the money
 *              and the year to date, plus the unrestricted fund and a total.
 *
 * `?month=` still works and means a range of one.
 *
 * Every row carries the period, for the reason the i7 export learned the hard
 * way: a file whose only mention of a period is its name loses it the moment
 * somebody opens it or pastes the rows into a sheet of their own.
 *
 * Auth: the proxy requires a session, and this then asks for the same tool
 * grant the report itself does, since it carries the same figures.
 */

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { projectsExportKeys } from '@/lib/tsheets/export-keys'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectTracking } from '@/lib/timeclock/projects'
import { peopleView } from '@/lib/timeclock/project-people'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { resolveRange, spanWording } from '@/lib/tsheets/range'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const round2 = (n: number) => Math.round(n * 100) / 100
/** Blank stays blank. A null donation is "nobody has said", not zero. */
const cash = (n: number | null | undefined) => (n == null ? '' : round2(n).toFixed(2))
const hrs = (n: number | null | undefined) => (n == null ? '' : round2(n).toFixed(2))

function cell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(cell).join(',')

export async function GET(request: Request) {
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect(await previewHref('/'))
  const q = new URL(request.url).searchParams
  // An export: the Export tick, and the items whose figures this file carries.
  if (!projectsExportKeys(q.get('type') === 'internal' ? 'internal' : 'client').every(k => access.can(k))) redirect(await previewHref('/'))
  const legacy = q.get('month') ?? undefined
  const months = availableMonths(new Date())
  const newest = months.includes(currentYearMonth()) ? currentYearMonth() : months[0]
  const range = resolveRange(q.get('from') ?? legacy, q.get('to') ?? legacy, newest)
  const type = q.get('type') === 'internal' ? 'internal' : 'client'

  let data: Awaited<ReturnType<typeof loadProjectTracking>>
  try {
    data = await loadProjectTracking(createAdminClient(), range.from, range.to)
  } catch {
    return new Response('Could not load the report.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  const label = spanWording(range.from, range.to)
  const year = range.to.slice(0, 4)
  const lastYear = String(Number(year) - 1)
  const lines: string[] = []

  if (type === 'internal') {
    lines.push(row(['Period', 'Project', 'Person', 'Hours']))
    for (const r of data.rows) {
      // Alphabetical, the order the report's own columns are in.
      for (const person of [...Object.keys(r.byPerson)].sort((a, b) => a.localeCompare(b))) {
        const h = r.byPerson[person]
        if (!h) continue
        lines.push(row([label, r.name, person, hrs(h)]))
      }
    }
    // i7 and MME are not by person (September 2026), so the total is of the four.
    lines.push(row([label, 'TOTAL', '', hrs(peopleView(data).workedThisMonth)]))
  } else {
    // The client file: hours, prepaid balance and what came in. No costs, no
    // margin, and no i7 or MME rows, whose figures are what was invoiced
    // (decided 9 October 2026). Costs are in the month by month export.
    const shown = data.rows.filter(r => !r.billed)
    lines.push(row([
      'Period', 'Project', 'Carried in', 'Prepaid', 'Remaining', 'Hours', 'Donations (USD)',
      `Total hours ${year}`, `Total donations ${year} (USD)`, `${lastYear} hours, same period`,
    ]))
    for (const r of shown) {
      lines.push(row([
        label, r.name, hrs(r.carriedIn), hrs(r.boughtThisMonth), hrs(r.remaining),
        hrs(r.workedThisMonth), cash(r.donationsThisMonth), hrs(r.yearToDate), cash(r.donationsYtd),
        hrs(r.sameMonthLastYear),
      ]))
    }
    const total = (pick: (r: typeof shown[number]) => number | null) => shown.reduce((s, r) => s + (pick(r) ?? 0), 0)
    const givenNow = shown.map(r => r.donationsThisMonth).filter((n): n is number => n != null)
    const givenYtd = shown.map(r => r.donationsYtd).filter((n): n is number => n != null)

    lines.push(row([
      label, 'TOTAL', '', '', hrs(total(r => r.remaining)),
      hrs(total(r => r.workedThisMonth)),
      givenNow.length ? cash(givenNow.reduce((s, n) => s + n, 0)) : '',
      hrs(total(r => r.yearToDate)),
      givenYtd.length ? cash(givenYtd.reduce((s, n) => s + n, 0)) : '',
      hrs(total(r => r.sameMonthLastYear)),
    ]))
  }

  // BOM so Excel reads UTF-8 correctly.
  const csv = '﻿' + lines.join('\r\n') + '\r\n'
  const name = `Project Hours ${type === 'internal' ? 'by Person' : 'and Others'} - ${label}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '-')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
