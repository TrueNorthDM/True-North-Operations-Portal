/**
 * The company's working calendar: Monday to Friday, minus the company
 * holidays. It is the one list every part of the portal reads: the days a
 * time off request counts, the holidays on the Agenda, the reminders and the
 * summary email (on a day off no summary goes out; the next working day's
 * covers the days in between, "what you missed").
 *
 * The company holidays are the employee handbook's (section 16, Company
 * Holidays; Tina, 2 November 2026, applied by the owner 5 November 2026),
 * seven days: New Year's Day, Memorial Day, Independence Day, Labor Day,
 * Thanksgiving Day, the day after Thanksgiving and Christmas Day. Until then
 * the portal used the 11 US federal holidays.
 *
 * They are worked out, not listed, so no year ever needs adding: a fixed-date
 * one that falls on a Saturday is observed the Friday before, on a Sunday the
 * Monday after, as the handbook says. Pure, and tested.
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

/** The company holidays of a year, as observed: day -> name. */
export function companyHolidays(year: number): ReadonlyMap<string, string> {
  const hit = CACHE.get(year)
  if (hit) return hit
  const thanksgiving = nth(year, 11, 4, 4)
  const list: [string, string][] = [
    [observed(iso(year, 1, 1)), "New Year's Day"],
    [nth(year, 5, 1, -1), 'Memorial Day'],
    [observed(iso(year, 7, 4)), 'Independence Day'],
    [nth(year, 9, 1, 1), 'Labor Day'],
    [thanksgiving, 'Thanksgiving Day'],
    [addDays(thanksgiving, 1), 'Day after Thanksgiving'],
    [observed(iso(year, 12, 25)), 'Christmas Day'],
  ]
  const out = new Map(list)
  // New Year's Day of the next year can be observed on 31 December of this one.
  const nextNewYear = observed(iso(year + 1, 1, 1))
  if (nextNewYear.startsWith(String(year))) out.set(nextNewYear, "New Year's Day")
  CACHE.set(year, out)
  return out
}

/** The name every caller used while the list was the federal one: the same company holidays. */
export const usHolidays = companyHolidays

/** The holiday a day is, if any. */
export function holidayOn(day: string): string | null {
  return companyHolidays(Number(day.slice(0, 4))).get(day) ?? null
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
