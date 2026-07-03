// Builds the time report pivot matrix from raw TSheets API data.
//
// Input: raw users + jobcodes + timesheets arrays from the API.
// Output: a TimeReportMatrix ready for the UI — all IDs resolved to names,
// hours summed per (jobcode × employee), totals pre-computed.

import type { TsheetsUser, TsheetsJobcode, TsheetsTimesheet, TimeReportMatrix } from './types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildMatrix(
  users: TsheetsUser[],
  jobcodes: TsheetsJobcode[],
  timesheets: TsheetsTimesheet[],
  startDate: string,
): TimeReportMatrix {
  // Only include employees who actually logged time this period
  const activeUserIds = new Set(timesheets.map(t => t.user_id))
  const activeJobcodeIds = new Set(timesheets.map(t => t.jobcode_id))

  const employees = users
    .filter(u => activeUserIds.has(u.id))
    .map(u => ({ id: u.id, name: u.first_name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const jobcodeMap = new Map(jobcodes.map(j => [j.id, j]))

  // Resolve the top-level ancestor (the "client") of a job code by walking up
  // parent_id. TSheets marks top-level codes with parent_id 0 (or null).
  function clientOf(id: number): number {
    const seen = new Set<number>()
    let cur = jobcodeMap.get(id)
    while (cur && cur.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id)
      const parent = jobcodeMap.get(cur.parent_id)
      if (!parent) break
      cur = parent
    }
    return cur?.id ?? id
  }

  const usedJobcodes = jobcodes
    .filter(j => activeJobcodeIds.has(j.id))
    .map(j => ({ id: j.id, name: j.name, clientId: clientOf(j.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Distinct clients (top-level parents) among the used job codes.
  const clientIds = new Set(usedJobcodes.map(j => j.clientId))
  const clients = [...clientIds]
    .map(cid => ({ id: cid, name: jobcodeMap.get(cid)?.name ?? 'Unknown' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Accumulate seconds per (jobcode, user), then convert to hours
  const seconds: Record<number, Record<number, number>> = {}
  for (const ts of timesheets) {
    if (!jobcodeMap.has(ts.jobcode_id)) continue
    if (!seconds[ts.jobcode_id]) seconds[ts.jobcode_id] = {}
    seconds[ts.jobcode_id][ts.user_id] = (seconds[ts.jobcode_id][ts.user_id] ?? 0) + ts.duration
  }

  const hours: Record<number, Record<number, number>> = {}
  const rowTotals: Record<number, number> = {}
  const colTotals: Record<number, number> = {}
  let grandTotal = 0

  for (const jc of usedJobcodes) {
    hours[jc.id] = {}
    rowTotals[jc.id] = 0
    for (const emp of employees) {
      const secs = seconds[jc.id]?.[emp.id] ?? 0
      const hrs = round2(secs / 3600)
      hours[jc.id][emp.id] = hrs
      rowTotals[jc.id] = round2(rowTotals[jc.id] + hrs)
      colTotals[emp.id] = round2((colTotals[emp.id] ?? 0) + hrs)
      grandTotal = round2(grandTotal + hrs)
    }
  }

  // Derive month label from startDate (YYYY-MM-DD)
  const [year, monthIdx] = startDate.split('-').map(Number)
  const month = `${MONTH_NAMES[monthIdx - 1]} ${year}`
  const endDate = new Date(year, monthIdx, 0).toISOString().slice(0, 10) // last day of month

  return { month, startDate, endDate, employees, jobcodes: usedJobcodes, clients, hours, rowTotals, colTotals, grandTotal }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Returns the YYYY-MM-DD start/end for a given "YYYY-MM" string
export function monthBounds(ym: string): { startDate: string; endDate: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate: start, endDate: end }
}

// Default to current month in YYYY-MM format
export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
