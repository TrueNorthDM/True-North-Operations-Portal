/**
 * The Home card for a timesheet to send (owner, 25 October 2026): from the day
 * a person's period closes (the last day of the month, or of the pay period)
 * until they send it. "Closes today" on its last day, "N days late" after.
 *
 * Only for whoever keeps their hours in the portal in that period (time logged
 * there, as the late reminders count it), and never for someone paid a fixed
 * amount with no timesheet. Read on the server for Home; a read that fails
 * leaves the card out, never a wrong date.
 */

import { db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor } from './clocky-context'
import { loadSubmissions } from './clocky-store'
import { entrySeconds } from './clocky-panel'
import { localDate } from './format'
import { loadPayTerms } from './pay-terms'
import { addDays, daysBetween, isSent, periodContaining, periodLabel, type SubmittedPeriod } from './periods'
import { formatDuration } from './rounding'

export interface HomeTimesheet {
  state: 'today' | 'late'
  /** Days since it closed, 0 on the day. */
  days: number
  /** "October", "Oct 4 to 17". */
  label: string
  /** "October 2026", "Oct 4 to 17, 2026". */
  full: string
  start: string
  end: string
  hours: string
}

/** Which period the card is about, if any: the one closing today, else the last one still not sent. */
export function dueTimesheet(today: string, cur: { start: string; end: string }, prev: { start: string; end: string },
  sent: readonly SubmittedPeriod[], logged: (p: { start: string; end: string }) => boolean): { state: 'today' | 'late'; period: { start: string; end: string }; days: number } | null {
  const isOut = (p: { start: string; end: string }) => sent.some(s => s.start === p.start && s.end === p.end && isSent(s.state))
  if (cur.end === today && !isOut(cur) && logged(cur)) return { state: 'today', period: cur, days: 0 }
  if (!isOut(prev) && logged(prev)) return { state: 'late', period: prev, days: daysBetween(prev.end, today) }
  return null
}
