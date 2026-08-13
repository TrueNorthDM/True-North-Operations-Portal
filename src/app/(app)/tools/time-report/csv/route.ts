/**
 * GET /tools/time-report/csv?month=YYYY-MM&type=client|internal
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
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => /^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym
const isMME = (name: string) => /mme|moisture/i.test(name)
const round2 = (n: number) => Math.round(n * 100) / 100
const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0)

function resolveMonth(month: string | null): string {
  const months = availableMonths(new Date())
  const cur = currentYearMonth()
  return month && months.includes(month) ? month : months.includes(cur) ? cur : months[0]
}

// Quote a CSV cell only when it needs it (comma, quote, newline); escape quotes.
function cell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(cell).join(',')

export async function GET(request: Request) {
  const denied = await requirePrivileged()
  if (denied) return denied

  const url = new URL(request.url)
  const month = resolveMonth(url.searchParams.get('month'))
  const type = url.searchParams.get('type') === 'internal' ? 'internal' : 'client'

  let data
  try {
    data = await loadI7ReportData(month)
  } catch {
    return new Response('Could not load the report.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  const label = monthLabel(month)
  const lines: string[] = []

  if (!data.report) {
    lines.push(type === 'internal'
      ? 'Invoice,Project,Job code,Activity,Person,Hours,Cost (USD)'
      : 'Invoice,Project,Job code,Hours,Investment (USD),Share of total (%)')
    lines.push(`No i7 hours for ${label}.`)
  } else if (type === 'internal') {
    const { report, personRates } = data
    lines.push('Invoice,Project,Job code,Activity,Person,Hours,Cost (USD)')
    for (const p of report.projects) {
      const inv = isMME(p.project) ? 'MME' : 'i7'
      for (const jc of p.jobcodes) {
        // Deepest level carrying per-person hours: activity, else the job code.
        const nodes = jc.activities.length
          ? jc.activities.map(a => ({ activity: a.activity, byPerson: a.byPerson }))
          : [{ activity: '', byPerson: jc.byPerson }]
        for (const node of nodes) {
          for (const person of report.people) {
            const hours = node.byPerson[person] ?? 0
            if (hours <= 0) continue
            const cost = round2(hours * (personRates[person] ?? 0))
            lines.push(row([inv, p.project, jc.code, node.activity, person, hours, cost]))
          }
        }
      }
    }
  } else {
    const { report } = data
    const total = report.totalCost
    lines.push('Invoice,Project,Job code,Hours,Investment (USD),Share of total (%)')
    for (const p of report.projects) {
      const inv = isMME(p.project) ? 'MME invoice' : 'i7 invoice'
      for (const jc of p.jobcodes) {
        if (jc.hours <= 0) continue
        // Two decimals, not whole dollars: this file is opened by accounting.
        lines.push(row([inv, p.project, jc.code, jc.hours, round2(jc.cost).toFixed(2), pct(jc.cost, total)]))
      }
    }
    lines.push(row(['', 'TOTAL', '', report.totalHours, round2(total).toFixed(2), 100]))
  }

  // BOM so Excel reads UTF-8 (accented names, the em dash) correctly.
  const csv = '﻿' + lines.join('\r\n') + '\r\n'
  const name = (type === 'internal' ? `i7 Budget Internal Report - ${label}` : `i7 Budget Month Report - ${label}`) + '.csv'
  const asciiName = name.replace(/[^\x20-\x7e]/g, '-')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
