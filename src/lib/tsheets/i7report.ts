// Builds the i7 Budget Usage Report tree from raw TSheets data.
//
// The report is 3 levels deep: Project → Job code → Activity. Unlike the old
// pivot, the client dimension lives in the timesheet CUSTOM FIELDS, not the job
// code hierarchy:
//   '129628' = "1 - i7 Code"  → the job code (e.g. "WM-MKTG"); its prefix is
//               the project (WM* = Wagner Meters, BE* = Bessemeter, …).
//   '19156'  = "3 Activity"   → the activity (e.g. "Content: Writing").
// Cost = hours × the person's i7 hourly rate.

import type { TsheetsJobcode, I7Entry, I7Report, I7Project, I7Jobcode, I7Activity, PersonHours } from './types'

export const I7_PARENT_JOBCODE_ID = 21152466
export const I7_CODE_CF = '129628'
export const ACTIVITY_CF = '19156'
// "2 Project", where work outside the i7 tree is tagged. Grant Pass lives here
// from 2023 onward, and in the deactivated GP job codes before that.
export const PROJECT_CF = '129636'

// The four i7 projects (top level of the report + budget-hours guide targets).
export const I7_PROJECTS = ['i7 Marketing', 'Moisture Meters (MME)', 'Wagner Meters (WM)', 'Bessemeter'] as const

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

// The fixed structure to always render, so every project / job code / person
// shows every month even with zero hours (only activities stay conditional).
export interface I7Universe {
  projects: string[]                          // all projects, always shown
  jobcodesByProject: Record<string, string[]> // project → its job codes, always shown
  people: string[]                            // full person roster (column headers)
}

export function buildI7Report(
  entries: I7Entry[],                   // already filtered to i7 entries (from cache)
  ratesByUser: Record<number, number>, // tsheets_user_id → i7 hourly rate
  namesByUser: Record<number, string>, // tsheets_user_id → display name
  startDate: string,
  universe?: I7Universe,                // the always-shown scaffold (projects/codes/people)
): I7Report {
  // project → code → activity → userId → { hours, cost }
  type Leaf = { hours: number; cost: number }
  const tree = new Map<string, Map<string, Map<string, Map<number, Leaf>>>>()

  for (const e of entries) {
    const code = (e.i7Code || NO_CODE).trim() || NO_CODE
    const activity = (e.activity || NO_ACTIVITY).trim() || NO_ACTIVITY
    const project = mapCodeToProject(code)
    const hours = e.duration / 3600
    const cost = hours * (ratesByUser[e.user_id] ?? 0)

    const codes = tree.get(project) ?? new Map()
    tree.set(project, codes)
    const acts = codes.get(code) ?? new Map()
    codes.set(code, acts)
    const ppl = acts.get(activity) ?? new Map<number, Leaf>()
    acts.set(activity, ppl)
    const leaf = ppl.get(e.user_id) ?? { hours: 0, cost: 0 }
    leaf.hours += hours
    leaf.cost += cost
    ppl.set(e.user_id, leaf)
  }

  // Scaffold every project + job code from the universe (empty activity maps),
  // so 0-hour projects/codes still render. Activities stay entry-driven.
  if (universe) {
    for (const proj of universe.projects) {
      const codes = tree.get(proj) ?? new Map()
      tree.set(proj, codes)
      for (const code of universe.jobcodesByProject[proj] ?? []) {
        if (!codes.has(code)) codes.set(code, new Map())
      }
    }
  }

  const projects: I7Project[] = []
  const allPeople = new Set<string>()
  let totalHours = 0
  let totalCost = 0

  // name→hours accumulator → rounded plain object for output.
  const roundMap = (m: Map<string, number>): PersonHours => {
    const out: PersonHours = {}
    for (const [name, h] of m) out[name] = round2(h)
    return out
  }

  for (const [project, codes] of tree) {
    const jobcodes: I7Jobcode[] = []
    let pHours = 0, pCost = 0
    const pByPerson = new Map<string, number>()   // rolls up all people under the project
    for (const [code, acts] of codes) {
      const activities: I7Activity[] = []
      let cHours = 0, cCost = 0
      const cByPerson = new Map<string, number>()
      for (const [activity, ppl] of acts) {
        let aHours = 0, aCost = 0
        const aByPerson = new Map<string, number>()
        for (const [userId, leaf] of ppl) {
          const name = namesByUser[userId] ?? `User ${userId}`
          allPeople.add(name)
          aByPerson.set(name, (aByPerson.get(name) ?? 0) + leaf.hours)
          cByPerson.set(name, (cByPerson.get(name) ?? 0) + leaf.hours)
          pByPerson.set(name, (pByPerson.get(name) ?? 0) + leaf.hours)
          aHours += leaf.hours
          aCost += leaf.cost
        }
        activities.push({ activity, hours: round2(aHours), cost: round2(aCost), byPerson: roundMap(aByPerson) })
        cHours += aHours
        cCost += aCost
      }
      activities.sort((a, b) => b.hours - a.hours)
      jobcodes.push({ code, hours: round2(cHours), cost: round2(cCost), activities, byPerson: roundMap(cByPerson) })
      pHours += cHours
      pCost += cCost
    }
    jobcodes.sort((a, b) => a.code.localeCompare(b.code))
    projects.push({ project, hours: round2(pHours), cost: round2(pCost), jobcodes, byPerson: roundMap(pByPerson) })
    totalHours += pHours
    totalCost += pCost
  }
  projects.sort((a, b) => a.project.localeCompare(b.project))
  // Column set = the full roster (universe) ∪ anyone who logged hours this month.
  const people = [...new Set([...(universe?.people ?? []), ...allPeople])].sort((a, b) => a.localeCompare(b))

  const [year, monthIdx] = startDate.split('-').map(Number)
  const month = `${MONTH_NAMES[monthIdx - 1]} ${year}`
  const endDate = new Date(year, monthIdx, 0).toISOString().slice(0, 10)
  const hasRates = Object.values(ratesByUser).some(r => r > 0)

  return { month, startDate, endDate, projects, people, totalHours: round2(totalHours), totalCost: round2(totalCost), hasRates }
}
