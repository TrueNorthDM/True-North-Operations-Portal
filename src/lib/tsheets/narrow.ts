/**
 * What a restricted viewer's browser is allowed to RECEIVE of the client report.
 *
 * The narrowing used to happen in the component: every person's hours and every
 * cost were serialised into the page, and the browser chose what to draw. That
 * was only ever safe by accident. Row-level security on tc_entries had already
 * removed the rows before they reached the loader, so there was nothing left to
 * leak, and the component's filter was decoration on top of a database rule
 * nobody had configured and no screen displayed.
 *
 * That rule is gone now: the report reads completely, because "see the whole
 * client report" is a setting on the Access levels page and it has to be the
 * thing that decides. Which means hiding in the component would be hiding in
 * the one place the viewer controls. This runs on the server, and what it
 * removes never reaches the wire.
 *
 * Totals are deliberately left alone. `hours` at every node stays the figure
 * for everyone, so a narrowed report reads as visibly partial (the columns add
 * up to less than the total) instead of a smaller total that looks whole. That
 * is the same promise the Access levels note already makes.
 */

import type { I7Report, I7Project, I7Jobcode, I7Activity, PersonHours } from './types'

/** Only the allowed names survive as columns. Hours totals are untouched. */
function keepOnly(byPerson: PersonHours, allowed: ReadonlySet<string>): PersonHours {
  const out: PersonHours = {}
  for (const [name, hours] of Object.entries(byPerson)) {
    if (allowed.has(name)) out[name] = hours
  }
  return out
}

export interface NarrowOptions {
  /** Display names whose hour columns this viewer may see. */
  people: readonly string[]
  /**
   * Whether the viewer may see money. False for the restricted level, which
   * hides Budget used, so the costs must not be in the payload at all. Hrs
   * avail. and Budget avail. survive: they are computed from the budget and the
   * standard rate, which this never touches.
   */
  keepCost: boolean
}

export function narrowReport(report: I7Report, { people, keepCost }: NarrowOptions): I7Report {
  const allowed = new Set(people)
  const cost = (c: number) => (keepCost ? c : 0)

  const activity = (a: I7Activity): I7Activity => ({
    ...a, cost: cost(a.cost), byPerson: keepOnly(a.byPerson, allowed),
  })
  const jobcode = (j: I7Jobcode): I7Jobcode => ({
    ...j, cost: cost(j.cost), byPerson: keepOnly(j.byPerson, allowed),
    activities: j.activities.map(activity),
  })
  const project = (p: I7Project): I7Project => ({
    ...p, cost: cost(p.cost), byPerson: keepOnly(p.byPerson, allowed),
    jobcodes: p.jobcodes.map(jobcode),
  })

  return {
    ...report,
    totalCost: cost(report.totalCost),
    people: report.people.filter(n => allowed.has(n)),
    projects: report.projects.map(project),
  }
}
