/**
 * The working calendar the summary email follows (7 October 2026): Monday to
 * Friday, minus the US federal holidays. On a day off no summary goes out; the
 * next working day's summary covers the days in between ("what you missed").
 *
 * The holidays are worked out, not listed, so no year ever needs adding: the
 * fixed-date ones move to Friday or Monday when they fall on a weekend, the
 * way the federal government observes them. Pure, and tested.
 */

import { addDays } from './schedule'

const dow = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** The nth weekday (0 Sunday to 6 Saturday) of a month; n = -1 is the last one. */
function nth(y: number, m: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = iso(y, m, 1)
    return addDays(first, (weekday - dow(first) + 7) % 7 + (n - 1) * 7)
  }
  const last = addDays(m === 12 ? iso(y + 1, 1, 1) : iso(y, m + 1, 1), -1)
  return addDays(last, -((dow(last) - weekday + 7) % 7))
}

/** A fixed-date holiday on a Saturday is observed the Friday before, on a Sunday the Monday after. */
function observed(day: string): string {
  const w = dow(day)
  return w === 6 ? addDays(day, -1) : w === 0 ? addDays(day, 1) : day
}

const CACHE = new Map<number, Map<string, string>>()

/** The US federal holidays of a year, as observed: day -> name. */
export function usHolidays(year: number): ReadonlyMap<string, string> {
  const hit = CACHE.get(year)
  if (hit) return hit
  const list: [string, string][] = [
    [observed(iso(year, 1, 1)), "New Year's Day"],
    [nth(year, 1, 1, 3), 'Martin Luther King Jr. Day'],
    [nth(year, 2, 1, 3), "Washington's Birthday"],
    [nth(year, 5, 1, -1), 'Memorial Day'],
    [observed(iso(year, 6, 19)), 'Juneteenth'],
    [observed(iso(year, 7, 4)), 'Independence Day'],
    [nth(year, 9, 1, 1), 'Labor Day'],
    [nth(year, 10, 1, 2), 'Columbus Day'],
    [observed(iso(year, 11, 11)), 'Veterans Day'],
    [nth(year, 11, 4, 4), 'Thanksgiving Day'],
    [observed(iso(year, 12, 25)), 'Christmas Day'],
  ]
  const out = new Map(list)
  // New Year's Day of the next year can be observed on 31 December of this one.
  const nextNewYear = observed(iso(year + 1, 1, 1))
  if (nextNewYear.startsWith(String(year))) out.set(nextNewYear, "New Year's Day")
  CACHE.set(year, out)
  return out
}

/** The holiday a day is, if any. */
export function holidayOn(day: string): string | null {
  return usHolidays(Number(day.slice(0, 4))).get(day) ?? null
}

/** A day the summary email goes out on. */
export function isWorkingDay(day: string): boolean {
  const w = dow(day)
  return w !== 0 && w !== 6 && !holidayOn(day)
}

/** The working day before this one. */
export function previousWorkingDay(day: string): string {
  let d = addDays(day, -1)
  while (!isWorkingDay(d)) d = addDays(d, -1)
  return d
}

export interface MissedDay { day: string; holiday: string | null }

/** The days off between the last working day and this one: what a catch-up summary covers. */
export function missedDays(day: string): MissedDay[] {
  const out: MissedDay[] = []
  for (let d = addDays(previousWorkingDay(day), 1); d < day; d = addDays(d, 1)) out.push({ day: d, holiday: holidayOn(d) })
  return out
}
