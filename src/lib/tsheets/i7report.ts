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

/** What an entry is filed under when it arrived without one. Exported so an
 *  export that reads entries directly files them exactly as the tree does. */
export const NO_CODE = '(no code)'
export const NO_ACTIVITY = '(no activity)'

/** Group an i7 code into its project by prefix. */
export function mapCodeToProject(code: string): string {
  const c = code.trim().toUpperCase()
  if (c.startsWith('I7')) return 'i7 Marketing'
  if (c.startsWith('MME')) return 'Moisture Meters (MME)'
  if (c.startsWith('BE')) return 'Bessemeter'
  if (c.startsWith('WM')) return 'Wagner Meters (WM)'
  return 'Unassigned'
}

/**
 * How a person with no name is shown. A person with no name is a link that
 * never happened, so the id is shown rather than swallowed: an unnamed column
 * in an invoice is a question somebody asks, and a missing one is not.
 */
export const unnamedPerson = (personId: string): string => `Person ${personId.slice(0, 8)}`

/**
 * person id → the label the report shows for them, one per person and never
 * shared (audit, 13 October 2026).
 *
 * The report used to key people by first name, so two people called Ana became
 * one column holding both their hours, one rate, and one line in the export.
 * Hours are now added up by person id, and this is the only place a person
 * turns into words.
 *
 * The first name alone, as before, unless someone else in the same report
 * shares it: then the first name and last initial ("Ana S.", "Ana T."). If that
 * still matches, the full name, and if even that does, the full name with the
 * start of the id, since two columns with one heading are the bug itself.
 *
 * `personIds` is everyone the report covers, worked out once per range by the
 * data layer, so the screen, the PDF and the CSVs of one range call a person
 * the same thing even where a single month of it holds only one Ana.
 */
