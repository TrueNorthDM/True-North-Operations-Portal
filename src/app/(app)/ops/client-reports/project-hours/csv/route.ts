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
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectTracking } from '@/lib/timeclock/projects'
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
  if (!access.canTool('grant-pass-report')) redirect('/')

  const q = new URL(request.url).searchParams
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
    lines.push(row([label, 'TOTAL', '', hrs(data.totals.workedThisMonth)]))
  } else {
    lines.push(row([
      'Period', 'Project', 'Carried in', 'Prepaid', 'Remaining',
      'Hours', 'Employee costs (USD)', 'Contractor costs (USD)', 'Donations (USD)', 'Net (USD)',
      `Total hours ${year}`, `Total donations ${year} (USD)`, `Total costs ${year} (USD)`,
      `${lastYear} hours, same period`,
    ]))
    for (const r of data.rows) {
      lines.push(row([
        label, r.name, hrs(r.carriedIn), hrs(r.boughtThisMonth), hrs(r.remaining),
        hrs(r.workedThisMonth), cash(r.employeeCostThisMonth), cash(r.contractorCostThisMonth),
        cash(r.donationsThisMonth), cash(r.netThisMonth), hrs(r.yearToDate), cash(r.donationsYtd),
        cash(r.totalCosts), hrs(r.sameMonthLastYear),
      ]))
    }

    /** Only the rows that have one contribute, so a total is of the same rows the column shows. */
    const sum = (pick: (r: typeof data.rows[number]) => number | null) => {
      const parts = data.rows.map(pick).filter((n): n is number => n != null)
      return parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0)
    }
    const givenNow = data.rows.map(r => r.donationsThisMonth).filter((n): n is number => n != null)
    const givenYtd = data.rows.map(r => r.donationsYtd).filter((n): n is number => n != null)

    lines.push(row([
      label, 'TOTAL', '', '', hrs(data.rows.reduce((s, r) => s + (r.remaining ?? 0), 0)),
      hrs(data.totals.workedThisMonth), cash(data.totals.employeeCostThisMonth),
      cash(data.totals.contractorCostThisMonth),
      givenNow.length ? cash(givenNow.reduce((s, n) => s + n, 0)) : '',
      cash(sum(r => r.netThisMonth)),
      hrs(data.totals.yearToDate),
      givenYtd.length ? cash(givenYtd.reduce((s, n) => s + n, 0)) : '',
      cash(data.totals.totalCosts), hrs(data.totals.sameMonthLastYear),
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
