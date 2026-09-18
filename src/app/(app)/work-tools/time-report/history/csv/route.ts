/**
 * GET /work-tools/time-report/history/csv?from=YYYY-MM&to=YYYY-MM
 *
 * The Full history table as a CSV, over any range rather than the calendar year
 * the screen shows. One row per month: budget, what came in from the month
 * before, what was used, and the hours behind it.
 *
 * `from` is clamped to January 2026 in the loader. tc_entries holds hours back
 * to 2017, but budgets and rates begin in 2026, so an earlier month would come
 * out as real hours beside zero money: true arithmetic that reads as a month
 * where nothing was spent.
 *
 * Auth: the same admin gate as the other exports. Every column here is a budget
 * figure the report hides from Team Leaders and Users.
 */

import { requirePrivileged } from '@/lib/tsheets/require-privileged'
import { loadI7History } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'
import { DATA_START } from '@/lib/tsheets/retention'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

function cell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(cell).join(',')

/** A month, or null. Anything unparseable falls back rather than throwing. */
function month(v: string | null): string | null {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null
}

export async function GET(request: Request) {
  const denied = await requirePrivileged()
  if (denied) return denied

  const url = new URL(request.url)
  const to = month(url.searchParams.get('to')) ?? currentYearMonth()
  // Defaults to the year the `to` month falls in, which is what the screen
  // shows, so a request with no range gives what the table gives.
  const from = month(url.searchParams.get('from')) ?? `${to.slice(0, 4)}-01`

  const rows = await loadI7History(from < DATA_START ? DATA_START : from, to)

  const lines = [
    row(['Month', 'Budget', 'Carried in', 'Used', 'Hours used', 'Balance']),
    ...rows.map(r => row([monthLabel(r.month), r.budget, r.carryIn, r.used, r.hours, r.balance])),
  ]
  if (rows.length) {
    // Budget and used sum; carried-in and balance do not, so the total row
    // leaves them blank rather than printing a number nobody should add up.
    lines.push(row([
      'Total',
      rows.reduce((s, r) => s + r.budget, 0),
      '',
      Math.round(rows.reduce((s, r) => s + r.used, 0) * 100) / 100,
      Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100,
      '',
    ]))
  }

  const csv = '﻿' + lines.join('\r\n') + '\r\n'
  const name = rows.length
    ? `i7 Full History - ${monthLabel(rows[0].month)} to ${monthLabel(rows[rows.length - 1].month)}.csv`
    : 'i7 Full History.csv'
  const asciiName = name.replace(/[^\x20-\x7e]/g, '-')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
