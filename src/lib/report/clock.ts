// The Report's calendar: New York days, and working time.
//
// Two rules, both decided in the audit of 9 October 2026:
//
//   "Today" is the New York day, as on My Work and Clocky. Counted on the
//   UTC day, a step due today read as late from 8pm New York time, and the
//   Report showed more late work than My Work did.
//
//   Held time counts working time only: Monday to Friday, minus the US
//   federal holidays (the calendar the summary email follows). A step that
//   lands on Friday at 5pm and is done on Monday at 10am was held for 17 hours
//   of working days, about 0.7 of a day, not three days. The Report measures
//   how long work sat with someone, and a weekend is not them sitting on it.
//
// Pure: no database, no React.

import { isWorkingDay } from '@/lib/notifications/calendar'
import { addDays, zoneDate, zoneTime } from '@/lib/notifications/schedule'
import { formatDate } from '@/lib/directory/people-types'

export const REPORT_ZONE = 'America/New_York'

const DAY = 86_400_000

/** Today in New York, as YYYY-MM-DD. */
export function reportToday(now: Date = new Date()): string {
  return zoneDate(now, REPORT_ZONE)
}

/** A moment as the portal writes a date ("Oct 9, 2026"), on the New York day. */
export function reportDate(iso: string | Date): string {
  return formatDate(zoneDate(typeof iso === 'string' ? new Date(iso) : iso, REPORT_ZONE)) ?? ''
}

/** The day a period starts on: `days` New York days before today. */
export function periodStartDay(days: number, now: Date = new Date()): string {
  return addDays(reportToday(now), -days)
}

/** The instant a period starts: midnight in New York on its first day. */
export function periodStart(days: number, now: Date = new Date()): Date {
  return zoneTime(periodStartDay(days, now), 0, REPORT_ZONE)
}

/**
 * Working days between two moments, to a tenth of a day.
 *
 * Every New York day the span touches is counted for the part of it the span
 * covers, and only if it is a working day. Never negative.
 */
export function workingDaysBetween(from: string, to: string): number {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!(end > start)) return 0

  let ms = 0
  const last = zoneDate(new Date(end), REPORT_ZONE)
  for (let day = zoneDate(new Date(start), REPORT_ZONE); day <= last; day = addDays(day, 1)) {
    if (!isWorkingDay(day)) continue
    const dayStart = zoneTime(day, 0, REPORT_ZONE).getTime()
    const dayEnd = zoneTime(addDays(day, 1), 0, REPORT_ZONE).getTime()
    ms += Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart))
  }
  return Math.round((ms / DAY) * 10) / 10
}

/**
 * Days past the deadline, counted in New York: a step due on the 9th is on
 * time until midnight on the 9th in New York.
 *
 * Null when there was no deadline: a step with no due date is not on time and
 * not late, and counting it as on time would inflate the share with steps
 * nobody ever set a date for. A year typed wrong (202, 20226) is no deadline
 * either, the rule My Work follows for "late now".
 */
export function lateness(doneAt: string, dueDate: string | null): number | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null
  const year = Number(dueDate.slice(0, 4))
  if (year < 2000 || year > 2100) return null
  const due = zoneTime(addDays(dueDate, 1), 0, REPORT_ZONE).getTime()
  if (Number.isNaN(due)) return null
  return Math.max(0, Math.ceil((Date.parse(doneAt) - due) / DAY))
}
