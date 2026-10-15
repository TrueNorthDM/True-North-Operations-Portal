/**
 * The four ways a client report can be asked for a stretch of time.
 *
 * The Full history export had three: a calendar year, the last twelve months,
 * or months you pick. The i7 report needs a fourth, one month, because that is
 * the shape a pay period is and the shape the PDF is: a month is what gets sent
 * to the client, and the report opens on the current one for that reason.
 *
 * Kept apart from the control that draws it so both ends can agree on what a
 * choice means: the button labels it, the page turns it into a URL, the loader
 * turns it into a date range, and a test can check all three without a browser.
 *
 * January 2026 is the floor everywhere. tc_entries holds hours back to 2017,
 * but budgets and rates start in 2026, so an earlier month would pair real
 * hours with zero money and read as a month where nothing was spent.
 */

import { MONTH_LONG, MONTH_SHORT } from '@/lib/format/months'

export type RangeMode = 'month' | 'year' | 'last12' | 'custom'

/** What the filter is set to. One field per mode, so switching back and forth keeps each answer. */
export interface RangeChoice {
  mode: RangeMode
  month: string
  year: string
  from: string
  to: string
}

export interface Range {
  from: string
  to: string
}

export const RANGE_FLOOR = '2026-01'

/** "2026-09" → "Sep 2026". */
export function shortMonth(ym: string): string {
  return `${MONTH_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
}

/** The month `by` months after `ym` (negative goes back). */
export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7)
}

/**
 * The months a choice covers, clamped to the floor and to the current month.
 *
 * Clamped here rather than only where it is used. A boundary enforced in one
 * place is a boundary somebody else meets as an error.
 */
export function rangeOf(c: RangeChoice, currentMonth: string, floor = RANGE_FLOOR): Range {
  const clamp = (ym: string) => (ym < floor ? floor : ym > currentMonth ? currentMonth : ym)
  switch (c.mode) {
    case 'month':
      return { from: clamp(c.month), to: clamp(c.month) }
    case 'year': {
      const last = c.year === currentMonth.slice(0, 4) ? currentMonth : `${c.year}-12`
      return { from: clamp(`${c.year}-01`), to: clamp(last) }
    }
    case 'last12':
      return { from: clamp(shiftMonth(currentMonth, -11)), to: currentMonth }
    case 'custom':
      return { from: clamp(c.from), to: clamp(c.to) }
  }
}

/** A range of one month is the only one a monthly document can be made from. */
export function isSingleMonth(r: Range): boolean {
  return r.from === r.to
}

/** What the filter button says it is showing. */
export function rangeLabel(c: RangeChoice, currentMonth: string, floor = RANGE_FLOOR): string {
  const r = rangeOf(c, currentMonth, floor)
  if (c.mode === 'year') return c.year
  if (isSingleMonth(r)) return shortMonth(r.from)
  return `${shortMonth(r.from)} to ${shortMonth(r.to)}`
}

/**
 * The choice a range came from, so a link into the report reopens the filter
 * saying what it is showing rather than "choose the months" over every range.
 *
 * Order matters: a single month is read as one month even when it is also
 * January of the current year, because that is the narrower thing to have
 * meant, and it is the only one that keeps the PDF available.
 */
export function choiceFromRange(from: string, to: string, currentMonth: string): RangeChoice {
  const base: RangeChoice = {
    mode: 'custom',
    month: currentMonth,
    year: currentMonth.slice(0, 4),
    from,
    to,
  }
  if (from === to) return { ...base, mode: 'month', month: from }

  const year = from.slice(0, 4)
  const yearEnd = year === currentMonth.slice(0, 4) ? currentMonth : `${year}-12`
  if (from === `${year}-01` && to === yearEnd) return { ...base, mode: 'year', year }

  if (from === shiftMonth(currentMonth, -11) && to === currentMonth) return { ...base, mode: 'last12' }

  return base
}

/** The choice the report opens on: this month, nothing else chosen yet. */
export function defaultChoice(currentMonth: string): RangeChoice {
  return {
    mode: 'month',
    month: currentMonth,
    year: currentMonth.slice(0, 4),
    from: shiftMonth(currentMonth, -11),
    to: currentMonth,
  }
}

/**
 * A range as a report heading says it, in the wording a single month already
 * used: "September 2026", "January to September 2026", "October 2025 to
 * September 2026". The year is said once when both ends share it.
 */
export function spanWording(from: string, to: string): string {
  const fm = MONTH_LONG[Number(from.slice(5, 7)) - 1], fy = from.slice(0, 4)
  const tm = MONTH_LONG[Number(to.slice(5, 7)) - 1], ty = to.slice(0, 4)
  if (from === to) return `${tm} ${ty}`
  return fy === ty ? `${fm} to ${tm} ${ty}` : `${fm} ${fy} to ${tm} ${ty}`
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * A range out of URL parameters, which is to say out of anything at all.
 *
 * Everything that can be wrong here has been typed by hand into an address bar
 * or kept in a bookmark from before a month existed: a missing half, a reversed
 * pair, a month in 2019, a month next year, "?from=yes". None of them is worth
 * an error page on a report, so each collapses to the nearest sensible range
 * and the last resort is the month the report opens on.
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  currentMonth: string,
  floor = RANGE_FLOOR,
): Range {
  const one = { from: currentMonth, to: currentMonth }
  const f = from && YM.test(from) ? from : undefined
  const t = to && YM.test(to) ? to : undefined
  if (!f && !t) return one
  // Half a range is a month: a link carrying only one end asked for that month.
  const asked = { from: f ?? t!, to: t ?? f! }
  if (asked.from > asked.to) return one
  const r = rangeOf(choiceFromRange(asked.from, asked.to, currentMonth), currentMonth, floor)
  return r.from <= r.to ? r : one
}
