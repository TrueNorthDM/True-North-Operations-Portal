/**
 * Clock safety's data (design handoff of 16 October 2026, SPEC section 10,
 * Clock Safety.dc.html frames 4A and 4B): every automatic clock-out in a
 * period, by person (with how often they pressed "Keep going" and a month by
 * month count) and one by one (the job, when the clock started, where Clocky
 * stopped it, the real end the person confirmed, the difference, and whether
 * they had kept going earlier that day). Times in the viewer's zone. Super
 * Admins have it in full; Admins read it.
 *
 * Not a "use server" file: app/(app)/clocky-hours/safety/actions.ts serves it.
 */

import { allRows, db, loadCatalog, loadDirectory, type Viewer } from './clocky-context'
import { dateLabel, localDate, timeLabel } from './format'
import { roundIso } from './rounding'
import { addDays, monthStart } from './periods'
import { safetyAccess } from './scope'
import type { ClockSafetyData, SafetyOccurrence } from './clocky-types'

export type SafetyPeriod = 'month' | '3m' | 'all'

type Event = { id: number; person_id: string; entry_id: number | null; kind: string; at: string; window_started_at: string; session_started_at: string | null; jobcode_id: number | null; stopped_at: string | null; confirmed_end_at: string | null; confirmed_at: string | null; flagged: boolean }

/** The first day a period covers, in the viewer's calendar: this month, the last three, or everything. */
export function safetyFrom(period: SafetyPeriod, today: string): string | null {
  if (period === 'all') return null
  const first = monthStart(today)
  if (period === 'month') return first
  const [y, m] = first.split('-').map(Number)
  return new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10)
}

export async function loadClockSafety(v: Viewer, now: Date, opts: { period: SafetyPeriod; q?: string }): Promise<ClockSafetyData | null> {
  const access = safetyAccess(v)
  if (access === 'none') return null
  const c = db()
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const today = localDate(now, v.zone)
  const from = safetyFrom(opts.period, today)
  // A day early in UTC, so the viewer's own calendar decides the edge.
  const fromIso = from ? new Date(Date.parse(`${addDays(from, -1)}T00:00:00Z`)).toISOString() : null
  const events = await allRows<Event>((a, b) => {
    let q = c.from('tc_safety_events').select('*').in('kind', ['auto_stop', 'keep_going'])
    if (fromIso) q = q.gte('at', fromIso)
    return q.order('at').range(a, b)
  }, 'Clock safety could not be read')
  // Every stop, for each person's last one and the sparkline (always the last four months).
  const allStops = await allRows<{ person_id: string; stopped_at: string | null; at: string }>(
    (a, b) => c.from('tc_safety_events').select('person_id, stopped_at, at').eq('kind', 'auto_stop').order('at').range(a, b), 'Clock safety could not be read')

  const q = (opts.q ?? '').trim().toLowerCase()
  const name = (id: string) => dir.nameOf(id)
  const inPeriod = (iso: string) => !from || localDate(iso, v.zone) >= from
  const match = (id: string) => !q || name(id).toLowerCase().includes(q)

  const stops = events.filter(e => e.kind === 'auto_stop' && inPeriod(e.stopped_at ?? e.at) && match(e.person_id))
    .sort((a, b) => ((b.stopped_at ?? b.at) < (a.stopped_at ?? a.at) ? -1 : 1))
  const keeps = events.filter(e => e.kind === 'keep_going' && inPeriod(e.at) && match(e.person_id))

  const occurrences: SafetyOccurrence[] = stops.map(e => {
    const stop = roundIso(e.stopped_at ?? e.at)
    const day = localDate(stop, v.zone)
    const conf = e.confirmed_end_at
    const keptEarlier = events.some(k => k.kind === 'keep_going' && k.person_id === e.person_id
      && localDate(k.at, v.zone) === day && k.at < (e.stopped_at ?? e.at))
    return {
      eventId: e.id,
      date: day,
      personId: e.person_id,
      name: name(e.person_id),
      job: catalog.pathOf(e.jobcode_id),
      clockStarted: timeLabel(roundIso(e.session_started_at ?? e.window_started_at), v.zone),
      stoppedAt: timeLabel(stop, v.zone),
      confirmedEnd: conf ? timeLabel(conf, v.zone) : null,
      diffMinutes: conf ? Math.round((Date.parse(conf) - Date.parse(stop)) / 60_000) : null,
      flagged: e.flagged,
      keptGoingEarlier: keptEarlier,
      entryId: e.entry_id,
    }
  })

  // By person: everyone with a stop or a "Keep going" in the period.
  const months: string[] = []
  for (let i = 3; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const ids = [...new Set([...stops.map(e => e.person_id), ...keeps.map(e => e.person_id)])]
  const byPerson = ids.map(id => {
    const p = dir.people.get(id)
    const team = p?.teamId ? dir.teams.get(p.teamId) : undefined
    const mine = allStops.filter(s => s.person_id === id)
    const last = mine.map(s => s.stopped_at ?? s.at).sort().pop()
    return {
      personId: id,
      name: name(id),
      team: team ? { name: team.name, color: team.color } : null,
      autoStops: stops.filter(e => e.person_id === id).length,
      keptGoing: keeps.filter(e => e.person_id === id).length,
      last: last ? dateLabel(localDate(last, v.zone)) : null,
      byMonth: months.map(m => ({ month: m, count: mine.filter(s => localDate(s.stopped_at ?? s.at, v.zone).startsWith(m)).length })),
    }
  }).sort((a, b) => b.autoStops - a.autoStops || b.keptGoing - a.keptGoing)

  return {
    access,
    zone: v.zone,
    cards: {
      autoStops: stops.length,
      people: new Set(stops.map(e => e.person_id)).size,
      confirmed: stops.filter(e => e.confirmed_at).length,
      keptGoing: keeps.length,
    },
    byPerson,
    occurrences,
  }
}
