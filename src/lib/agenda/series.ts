/**
 * A series' occurrences as rows (owner, 30 October 2026): each occurrence is
 * the series' own row moved to its day, at the same wall-clock time in the
 * series' zone (10:00 AM in Washington stays 10:00 AM across the clock
 * change). Pure.
 */

import { fromRRule, occurrences } from './recurrence'
import { DC, instantOf, localOf } from './time'

export interface SeriesRow {
  start_date: string; end_date: string; starts_at: string | null; ends_at: string | null
  time_zone: string | null; recurrence: string | null; skip_days: string[] | null
}

const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5)

/** One occurrence of a series on `day`, as the row it would be. */
export function occurrenceOf<T extends SeriesRow>(e: T, day: string): T {
  const span = between(e.start_date, e.end_date)
  if (!e.starts_at || !e.ends_at) return { ...e, start_date: day, end_date: shift(day, span) }
  const zone = e.time_zone || DC
  const start = Date.parse(e.starts_at), len = Date.parse(e.ends_at) - start
  const at = instantOf(day, localOf(start, zone).minutes, zone)
  return { ...e, start_date: day, end_date: localOf(at + len - 1, zone).date, starts_at: new Date(at).toISOString(), ends_at: new Date(at + len).toISOString() }
}

/** The occurrences of a series between two days (both included), with their day; a row that is not a series comes back as it is. */
export function expandSeries<T extends SeriesRow>(e: T, from: string, to: string): { row: T; day: string | null }[] {
  const rule = fromRRule(e.recurrence)
  if (!rule) return [{ row: e, day: null }]
  return occurrences(rule, e.start_date, from, to, new Set(e.skip_days ?? [])).map(day => ({ row: occurrenceOf(e, day), day }))
}
