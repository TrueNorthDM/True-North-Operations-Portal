/**
 * Two-week cycles: how a board whose target is set per two weeks is counted
 * (approved 15 October 2026, for Bessemeters).
 *
 * The rule, in one place. public/boards.html counts in its own JavaScript and
 * carries an exact copy of it (its "CYCLES" block); change both together.
 *
 *   cadence   per board, not per language: every week (the default), or every
 *             two weeks from a start Monday (sites.target_cycle_weeks and
 *             sites.target_cycle_start, migration 111). Two weeks without a
 *             start is weekly.
 *   cycles    Monday to the Sunday thirteen days later, New York calendar
 *             days: [start + 14k, start + 14k + 13]. There is no cycle before
 *             the start.
 *   target    a whole number of pages per cycle. The one in force for a cycle
 *             is the one in force in the cycle's first week: the target
 *             history (publishing_target_periods) stays keyed by week.
 *   periods   a period counts every cycle it touches, whole: the target is the
 *             sum of those cycles' targets and done is every page published
 *             inside them, even on days outside the period. A cycle that has
 *             not ended yet is in progress.
 *
 * Pure: calendar days in, calendar days out ("YYYY-MM-DD"). Turning a day into
 * an instant is publishing-rules.ts's job (cycleBounds), which keeps the New
 * York clock in one file.
 */

import { addDays, weekOf } from '@/lib/notifications/schedule'
import { MONTH_SHORT } from '@/lib/format/months'

export interface Cadence {
  /** 1 for a weekly target, 2 for a target per two-week cycle. */
  weeks: 1 | 2
  /** The Monday the first cycle starts, YYYY-MM-DD; null for a weekly board. */
  start: string | null
}

export const WEEKLY: Cadence = { weeks: 1, start: null }

/** One cycle as calendar days: its Monday and the Sunday it ends. */
export interface Cycle {
  start: string
  end: string
}

export const CYCLE_DAYS = 14

const DAY_MS = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A cadence from what the sites row holds. Two weeks needs a real start day;
 * a start that is not a Monday is moved back to its Monday, so a hand-edited
 * row cannot shift the cycles off the weeks the targets are kept by.
 */
export function toCadence(weeks: unknown, start: unknown): Cadence {
  if (Number(weeks) !== 2 || typeof start !== 'string') return WEEKLY
  const day = start.slice(0, 10)
  if (!ISO_DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return WEEKLY
  return { weeks: 2, start: weekOf(day) }
}

/** Whether a board is counted in two-week cycles. */
export function isCycled(c: Cadence | null | undefined): c is { weeks: 2; start: string } {
  return !!c && c.weeks === 2 && !!c.start
}

const dayIndex = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** The cycle a calendar day falls in, or null before the first cycle (or on a weekly board). */
export function cycleOf(c: Cadence, day: string): Cycle | null {
  if (!isCycled(c) || day < c.start) return null
  const k = Math.floor((dayIndex(day) - dayIndex(c.start)) / CYCLE_DAYS)
  const start = addDays(c.start, k * CYCLE_DAYS)
  return { start, end: addDays(start, CYCLE_DAYS - 1) }
}

/**
 * Every cycle a span of calendar days touches, whole, oldest first. `first`
 * null means from the very first cycle ("all time"). Days before the start
 * touch nothing.
 */
export function cyclesTouching(c: Cadence, first: string | null, last: string): Cycle[] {
  if (!isCycled(c)) return []
  const from = first === null || first < c.start ? c.start : first
  if (last < from) return []
  const out: Cycle[] = []
  for (let cy = cycleOf(c, from); cy && cy.start <= last; cy = { start: addDays(cy.start, CYCLE_DAYS), end: addDays(cy.end, CYCLE_DAYS) }) {
    out.push(cy)
  }
  return out
}

/** Not ended yet on this day (New York): the cycle is in progress. */
export const inProgress = (cycle: Cycle, today: string) => cycle.end >= today

/**
 * The last `n` cycles that have ended by `today`, oldest first. Fewer, or
 * none, while the board is new.
 */
export function lastCompleteCycles(c: Cadence, today: string, n: number): Cycle[] {
  if (!isCycled(c)) return []
  const current = cycleOf(c, today)
  // Before the start, nothing has ended; otherwise the cycles before today's.
  if (!current) return []
  const out: Cycle[] = []
  for (let k = n; k >= 1; k--) {
    const start = addDays(current.start, -k * CYCLE_DAYS)
    if (start >= c.start) out.push({ start, end: addDays(start, CYCLE_DAYS - 1) })
  }
  return out
}

/** The Sunday the first cycle ends, for "First cycle ends Oct 26". */
export function firstCycleEnd(c: Cadence): string | null {
  return isCycled(c) ? addDays(c.start, CYCLE_DAYS - 1) : null
}

/**
 * The targets a span of cycles is held to, per language: each cycle at the
 * target in force in its first week, added up. `targetsAt` answers for a
 * Monday (publishing-rules.ts targetsForWeek, for one board).
 */
export function cycleTargets(cycles: Cycle[], targetsAt: (monday: string) => Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const cy of cycles) {
    for (const [lang, n] of Object.entries(targetsAt(cy.start))) out[lang] = (out[lang] ?? 0) + n
  }
  return out
}

/** "Oct 9", short month, en-US, from a calendar day. */
export function shortDay(iso: string): string {
  return `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}

/** "Sep 29 to Oct 12". */
export function cycleLabel(cycle: Cycle): string {
  return `${shortDay(cycle.start)} to ${shortDay(cycle.end)}`
}

/**
 * Working days of a cycle already gone on `today`, 0 to 10: on Thursday of
 * its first week, 3; on Monday of its second, 5. The weekend counts its week
 * whole, as the weekly rule does (generators.ts expectedSoFar).
 */
export function workingDaysGone(cycle: Cycle, today: string): number {
  if (today < cycle.start) return 0
  if (today > cycle.end) return 10
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const inWeek = dow === 0 || dow === 6 ? 5 : dow - 1
  const secondWeek = today >= addDays(cycle.start, 7)
  return (secondWeek ? 5 : 0) + inWeek
}
