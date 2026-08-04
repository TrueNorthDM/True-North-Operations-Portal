/**
 * Which hourly rate applies to a person in a given month.
 *
 * Extracted from report-data.ts, which loads from the database and cannot be
 * tested without mocking it. These two functions decide EVERY currency figure
 * on the Clients Report, the one artefact in this portal that leaves the
 * building and reaches a client, and until now neither had a test.
 *
 * Dates are compared as ISO strings throughout. That is deliberate and safe:
 * `YYYY-MM-DD` sorts lexicographically in the same order it sorts
 * chronologically, so no parsing, no timezone, and no Date object that shifts
 * a day when the server is not in UTC.
 */

export interface Assignment {
  userId: number
  rate: number
  /** effective_from, YYYY-MM-DD. */
  from: string
  /** effective_to, YYYY-MM-DD, or null while the assignment is open. */
  to: string | null
}

/**
 * The rate for a user during `ym` (YYYY-MM), honouring rate history.
 *
 * Returns 0 when no assignment covers that person and month, which the report
 * then multiplies into a cost of zero. That is worth knowing: hours logged by
 * someone with no rate row still count as hours, and cost nothing, so the
 * budget reads as less consumed than it is. Nothing in the UI flags it today
 * (audit finding M3-1).
 *
 * A rate that takes effect mid-month applies to the WHOLE month, because one
 * month resolves to one rate. Rates are meant to be dated to the first of a
 * month; nothing enforces it (audit finding M3-2).
 */
export function rateFor(assignments: Assignment[], userId: number, ym: string): number {
  // `-31` is not a real date in most months, and does not need to be: as a
  // string it sits after every day of `ym` and before every day of the next
  // month, which is exactly the bound wanted.
  const monthStart = `${ym}-01`
  const monthEnd = `${ym}-31`

  let best: Assignment | null = null
  for (const a of assignments) {
    if (a.userId !== userId) continue
    if (a.from > monthEnd) continue            // starts after this month
    if (a.to && a.to < monthStart) continue    // ended before this month
    // Overlaps the month. With several, the latest one to start wins.
    if (!best || a.from > best.from) best = a
  }
  return best ? best.rate : 0
}

/**
 * The "standard" rate for a month: the one the most people are on.
 *
 * Used as a single headline figure (e.g. "$95/h") and to estimate how many
 * hours a budget covers. Ties break towards the HIGHER rate, so the estimate
 * errs on the side of fewer hours rather than promising more than the budget
 * buys. People with no rate are ignored rather than counted as zero, which
 * would otherwise drag the headline down to 0 as soon as one person is
 * missing a rate row.
 */
export function standardI7Rate(assignments: Assignment[], ym: string): number {
  const userIds = [...new Set(assignments.map(a => a.userId))]
  const counts = new Map<number, number>()
  for (const uid of userIds) {
    const r = rateFor(assignments, uid, ym)
    if (r > 0) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  let best = 0, bestCount = -1
  for (const [rate, c] of counts) {
    if (c > bestCount || (c === bestCount && rate > best)) { best = rate; bestCount = c }
  }
  return best
}
