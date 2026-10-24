/**
 * The Time off page (Requests.dc.html 7A, 7B, 7D, 7E) for its viewer: their
 * own requests (Super Admins and Admins also Everyone's), the kinds of time
 * off they can ask for, the company holidays and who else is off, for the form.
 *
 * US employees only: a contractor is not paid for days off, so there is
 * nothing to ask (the page says so; the rail leaves it out).
 */

import type { Access } from '@/lib/access/resolve'
import { db, loadCatalog, loadDirectory } from './clocky-context'
import { initials, localDate, stampLabel } from './format'
import { loadRoutes } from './pay-terms'
import { addDays } from './periods'
import { checksOf, countText, daysText, historyOf, holidaysBetween, offDays, pillOf, stepsOf, type OffCheck, type OffRequest, type OffStep, type OffTone } from './time-off'

export interface TimeOffRow {
  id: number
  personId: string
  who: string
  initials: string
  type: string
  start: string
  end: string
  dates: string
  count: string
  checks: OffCheck[]
  pill: { label: string; tone: OffTone }
  /** pending: cancel straight away; approved and still to come: ask a Super Admin. */
  cancel: 'direct' | 'ask' | null
  seconds: number
  /** Not decided yet: its hours count as waiting for approval on the balance card. */
  waiting: boolean
  group: 'pending' | 'upcoming' | 'past'
  drawer: { dates: string; note: string | null; steps: OffStep[]; hist: { t: string; when: string; dot: string }[]; stateLabel: string; stateTone: OffTone }
}

export interface TimeOffPage {
  employee: boolean
  canAll: boolean
  me: { personId: string; name: string; team: string | null }
  today: string
  /** The kinds of time off; `paid` ones have a balance in Rippling (Unpaid has none). */
  types: { id: number; label: string; paid: boolean }[]
  mine: TimeOffRow[]
  everyone: TimeOffRow[]
  holidays: Record<string, string>
  /** Approved time off of everyone else, for "Who else is off" and the calendar dots. */
  offs: { personId: string; who: string; team: string | null; color: string; start: string; end: string }[]
  /** Whoever the person reports to, when that is not a Super Admin: they are told too. */
  teamLeader: string | null
}

const COLS = 'id, person_id, jobcode_id, start_date, end_date, hours_per_day, state, reason, requested_at, decided_by, decided_at, decision_note, rippling_state, rippling_error, rippling_sent_at, calendar_state, entries_written_at, cancel_asked_at, cancel_reason'
type Raw = { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; reason: string | null; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; rippling_state: OffRequest['rippling']; rippling_error: string | null; rippling_sent_at: string | null; calendar_state: OffRequest['calendar']; entries_written_at: string | null; cancel_asked_at: string | null; cancel_reason: string | null }

export async function loadTimeOff(v: Pick<Access, 'personId' | 'isAdmin' | 'isSuperAdmin'>, zone: string, now = new Date()): Promise<TimeOffPage | null> {
  if (!v.personId) return null
  const c = db()
  const today = localDate(now, zone)
  const [dir, catalog, routes] = await Promise.all([loadDirectory(), loadCatalog(), loadRoutes([v.personId])])
  const route = routes.get(v.personId)
  const me = dir.people.get(v.personId)
  const teamOf = (id: string) => { const p = dir.people.get(id); const t = p?.teamId ? dir.teams.get(p.teamId) : null; return { name: t?.name ?? null, color: t?.color ?? '#9CA3AF' } }
  const canAll = v.isAdmin
  const from = addDays(today, -400)
  let q = c.from('tc_absence_requests').select(COLS).in('state', ['pending', 'approved']).gte('end_date', from).order('start_date', { ascending: true })
  if (!canAll) q = q.eq('person_id', v.personId)
  const [{ data, error }, { data: offsRaw, error: offsErr }] = await Promise.all([
    q,
    c.from('tc_absence_requests').select('person_id, start_date, end_date').eq('state', 'approved').neq('person_id', v.personId).gte('end_date', addDays(today, -31)).lte('start_date', addDays(today, 400)),
  ])
  if (error || offsErr) throw new Error(`Time off could not be read: ${(error ?? offsErr)!.message}`)
  const holidays = holidaysBetween(addDays(today, -400), addDays(today, 400))
  const stamp = (t: string) => stampLabel(t, zone)
  const kindOf = (jobcodeId: number) => { const j = catalog.jobs.get(jobcodeId); return j?.short || j?.path || 'Time off' }
  const rows = ((data ?? []) as Raw[]).map(r => {
    const req: OffRequest = {
      id: r.id, personId: r.person_id, who: dir.nameOf(r.person_id), type: kindOf(r.jobcode_id), start: r.start_date, end: r.end_date,
      hoursPerDay: Number(r.hours_per_day), state: r.state as OffRequest['state'], note: r.reason, askedAt: r.requested_at,
      decidedAt: r.decided_at, decidedBy: r.decided_by, decisionNote: r.decision_note, rippling: r.rippling_state, ripplingError: r.rippling_error,
      ripplingSentAt: r.rippling_sent_at, calendar: r.calendar_state, entriesWrittenAt: r.entries_written_at, cancelAskedAt: r.cancel_asked_at, cancelReason: r.cancel_reason,
    }
    const days = offDays(req.start, req.end, holidays).days.length
    const seconds = Math.round(days * req.hoursPerDay * 3600)
    const own = req.personId === v.personId
    const upcoming = req.start > today
    const pill = pillOf(req)
    const group: TimeOffRow['group'] = req.state === 'pending' || req.cancelAskedAt ? 'pending' : req.start >= today ? 'upcoming' : 'past'
    const refused = req.state === 'approved' && req.rippling === 'refused'
    return {
      id: req.id, personId: req.personId, who: req.who, initials: initials(req.who), type: req.type, start: req.start, end: req.end,
      dates: daysText(req.start, req.end), count: countText(days, seconds), checks: checksOf(req), pill, seconds, waiting: req.state === 'pending', group,
      cancel: !own ? null : req.state === 'pending' ? 'direct' as const : req.state === 'approved' && upcoming && !req.cancelAskedAt ? 'ask' as const : null,
      drawer: {
        dates: `${daysText(req.start, req.end)}, ${req.end.slice(0, 4)}`, note: req.note,
        steps: stepsOf(req, { days, seconds, stamp, canRetry: v.isSuperAdmin }), hist: historyOf(req, { stamp, nameOf: dir.nameOf }),
        stateLabel: refused ? 'Approved, Rippling refused it' : pill.label, stateTone: refused ? 'bad' as const : pill.tone,
      },
    }
  })
  return {
    employee: !!route && !route.isContractor,
    canAll,
    me: { personId: v.personId, name: me?.name ?? 'You', team: teamOf(v.personId).name },
    today,
    types: [...catalog.jobs.values()].filter(j => j.active && (j.kind === 'pto' || j.kind === 'unpaid')).map(j => ({ id: j.id, label: j.short || j.path, paid: j.kind === 'pto' })).sort((a, b) => a.label.localeCompare(b.label)),
    mine: rows.filter(r => r.personId === v.personId),
    everyone: canAll ? rows : [],
    holidays: Object.fromEntries(holidays),
    offs: (offsRaw ?? []).map(o => ({ personId: o.person_id, who: dir.nameOf(o.person_id), team: teamOf(o.person_id).name, color: teamOf(o.person_id).color, start: o.start_date, end: o.end_date })),
    teamLeader: route?.reportsTo && route.reportsTo !== v.personId ? dir.nameOf(route.reportsTo) : null,
  }
}