export function personLabels(
  personIds: Iterable<string>,
  fullNames: Record<string, string | null | undefined>,
): Record<string, string> {
  const ids = [...new Set(personIds)]
  const words = new Map(ids.map(id => [id, (fullNames[id] ?? '').trim().split(/\s+/).filter(Boolean)]))
  const key = (s: string) => s.toLocaleLowerCase('en-US')
  const out: Record<string, string> = {}

  // Grouped by first name, without regard to case: "ana" and "Ana" would read
  // as the same heading.
  const byFirst = new Map<string, string[]>()
  for (const id of ids) {
    const w = words.get(id)!
    if (w.length === 0) { out[id] = unnamedPerson(id); continue }
    const k = key(w[0])
    byFirst.set(k, [...(byFirst.get(k) ?? []), id])
  }

  for (const group of byFirst.values()) {
    if (group.length === 1) { out[group[0]] = words.get(group[0])![0]; continue }
    const initialled = group.map(id => {
      const w = words.get(id)!
      const last = w.length > 1 ? Array.from(w[w.length - 1])[0].toLocaleUpperCase('en-US') : ''
      return { id, label: last ? `${w[0]} ${last}.` : w[0], full: w.join(' ') }
    })
    const count = (pick: (x: { label: string; full: string }) => string, value: string) =>
      initialled.filter(x => key(pick(x)) === key(value)).length
    for (const x of initialled) {
      if (count(p => p.label, x.label) === 1) out[x.id] = x.label
      else if (count(p => p.full, x.full) === 1) out[x.id] = x.full
      else out[x.id] = `${x.full} (${x.id.slice(0, 8)})`
    }
  }
  return out
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

// The fixed structure to always render, so every project and job code shows
// every month even with zero hours (activities stay conditional).
//
// People are NOT in here, and that is the point. The rows are a plan: a project
// budgeted and not worked is information, so its row stays and reads zero. A
// column is a person, and a person who logged nothing that month is not a zero,
// it is an absence. Carrying the whole roster meant August showed columns for
// everyone who had touched i7 in the retention window, most of them empty,
// pushing the people who did work off the side of the page.
export interface I7Universe {
  projects: string[]                          // all projects, always shown
  jobcodesByProject: Record<string, string[]> // project → its job codes, always shown
}

export function buildI7Report(
  entries: I7Entry[],                   // already filtered to i7 entries (from cache)
  /**
   * The rate to cost an hour at, asked per person AND per month.
   *
   * A record would have done while a report was always one month. Over a range
   * it would not: a rate that changes in April has to cost March's hours at the
   * old figure and April's at the new one, and a single number per person can
   * only be one of the two.
   */
  rateOf: (personId: string, ym: string) => number,
  namesByPerson: Record<string, string>, // person id → display label (personLabels)
  startDate: string,
  universe?: I7Universe,                // the always-shown scaffold (projects/codes/people)
  /**
   * The last day and the wording, when the report covers more than the month
   * `startDate` falls in. Derived from `startDate` when absent, which is what a
   * single-month report wants.
   */
  span?: { endDate: string; label: string },
): I7Report {
  // project → code → activity → userId → { hours, cost }
  type Leaf = { hours: number; cost: number }
  const tree = new Map<string, Map<string, Map<string, Map<string, Leaf>>>>()
  // Whether anything here could be costed at all, which is what decides if the
  // money columns are drawn. Collected as the entries go by, since a rate is
  // now asked for rather than handed over in a list that could be counted.
  let sawRate = false

  for (const e of entries) {
    const code = (e.i7Code || NO_CODE).trim() || NO_CODE
    const activity = (e.activity || NO_ACTIVITY).trim() || NO_ACTIVITY
    const project = mapCodeToProject(code)
    const hours = e.duration / 3600
    const rate = rateOf(e.personId, e.date.slice(0, 7))
    if (rate > 0) sawRate = true
    const cost = hours * rate

    const codes = tree.get(project) ?? new Map()
    tree.set(project, codes)
    const acts = codes.get(code) ?? new Map()
    codes.set(code, acts)
    const ppl = acts.get(activity) ?? new Map<string, Leaf>()
    acts.set(activity, ppl)
    const leaf = ppl.get(e.personId) ?? { hours: 0, cost: 0 }
    leaf.hours += hours
    leaf.cost += cost
    ppl.set(e.personId, leaf)
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
  // Person id → hours this month, which is what decides whether they get a
  // column. By id, not by name: two people sharing a first name used to be
  // added into one column (audit, 13 October 2026).
  const personTotals = new Map<string, number>()
  const labelOf = (personId: string) => namesByPerson[personId] ?? unnamedPerson(personId)
  // Rounded once, at the smallest cell (a person within an activity), and
  // added up from there in whole cents and hundredths of an hour (audit,
  // 9 October 2026). Rounding every level on its own let two job codes of
  // 7 minutes at $95 read $11.08 + $11.08 under a total of $22.17: the lines
  // on an invoice must add up to its total, the July lesson (format.ts).
  const hundredths = (n: number) => Math.round(n * 100)
  let totalHours = 0
  let totalCost = 0

  // id→hours accumulator → rounded plain object for output, keyed by the label
  // the columns are headed with. Labels from personLabels are one per person;
  // were two ever to match, their hours are added rather than one overwriting
  // the other, so the totals stay right.
  const roundMap = (m: Map<string, number>): PersonHours => {
    const out: PersonHours = {}
    for (const [personId, h] of m) {
      const label = labelOf(personId)
      out[label] = round2((out[label] ?? 0) + h)
    }
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
        let aHours = 0, aCost = 0   // hundredths
        const aByPerson = new Map<string, number>()
        for (const [personId, leaf] of ppl) {
          personTotals.set(personId, (personTotals.get(personId) ?? 0) + leaf.hours)
          aByPerson.set(personId, (aByPerson.get(personId) ?? 0) + leaf.hours)
          cByPerson.set(personId, (cByPerson.get(personId) ?? 0) + leaf.hours)
          pByPerson.set(personId, (pByPerson.get(personId) ?? 0) + leaf.hours)
          aHours += hundredths(leaf.hours)
          aCost += hundredths(leaf.cost)
        }
        activities.push({ activity, hours: aHours / 100, cost: aCost / 100, byPerson: roundMap(aByPerson) })
        cHours += aHours
        cCost += aCost
      }
      activities.sort((a, b) => b.hours - a.hours)
      jobcodes.push({ code, hours: cHours / 100, cost: cCost / 100, activities, byPerson: roundMap(cByPerson) })
      pHours += cHours
      pCost += cCost
    }
    jobcodes.sort((a, b) => a.code.localeCompare(b.code))
    projects.push({ project, hours: pHours / 100, cost: pCost / 100, jobcodes, byPerson: roundMap(pByPerson) })
    totalHours += pHours
    totalCost += pCost
  }
  projects.sort((a, b) => a.project.localeCompare(b.project))
  // Column set = whoever logged hours in this month, and nobody else. Rounded
  // before the test so an entry of a few seconds does not buy a column that
  // then reads as a dash.
  const people = [...new Set([...personTotals.entries()]
    .filter(([, hours]) => round2(hours) > 0)
    .map(([personId]) => labelOf(personId)))]
    .sort((a, b) => a.localeCompare(b))

  const [year, monthIdx] = startDate.split('-').map(Number)
  const month = span?.label ?? `${MONTH_NAMES[monthIdx - 1]} ${year}`
  // In UTC: a local midnight east of UTC printed the day before.
  const endDate = span?.endDate ?? new Date(Date.UTC(year, monthIdx, 0)).toISOString().slice(0, 10)

  return { month, startDate, endDate, projects, people, totalHours: totalHours / 100, totalCost: totalCost / 100, hasRates: sawRate }
}


