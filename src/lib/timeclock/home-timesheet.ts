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

export async function loadHomeTimesheet(personId: string, now = new Date()): Promise<HomeTimesheet | null> {
  const c = db()
  const [dir, settings, changes, subs, terms] = await Promise.all([
    loadDirectory(), loadClockySettings(), loadCadenceChanges(c, [personId]), loadSubmissions(c, [personId]), loadPayTerms([personId]),
  ])
  if (!dir.people.has(personId) || terms.get(personId)?.paysAs === 'fixed_no_timesheet') return null
  const today = localDate(now, dir.zoneOf(personId))
  const rules = rulesFor(personId, changes, settings)
  const cur = periodContaining(today, rules)
  const prev = periodContaining(addDays(cur.start, -1), rules)
  const { data, error } = await c.from('tc_entries').select('entry_date, started_at, ended_at, duration_seconds, kind, source')
    .eq('person_id', personId).gte('entry_date', prev.start).lte('entry_date', cur.end)
  if (error) throw new Error(`Time entries could not be read: ${error.message}`)
  const rows = data ?? []
  const within = (p: { start: string; end: string }) => rows.filter(r => r.entry_date >= p.start && r.entry_date <= p.end)
  const due = dueTimesheet(today, cur, prev, subs.get(personId) ?? [], p => within(p).some(r => r.source === 'portal'))
  if (!due) return null
  const seconds = within(due.period).filter(r => r.kind !== 'absence').reduce((n, r) => n + entrySeconds(r as Parameters<typeof entrySeconds>[0], now), 0)
  const l = periodLabel(due.period)
  return { state: due.state, days: due.days, label: l.label, full: l.full, start: due.period.start, end: due.period.end, hours: formatDuration(seconds) }
}
