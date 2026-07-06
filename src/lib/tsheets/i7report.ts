// Builds the i7 Budget Usage Report tree from raw TSheets data.
//
// The report is 3 levels deep: Project → Job code → Activity. Unlike the old
// pivot, the client dimension lives in the timesheet CUSTOM FIELDS, not the job
// code hierarchy:
//   '129628' = "1 - i7 Code"  → the job code (e.g. "WM-MKTG"); its prefix is
//               the project (WM* = Wagner Meters, BE* = Bessemeter, …).
//   '19156'  = "3 Activity"   → the activity (e.g. "Content: Writing").
// Cost = hours × the person's i7 hourly rate.

import type { TsheetsJobcode, TsheetsTimesheet, I7Report, I7Project } from './types'

export const I7_PARENT_JOBCODE_ID = 21152466
const I7_CODE_CF = '129628'
const ACTIVITY_CF = '19156'

const NO_CODE = '(no code)'
const NO_ACTIVITY = '(no activity)'

/** Group an i7 code into its project by prefix. */
export function mapCodeToProject(code: string): string {
  const c = code.trim().toUpperCase()
  if (c.startsWith('I7')) return 'i7 Marketing'
  if (c.startsWith('MME')) return 'Moisture Meters (MME)'
  if (c.startsWith('BE')) return 'Bessemeter'
  if (c.startsWith('WM')) return 'Wagner Meters (WM)'
  return 'Unassigned'
}

/** The set of job code ids whose top-level ancestor is the i7 parent. */
export function i7JobcodeIds(jobcodes: TsheetsJobcode[]): Set<number> {
  const byId = new Map(jobcodes.map(j => [j.id, j]))
  function topParent(id: number): number {
    const seen = new Set<number>()
    let cur = byId.get(id)
    while (cur && cur.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id)
      const p = byId.get(cur.parent_id)
      if (!p) break
      cur = p
    }
    return cur?.id ?? id
  }
  return new Set(jobcodes.filter(j => topParent(j.id) === I7_PARENT_JOBCODE_ID).map(j => j.id))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildI7Report(
  timesheets: TsheetsTimesheet[],       // already filtered to i7 entries
  ratesByUser: Record<number, number>, // tsheets_user_id → i7 hourly rate
  startDate: string,
): I7Report {
  // project → code → activity → { hours, cost }
  type Leaf = { hours: number; cost: number }
  const tree = new Map<string, Map<string, Map<string, Leaf>>>()

  for (const ts of timesheets) {
    const cf = ts.customfields ?? {}
    const code = (cf[I7_CODE_CF] || NO_CODE).trim() || NO_CODE
    const activity = (cf[ACTIVITY_CF] || NO_ACTIVITY).trim() || NO_ACTIVITY
    const project = mapCodeToProject(code)
    const hours = ts.duration / 3600
    const cost = hours * (ratesByUser[ts.user_id] ?? 0)

    const codes = tree.get(project) ?? new Map()
    tree.set(project, codes)
    const acts = codes.get(code) ?? new Map()
    codes.set(code, acts)
    const leaf = acts.get(activity) ?? { hours: 0, cost: 0 }
    leaf.hours += hours
    leaf.cost += cost
    acts.set(activity, leaf)
  }

  const projects: I7Project[] = []
  let totalHours = 0
  let totalCost = 0

  for (const [project, codes] of tree) {
    const jobcodes = []
    let pHours = 0
    let pCost = 0
    for (const [code, acts] of codes) {
      const activities = []
      let cHours = 0
      let cCost = 0
      for (const [activity, leaf] of acts) {
        const h = round2(leaf.hours)
        const c = round2(leaf.cost)
        activities.push({ activity, hours: h, cost: c })
        cHours += leaf.hours
        cCost += leaf.cost
      }
      activities.sort((a, b) => b.hours - a.hours)
      jobcodes.push({ code, hours: round2(cHours), cost: round2(cCost), activities })
      pHours += cHours
      pCost += cCost
    }
    jobcodes.sort((a, b) => a.code.localeCompare(b.code))
    projects.push({ project, hours: round2(pHours), cost: round2(pCost), jobcodes })
    totalHours += pHours
    totalCost += pCost
  }
  projects.sort((a, b) => a.project.localeCompare(b.project))

  const [year, monthIdx] = startDate.split('-').map(Number)
  const month = `${MONTH_NAMES[monthIdx - 1]} ${year}`
  const endDate = new Date(year, monthIdx, 0).toISOString().slice(0, 10)
  const hasRates = Object.values(ratesByUser).some(r => r > 0)

  return { month, startDate, endDate, projects, totalHours: round2(totalHours), totalCost: round2(totalCost), hasRates }
}
