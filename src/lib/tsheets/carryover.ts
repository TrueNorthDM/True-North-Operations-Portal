/**
 * The i7 budget balance, computed in one place.
 *
 * The balance used to exist only as a by-product of `loadI7ReportData`, which
 * builds the whole report: the project tree, the per-person rates, the list of
 * people without a rate and the chart of the year. The Home page and the
 * image export wanted the balance and nothing else, and paid for all of it,
 * including a second full pass over the year's entries to list the job codes the
 * report scaffolds its empty rows from. On Home that was 1.2 of its 1.24 seconds,
 * measured in September 2026.
 *
 * So the balance is a function of its inputs, and both the report and the light
 * loader call it. They cannot disagree about the number because there is only one
 * way to compute it.
 */

import { buildI7Report } from './i7report'
import { rateFor, type Assignment } from './rates'
import { monthBounds, monthsBetween } from './report'
import { DATA_START, retentionFloor } from './retention'
import type { I7Carryover, I7Entry } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Entries grouped by month, so a walk over months reads each month's bucket
 * instead of rescanning every entry ever loaded to find it.
 */
export function bucketByMonth(entries: I7Entry[]): Map<string, I7Entry[]> {
  const byMonth = new Map<string, I7Entry[]>()
  for (const e of entries) {
    const ym = e.date.slice(0, 7)
    const list = byMonth.get(ym)
    if (list) list.push(e); else byMonth.set(ym, [e])
  }
  return byMonth
}

/** Budget and cost added up over a run of months: what the balance walk needs. */
export function accumulateMonths(
  byMonth: Map<string, I7Entry[]>,
  assignments: Assignment[],
  monthlyBudgets: Record<string, number>,
  months: string[],
): { budget: number; cost: number } {
  let budget = 0, cost = 0
  for (const ym of months) {
    budget += monthlyBudgets[ym] ?? 0
    cost += (byMonth.get(ym) ?? [])
      .reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.personId, ym), 0)
  }
  return { budget, cost }
}

export interface CarryoverInput {
  /** Every i7 entry from the start of the data to the end of `to`. The opening balance needs all of it. */
  entries: I7Entry[]
  assignments: Assignment[]
  /** 'YYYY-MM' to the month's flat budget, base plus extra. */
  monthlyBudgets: Record<string, number>
  from: string
  to: string
  /** When "now" is, for whether the retention window still reaches the start of the data. */
  now: Date
}

/**
 * The balance over a stretch of months, one month by default.
 *
 * What was left coming in, plus what the range was granted, minus what it cost.
 * The range's cost is taken from `buildI7Report`'s own total rather than added up
 * again here, so the widget's "used" and the report's total are the same
 * arithmetic and not merely the same idea. The report is built without names or
 * the job code scaffold because neither changes a cost: names only label
 * columns, and the scaffold only adds rows with no hours.
 */
export function computeI7Carryover({ entries, assignments, monthlyBudgets, from, to, now }: CarryoverInput): I7Carryover {
  const rateAt = (personId: string, ym: string) => rateFor(assignments, personId, ym)
  const inRange = (ym: string) => ym >= from && ym <= to
  const { startDate } = monthBounds(from)
  const monthUsed = buildI7Report(entries.filter(e => inRange(e.date.slice(0, 7))), rateAt, {}, startDate).totalCost

  const byMonth = bucketByMonth(entries)
  const before = accumulateMonths(byMonth, assignments, monthlyBudgets, monthsBetween(DATA_START, from))
  const opening = round2(before.budget - before.cost)

  // The sync prunes timesheets older than 24 months, so from January 2028 the
  // earliest retained month moves past the origin and those hours are gone for
  // good. The balance would then quietly start from a later month and read
  // higher than it should. Flagged rather than silently shown, until the month
  // closings are stored somewhere the prune cannot reach.
  const openingComplete = retentionFloor(now) <= DATA_START

  // Over a range this is the range's budget, every month in it added up, and
  // the balance still reads as one sum: what was left coming in, plus what was
  // granted, minus what was spent.
  const monthBudget = monthsBetween(from, to).concat(to).reduce((sum, ym) => sum + (monthlyBudgets[ym] ?? 0), 0)
  const totalAvailable = round2(opening + monthBudget)

  return {
    opening,
    monthBudget,
    monthUsed,
    totalAvailable,
    totalLeft: round2(totalAvailable - monthUsed),
    openingFrom: DATA_START,
    openingComplete,
  }
}
