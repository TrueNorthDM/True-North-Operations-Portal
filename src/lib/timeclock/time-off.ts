/**
 * Time off, part 2 (Requests.dc.html 7A to 7E): the days a request counts,
 * the rows of My time off and the drawer that says what happened by itself
 * after the approval (Rippling, the team calendar, the time entries). Pure:
 * time-off-data.ts reads, the page and the actions use these.
 *
 * The company holidays are the company holiday list the Agenda shows; today
 * that list is the US federal holidays the portal already keeps
 * (notifications/calendar.ts). They are off for everyone and never asked for.
 */

import { usHolidays } from '@/lib/notifications/calendar'
import { dayLabel } from './format'
import { formatDuration } from './rounding'

const DAY = 86_400_000
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const fromDay = (t: number) => new Date(t).toISOString().slice(0, 10)

/** The company holidays between two days, both included: day -> name. */
export function holidaysBetween(from: string, to: string): Map<string, string> {
  const out = new Map<string, string>()
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const [d, name] of usHolidays(y)) if (d >= from && d <= to) out.set(d, name)
  }
  return out
}

/** The days a request counts (weekdays that are not company holidays), and the weekday holidays it skips. */
export function offDays(start: string, end: string, holidays: ReadonlyMap<string, string>): { days: string[]; skipped: string[] } {
  const days: string[] = []
  const skipped: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return { days, skipped }
  for (let t = toDay(start); t <= toDay(end) && days.length <= 366; t += DAY) {
    const d = fromDay(t)
    const w = new Date(t).getUTCDay()
    if (w === 0 || w === 6) continue
    if (holidays.has(d)) { skipped.push(d); continue }
    days.push(d)
  }
  return { days, skipped }
}

/** "Mon, Nov 23 to Wed, Nov 25" or "Fri, Oct 16". */
export const daysText = (a: string, b: string): string => (a === b ? dayLabel(a) : `${dayLabel(a)} to ${dayLabel(b)}`)

/** "3 working days, 24h 00m" */
export const countText = (days: number, seconds: number): string => `${days} working day${days === 1 ? '' : 's'}, ${formatDuration(seconds)}`

export type OffTone = 'ok' | 'warn' | 'bad' | 'neu'
export type OffState = 'pending' | 'approved' | 'denied' | 'cancelled'

export interface OffRequest {
  id: number
  personId: string
  who: string
  type: string
  start: string
  end: string
  hoursPerDay: number
  state: OffState
  note: string | null
  askedAt: string
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
  rippling: 'waiting_connection' | 'queued' | 'sent' | 'refused' | null
  ripplingError: string | null
  ripplingSentAt: string | null
  calendar: 'waiting_connection' | 'queued' | 'done' | 'failed' | null
  entriesWrittenAt: string | null
  cancelAskedAt: string | null
  cancelReason: string | null
}

export interface OffCheck { t: string; tone: OffTone; icon: 'check' | 'x' | 'clock' }

/** The chips of a row in My time off (7B). */
export function checksOf(r: OffRequest): OffCheck[] {
  if (r.state === 'pending') return [{ t: 'A Super Admin decides', tone: 'neu', icon: 'clock' }]
  if (r.cancelAskedAt) return [{ t: 'Waiting for a Super Admin', tone: 'neu', icon: 'clock' }]
  const rip: OffCheck = r.rippling === 'sent' ? { t: 'Sent to Rippling', tone: 'ok', icon: 'check' }
    : r.rippling === 'refused' ? { t: 'Rippling refused it', tone: 'bad', icon: 'x' }
      : { t: 'Waiting for Rippling', tone: 'neu', icon: 'clock' }
  const cal: OffCheck = r.calendar === 'done' ? { t: 'On the team calendar', tone: 'ok', icon: 'check' }
    : r.calendar === 'failed' ? { t: 'Not on the calendar', tone: 'bad', icon: 'x' }
      : { t: 'Waiting for the calendar', tone: 'neu', icon: 'clock' }
  return [rip, cal]
}

/** The state pill: Waiting, Cancellation asked, Approved (with Rippling's refusal on the drawer). */
export function pillOf(r: OffRequest): { label: string; tone: OffTone } {
  if (r.state === 'pending') return { label: 'Waiting', tone: 'warn' }
  if (r.cancelAskedAt) return { label: 'Cancellation asked', tone: 'warn' }
  return { label: 'Approved', tone: 'ok' }
}

