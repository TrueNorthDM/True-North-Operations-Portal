/**
 * The sentences of Clocky's bell rows that name a person and their hours
 * (README "Time correction requests and approvals", Clock Safety.dc.html
 * frames N3 and N4). Pure: lib/timeclock/clocky-notify.ts sends them.
 */

import { dayLabel, timeLabel } from './format'
import { formatDuration } from './rounding'

/** N3: "Samuel Manzi asked to add time: 1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM." */
export const correctionRequestedText = (name: string, r: { started_at: string; ended_at: string; entry_date: string }, zone: string): string =>
  `${name} asked to add time: ${formatDuration((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000)} on ${dayLabel(r.entry_date)}, ${timeLabel(r.started_at, zone)} to ${timeLabel(r.ended_at, zone)}.`

/**
 * N4: "Rock Kai approved your added time: 1h 30m on Wed, Oct 14. It now
 * counts in your hours." / "Rock Kai denied your request to add time for Thu, Oct 8
 * (0h 30m). Reason: "That half hour is already in your Oct 8 entries.""
 */
export function correctionDecidedText(decider: string, r: { started_at: string; ended_at: string; entry_date: string }, approved: boolean, note: string | null): string {
  const d = formatDuration((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000)
  return approved
    ? `${decider} approved your added time: ${d} on ${dayLabel(r.entry_date)}. It now counts in your hours.`
    : `${decider} denied your request to add time for ${dayLabel(r.entry_date)} (${d}). Reason: "${(note ?? '').trim()}"`
}

/** "Dave Sharpe approved your time off: Vacation, Fri, Oct 16 (8h 00m)." or denied, with the reason. */
export function timeOffDecidedText(decider: string, kind: string, startDate: string, endDate: string, seconds: number, approved: boolean, note: string | null): string {
  const days = startDate === endDate ? dayLabel(startDate) : `${dayLabel(startDate)} to ${dayLabel(endDate)}`
  return approved
    ? `${decider} approved your time off: ${kind}, ${days} (${formatDuration(seconds)}).`
    : `${decider} denied your time off: ${kind}, ${days}. Reason: "${(note ?? '').trim()}"`
}

/** "Dave Sharpe clocked you out at 3:45 PM. Reason: "Forgot to clock out."" */
export function clockedOutForText(by: string, at: string, reason: string): string {
  return `${by} clocked you out at ${at}. Reason: "${reason.trim()}"`
}

/** "Samuel Manzi submitted October 2026 (168h 30m)." to the Super Admins who approve it. */
export function timesheetSubmittedText(name: string, period: string, seconds: number): string {
  return `${name} submitted ${period} (${formatDuration(seconds)}).`
}

/** To the person: approved, returned with the reason, or reopened with the reason. */
export function timesheetDecidedText(decider: string, period: string, how: 'approve' | 'return' | 'reopen', note: string | null): string {
  if (how === 'approve') return `${decider} approved your ${period} timesheet.`
  return `${decider} ${how === 'return' ? 'returned' : 'reopened'} your ${period} timesheet. Reason: "${(note ?? '').trim()}"`
}

/** "Olivia Hale asked for time off: Vacation, Fri, Oct 16 (8h 00m)." (a range names both days). */
export function timeOffRequestedText(name: string, kind: string, startDate: string, endDate: string, seconds: number): string {
  const days = startDate === endDate ? dayLabel(startDate) : `${dayLabel(startDate)} to ${dayLabel(endDate)}`
  return `${name} asked for time off: ${kind}, ${days} (${formatDuration(seconds)}).`
}

/** "We created invoice INV-2026-142 for October: $2,310.00. It waits for approval with your hours." */
export const invoiceMadeText = (number: string, month: string, total: string, withHours: boolean): string =>
  `We created invoice ${number} for ${month}: ${total}. ${withHours ? 'It waits for approval with your hours.' : 'It waits for approval.'}`

/** "INV-2026-138 (Stephanie Aguirre, $2,304.00) was approved. Ready to pay." */
export const invoiceApprovedText = (number: string, name: string, total: string): string =>
  `${number} (${name}, ${total}) was approved. Ready to pay.`

/** "INV-2026-131 (September) was paid on Oct 12, 2026. Ref. WISE-77310." */
export const invoicePaidText = (number: string, month: string, paidOn: string, ref: string | null): string =>
  `${number} (${month}) was paid on ${paidOn}.${ref ? ` Ref. ${ref}.` : ''}`

/**
 * Two steps, the hours approved (Approvals.dc.html bell): to the invoice
 * approver, "Wendy Cacka approved Samuel Manzi's October hours. Invoice
 * INV-2026-147 ($3,200.00) is waiting for you."; to the person, "Wendy Cacka
 * approved your October hours. Invoice INV-2026-147 is now with Arnaldo Oliveira."
 */
export const hoursApprovedForApproverText = (by: string, name: string, month: string, number: string, total: string): string =>
  `${by} approved ${name}'s ${month} hours. Invoice ${number} (${total}) is waiting for you.`
export const hoursApprovedForPersonText = (by: string, month: string, number: string, approver: string): string =>
  `${by} approved your ${month} hours. Invoice ${number} is now with ${approver}.`

/** Cancelling approved time off (7E), decided: "Arnaldo Oliveira cancelled your time off: Vacation, Mon, Dec 28 to Thu, Dec 31." or kept, with the reason. */
export function timeOffCancelDecidedText(decider: string, kind: string, startDate: string, endDate: string, approved: boolean, note: string | null): string {
  const days = startDate === endDate ? dayLabel(startDate) : `${dayLabel(startDate)} to ${dayLabel(endDate)}`
  return approved
    ? `${decider} cancelled your time off: ${kind}, ${days}. It came off Rippling, the team calendar and your time entries.`
    : `${decider} kept your time off: ${kind}, ${days}. Reason: "${(note ?? '').trim()}"`
}

/** "Tina Gennette asked to cancel approved time off: Vacation, Mon, Dec 28 to Thu, Dec 31. Reason: "...""  */
export function timeOffCancelAskedText(name: string, kind: string, startDate: string, endDate: string, reason: string): string {
  const days = startDate === endDate ? dayLabel(startDate) : `${dayLabel(startDate)} to ${dayLabel(endDate)}`
  return `${name} asked to cancel approved time off: ${kind}, ${days}. Reason: "${reason.trim()}"`
}