/** A day's work on one job code by one person, which is as fine as an export gets. */
export interface I7DayRow {
  date: string        // YYYY-MM-DD
  invoice: string     // 'i7' or 'MME', the invoice the project bills to
  project: string
  code: string
  activity: string
  person: string
  hours: number
  cost: number
}

/** Moisture Meters bills separately from the rest of i7. */
const isMMEProject = (name: string) => /mme|moisture/i.test(name)

/**
 * The invoice an i7 job code bills to: 'MME' for Moisture Meters, 'i7' for the
 * rest (i7 Marketing, Wagner Meters, Bessemeter, and anything unassigned).
 * One rule for the i7 export and for Project Hours' i7 and MME rows, so the
 * two cannot split the hours differently.
 */
export const i7Invoice = (code: string): 'i7' | 'MME' =>
  isMMEProject(mapCodeToProject((code || NO_CODE).trim() || NO_CODE)) ? 'MME' : 'i7'

/**
 * The same entries buildI7Report adds up, kept apart and dated.
 *
 * The tree answers "what did this cost" and so discards the day on the way in.
 * That is right on screen and wrong in a spreadsheet somebody reconciles, so an
 * export builds from here instead. Both file entries under the same code and
 * activity, which is why the fallbacks are shared rather than spelled twice:
 * a row with no activity has to be called the same thing in both.
 *
 * Summed per day, not per entry. Two entries by one person on one code on one
 * day are one line of work, and splitting them makes a file where the same row
 * appears twice for no reason a reader can see.
 */
export function buildI7Days(
  entries: I7Entry[],
  rateOf: (personId: string, ym: string) => number,
  namesByPerson: Record<string, string>,  // person id → display label (personLabels)
): I7DayRow[] {
  const acc = new Map<string, I7DayRow>()
  for (const e of entries) {
    const code = (e.i7Code || NO_CODE).trim() || NO_CODE
    const activity = (e.activity || NO_ACTIVITY).trim() || NO_ACTIVITY
    const project = mapCodeToProject(code)
    const person = namesByPerson[e.personId] ?? unnamedPerson(e.personId)
    const hours = e.duration / 3600
    // Costed at the rate for the month the day falls in, the rule the screen
    // uses, so a rate change mid-range lands on the right side of it.
    const cost = hours * rateOf(e.personId, e.date.slice(0, 7))

    // Joined by person id, never by the name shown: two people who share a
    // name are two lines of work (audit, 13 October 2026).
    const key = `${e.date}|${code}|${activity}|${e.personId}`
    const row = acc.get(key)
    if (row) { row.hours += hours; row.cost += cost }
    else acc.set(key, {
      date: e.date, invoice: isMMEProject(project) ? 'MME' : 'i7',
      project, code, activity, person, hours, cost,
    })
  }

  return [...acc.values()]
    .map(r => ({ ...r, hours: round2(r.hours), cost: round2(r.cost) }))
    .filter(r => r.hours > 0)
    // Date first: the file is read forwards through the month, and everything
    // under a day is ordered the way the report's own table is.
    .sort((a, b) =>
      a.date.localeCompare(b.date) || a.project.localeCompare(b.project) ||
      a.code.localeCompare(b.code) || a.activity.localeCompare(b.activity) ||
      a.person.localeCompare(b.person))
}
