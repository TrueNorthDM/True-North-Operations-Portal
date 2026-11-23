/**
 * Time off asked after the fact (owner, 23 November 2026). Time off is asked
 * before it starts; days already gone are for emergencies only, and harder
 * to ask on purpose:
 *
 *   which kinds   Sick and Unpaid Time Off; Vacation is always asked ahead
 *   how far back  the days whose timesheet has not been sent yet, and never
 *                 before the person started on North Time
 *   a reason      required, and shown to whoever decides
 *   the count     the decider sees how many this person asked this year
 *
 * Plain rules, tested without a database: the request action, the form's data
 * and the approval cards all ask here.
 */

import { addDays, isSent, type SubmittedPeriod } from './periods'
import { offKindOf } from './time-off-year'

/** A kind of time off that may be asked for days already gone. */
export const lateKind = (job: { name: string; kind: string } | null | undefined): boolean => {
  const k = job ? offKindOf(job) : null
  return k === 'sick' || k === 'unpaid'
}

/**
 * The earliest day that can still be asked: the day after the last timesheet
 * sent (a sent timesheet closes its days), or the day they started on North
 * Time, whichever is later. Null: no day already gone can be asked.
 */
export function earliestLateDay(startsOn: string | null, submissions: readonly SubmittedPeriod[], today: string): string | null {
  if (!startsOn || startsOn >= today) return null
  const sent = submissions.filter(s => isSent(s.state)).map(s => s.end).sort()
  const afterSent = sent.length ? addDays(sent[sent.length - 1], 1) : null
  const from = afterSent && afterSent > startsOn ? afterSent : startsOn
  return from < today ? from : null
}

/** Asked on a later day than it starts, on the person's own calendar. */
export const askedLate = (askedOn: string, start: string): boolean => askedOn > start

/** "1st", "2nd", "3rd", "4th": which one of the year this is. */
export function ordinal(n: number): string {
  const t = n % 100, u = n % 10
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`
}

export const LATE_TAG = 'Asked after the fact'
export const LATE_KINDS_LINE = 'Only Sick and Unpaid Time Off can be asked for days already gone. Vacation is asked before it starts.'
export const LATE_REASON_NEEDED = 'Say why it was not asked before: these days are already gone, and whoever decides reads it.'
