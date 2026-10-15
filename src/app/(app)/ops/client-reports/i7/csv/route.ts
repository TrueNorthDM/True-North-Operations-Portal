/**
 * GET /ops/client-reports/i7/csv?from=YYYY-MM&to=YYYY-MM&type=client|internal
 *
 * `?month=` still works and means a range of one, which is what every link
 * written before the report could show more than a month meant anyway.
 *
 * CSV export of the i7 Budget Usage Report, pure data, no rendering.
 *   internal → per-person detail (tidy/long): one row per
 *              Invoice · Project · Job code · Activity · Person, with Hours + Cost
 *              (cost uses each person's own month rate). Confidential.
 *   client   → billing lines: one row per Invoice · Project · Job code with
 *              Hours, Investment ($) and Share of total. No names, no rates.
 *
 * Auth: the proxy requires a session, and requirePrivileged then restricts this
 * to admins, since both variants expose budget figures (and `internal` exposes
 * per-person rates) that the report hides from Team Leaders and Users.
 */

import { requirePrivileged } from '@/lib/tsheets/require-privileged'
import { costShares, isMMEProject as isMME } from '@/lib/tsheets/i7-view'
import { I7_EXPORT_KEYS } from '@/lib/tsheets/export-keys'
import { loadI7ByMonth, loadI7Days } from '@/lib/tsheets/report-data'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { resolveRange, spanWording } from '@/lib/tsheets/range'
import { csvFile, csvRow } from '@/lib/format/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const round2 = (n: number) => Math.round(n * 100) / 100

function newestMonth(): string {
  const months = availableMonths(new Date())
  const cur = currentYearMonth()
  return months.includes(cur) ? cur : months[0]
}

export async function GET(request: Request) {
  const denied = await requirePrivileged(...I7_EXPORT_KEYS)
  if (denied) return denied

  const url = new URL(request.url)
  const q = url.searchParams
  const legacy = q.get('month') ?? undefined
  const range = resolveRange(q.get('from') ?? legacy, q.get('to') ?? legacy, newestMonth())
  const type = q.get('type') === 'internal' ? 'internal' : 'client'

  // Two shapes on purpose. The internal file is worked through day by day, so
  // it carries dates. The client file is a summary somebody invoices from, and
  // a month is the unit it is invoiced in.
  let months: Awaited<ReturnType<typeof loadI7ByMonth>> = []
  let days: Awaited<ReturnType<typeof loadI7Days>> = []
  try {
    if (type === 'internal') days = await loadI7Days(range.from, range.to)
    else months = await loadI7ByMonth(range.from, range.to)
  } catch {
    return new Response('Could not load the report.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  const label = spanWording(range.from, range.to)
  const lines: string[] = []

  // Month first, on every row, because that is the column somebody sorts and
  // pivots by. It is here even for a single month: the period used to live only
  // in the file's name, so opening the file, or pasting its rows into a sheet,
  // lost it.
  //
  // Written as 2026-01 rather than "Jan 2026", which is what the Full history
  // export says. A spreadsheet sorts the first correctly and the second into
  // Apr, Aug, Dec, and this file exists to be sorted by month.
  const HEAD = type === 'internal'
    ? ['Date', 'Invoice', 'Project', 'Job code', 'Activity', 'Person', 'Hours', 'Cost (USD)']
    : ['Month', 'Invoice', 'Project', 'Job code', 'Hours', 'Investment (USD)', 'Share of month (%)']
  lines.push(csvRow(HEAD))

  if (type === 'internal') {
    if (days.length === 0) lines.push(`No i7 hours for ${label}.`)
    for (const d of days) {
      lines.push(csvRow([d.date, d.invoice, d.project, d.code, d.activity, d.person, d.hours, d.cost]))
    }
  } else if (months.length === 0) {
    lines.push(`No i7 hours for ${label}.`)
  } else {
    for (const { month, report } of months) {
      const total = report.totalCost
      // The month's shares add up to the 100 on its TOTAL line, and are the
      // ones the client PDF of the month prints (audit, 13 October 2026).
      const share = costShares(report)
      for (const p of report.projects) {
        const inv = isMME(p.project) ? 'MME invoice' : 'i7 invoice'
        for (const jc of p.jobcodes) {
          if (jc.hours <= 0) continue
          // Two decimals, not whole dollars: this file is opened by accounting.
          lines.push(csvRow([month, inv, p.project, jc.code, jc.hours, round2(jc.cost).toFixed(2), share.jobcode[p.project]?.[jc.code] ?? 0]))
        }
      }
      // A total per month, not one for the range. A single figure at the foot
      // of a file covering nine months is the same trap the rows had.
      lines.push(csvRow([month, '', `TOTAL ${month}`, '', report.totalHours, round2(total).toFixed(2), 100]))
    }
  }

  // BOM so Excel reads UTF-8 (accented names, the em dash) correctly.
  const csv = csvFile(lines)
  const name = (type === 'internal' ? `i7 Budget Internal Report - ${label}` : `i7 Budget Report - ${label}`) + '.csv'
  const asciiName = name.replace(/[^\x20-\x7e]/g, '-')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
