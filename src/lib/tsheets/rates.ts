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
  /** The directory person this rate belongs to. */
  personId: string
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
export function rateFor(assignments: Assignment[], personId: string, ym: string): number {
  // `-31` is not a real date in most months, and does not need to be: as a
  // string it sits after every day of `ym` and before every day of the next
  // month, which is exactly the bound wanted.
  const monthStart = `${ym}-01`
  const monthEnd = `${ym}-31`

  let best: Assignment | null = null
  for (const a of assignments) {
    if (a.personId !== personId) continue
    if (a.from > monthEnd) continue            // starts after this month
    if (a.to && a.to < monthStart) continue    // ended before this month
    // Overlaps the month. With several, the latest one to start wins.
    if (!best || a.from > best.from) best = a
  }
  return best ? best.rate : 0
}

/**
 * Whether the report will put a cost on a person's hours in a month, and if
 * not, which of the two reasons it is.
 *
 *   'rated'    a rate covers the month, so the hours carry cost
 *   'outside'  a rate exists, but none that costs this month
 *   'none'     no rate at all
 *
 * The split matters because the two failures look identical on an invoice, both
 * costing zero, and are fixed by opposite actions: one needs a rate created,
 * the other needs the rate it already has to start earlier. Telling somebody to
 * set a rate they already set walks them straight past what is wrong.
 *
 * A rate row of zero for the month lands in 'outside'. That is honest: it also
 * costs nothing, and it is also fixed in Rates & Costs.
 */
export function rateStateFor(
  assignments: Assignment[], personId: string, ym: string,
): 'rated' | 'outside' | 'none' {
  if (rateFor(assignments, personId, ym) > 0) return 'rated'
  return assignments.some(a => a.personId === personId) ? 'outside' : 'none'
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
  const personIds = [...new Set(assignments.map(a => a.personId))]
  const counts = new Map<number, number>()
  for (const pid of personIds) {
    const r = rateFor(assignments, pid, ym)
    if (r > 0) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  let best = 0, bestCount = -1
  for (const [rate, c] of counts) {
    if (c > bestCount || (c === bestCount && rate > best)) { best = rate; bestCount = c }
  }
  return best
}