export interface OffStep { t: string; sub: string; state: 'ok' | 'bad' | 'wait'; retry: boolean }

/** "What happened by itself" (7D, 7D-x). */
export function stepsOf(r: OffRequest, x: { days: number; seconds: number; stamp: (t: string) => string; canRetry: boolean }): OffStep[] {
  if (r.state === 'pending') return [{ t: 'Nothing yet', sub: 'When a Super Admin approves: Rippling, the team calendar and the time entries, by themselves.', state: 'wait', retry: false }]
  const first = r.who.split(' ')[0]
  const rip: OffStep = r.rippling === 'sent'
    ? { t: `Sent to Rippling, ${r.ripplingSentAt ? x.stamp(r.ripplingSentAt) : ''}`.replace(/, $/, ''), sub: `${formatDuration(x.seconds)} of ${r.type}, by day, for payroll.`, state: 'ok', retry: false }
    : r.rippling === 'refused'
      ? { t: `Rippling refused it${r.ripplingError ? `: "${r.ripplingError}"` : ''}`, sub: `Fix ${/balance/i.test(r.ripplingError ?? '') ? 'the balance' : 'it'} in Rippling, then try again. Payroll does not have ${x.days === 1 ? 'this day' : 'these days'} yet.`, state: 'bad', retry: x.canRetry }
      : r.rippling === 'queued'
        ? { t: 'Being sent to Rippling', sub: `${formatDuration(x.seconds)} of ${r.type}, by day, for payroll. It goes in the next few minutes.`, state: 'wait', retry: false }
        : { t: 'Waiting for Rippling', sub: 'Rippling is not connected yet. It is sent by itself once a Super Admin connects it in Company settings, Integrations.', state: 'wait', retry: false }
  const cal: OffStep = r.calendar === 'done'
    ? { t: 'On the team calendar', sub: `"${r.who}, out" on ${daysText(r.start, r.end)}. Agenda shows it to everyone; the type only to Super Admins and ${first}.`, state: 'ok', retry: false }
    : r.calendar === 'failed'
      ? { t: 'Not on the team calendar', sub: 'Google Calendar refused it. A Super Admin can try again from Company settings, Integrations.', state: 'bad', retry: false }
      : { t: r.calendar === 'queued' ? 'Going on the team calendar' : 'Waiting for Google Calendar', sub: r.calendar === 'queued' ? `"${r.who}, out" on ${daysText(r.start, r.end)}, in the next few minutes.` : 'Google Calendar is not connected yet. It goes on the team calendar by itself once a Super Admin connects it.', state: 'wait', retry: false }
  const ent: OffStep = r.entriesWrittenAt
    ? { t: 'Written into the time entries', sub: `${x.days} day${x.days === 1 ? '' : 's'} of ${r.type}, ${formatDuration(x.seconds / Math.max(1, x.days))} each.`, state: 'ok', retry: false }
    : { t: 'Not written into the time entries yet', sub: 'North Time writes the days when the request is approved.', state: 'wait', retry: false }
  return [rip, cal, ent]
}

/** The drawer's history, newest first. */
export function historyOf(r: OffRequest, x: { stamp: (t: string) => string; nameOf: (id: string | null) => string }): { t: string; when: string; dot: string }[] {
  const out: { t: string; when: string; dot: string }[] = [{ t: `Asked by ${r.who}`, when: x.stamp(r.askedAt), dot: '#1E7D7F' }]
  if (r.decidedAt && (r.state === 'approved' || r.state === 'cancelled' || r.cancelAskedAt)) out.push({ t: `Approved by ${x.nameOf(r.decidedBy)}`, when: x.stamp(r.decidedAt), dot: '#012358' })
  if (r.state === 'denied' && r.decidedAt) out.push({ t: `Denied by ${x.nameOf(r.decidedBy)}${r.decisionNote ? `: "${r.decisionNote}"` : ''}`, when: x.stamp(r.decidedAt), dot: '#c8323d' })
  if (r.cancelAskedAt) out.push({ t: `Cancellation asked by ${r.who}${r.cancelReason ? `: "${r.cancelReason}"` : ''}`, when: x.stamp(r.cancelAskedAt), dot: '#d4a017' })
  return out.reverse()
}
