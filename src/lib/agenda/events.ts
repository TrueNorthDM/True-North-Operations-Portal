/**
 * Agenda events and milestones made in the portal (8E): who may create, edit
 * and delete one, what a form may save, and what the team Google Calendar is
 * sent. Pure: the server actions (app/(app)/agenda/actions.ts) read the
 * database and the access, and decide with these.
 *
 *   Super Admins and Admins (ag-company)   every event and milestone
 *   Team Leaders (ag-team)                 the events of a team they lead
 *
 * Editing and deleting follow the same rule as creating: whoever may create
 * that event may change it or take it away. No new right.
 */

import { wallToInstant } from '@/lib/timeclock/clock'
import { localDate, localMinutes } from '@/lib/timeclock/format'
import { addDays } from '@/lib/timeclock/periods'
import type { Json } from '@/lib/types/database.generated'
import { EVENT_ZONES } from './zones'

export interface EventInput {
  kind: 'event' | 'milestone'
  when: 'time' | 'day' | 'range'
  title: string
  /** yyyy-mm-dd */
  date: string
  end?: string
  /** "15:00" */
  from?: string
  to?: string
  zone: string
  place?: string
  /** Team ids; empty is everyone. */
  teams: string[]
  client?: string
  description?: string
  google: boolean
}

/** What the person may do with events: their two rights and the teams they lead. */
export interface EventRights { company: boolean; team: boolean; led: ReadonlySet<string> }

/** The stored event, as far as the rules need it. */
export interface EventRow {
  kind: 'event' | 'milestone'
  team_id: string | null
  title: string
  start_date: string
  end_date: string
  starts_at: string | null
  ends_at: string | null
  time_zone: string | null
  place: string | null
  audience_team_ids: string[] | null
  client: string | null
  description: string | null
  add_to_google: boolean
}

export type EventFields = EventRow

/** The form, filled from a stored event (Edit opens 8E with these). */
export interface EventEdit {
  id: number
  kind: 'event' | 'milestone'
  when: 'time' | 'day' | 'range'
  title: string
  date: string
  end: string
  from: string
  to: string
  zone: string
  place: string
  teams: string[]
  client: string
  desc: string
  google: boolean
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Whether a person may edit or delete a stored event: the same people who may
 * create it. A Team Leader only a team event of a team they lead (never a
 * milestone, never a company event); Super Admins and Admins all of them.
 */
export function mayManageEvent(r: EventRights, ev: { kind: string; team_id: string | null }): boolean {
  if (r.company) return true
  return r.team && ev.kind === 'event' && !!ev.team_id && r.led.has(ev.team_id)
}

/**
 * What a create or an edit may save, checked on the server. `teams` are the
 * team ids that exist; `keepTeam` is the team an edited event belongs to
 * (a Team Leader's), kept when a Super Admin or Admin edits it and that team
 * still sees it.
 */
export function checkEvent(input: EventInput, ctx: { rights: EventRights; teams: ReadonlySet<string>; keepTeam?: string | null }):
  { ok: false; error: string } | { ok: true; row: EventFields } {
  const fail = (error: string) => ({ ok: false as const, error })
  const { company, led } = ctx.rights
  if (!company && !ctx.rights.team) return fail('Creating events is not open to your access.')
  const kind = input?.kind === 'milestone' ? 'milestone' : 'event'
  if (kind === 'milestone' && !company) return fail('Super Admins and Admins create milestones.')
  const title = String(input?.title ?? '').trim()
  if (!title) return fail('Give it a title.')
  if (title.length > 160) return fail('The title is too long.')
  const date = String(input.date ?? '')
  if (!ISO.test(date)) return fail('Pick the date.')

  // Who sees it: a Team Leader's event is for one team they lead.
  const teams = [...new Set((Array.isArray(input.teams) ? input.teams : []).map(String))].filter(t => ctx.teams.has(t))
  let teamId: string | null = null
  if (!company) {
    if (teams.length !== 1 || !led.has(teams[0])) return fail('Pick the team you lead.')
    teamId = teams[0]
  } else if (ctx.keepTeam && kind === 'event' && teams.includes(ctx.keepTeam)) {
    teamId = ctx.keepTeam
  }

  const zone = EVENT_ZONES.some(z => z.zone === input.zone) ? input.zone : EVENT_ZONES[0].zone
  let endDate = date, startsAt: string | null = null, endsAt: string | null = null
  if (input.when === 'time') {
    if (!HHMM.test(String(input.from)) || !HHMM.test(String(input.to))) return fail('Pick when it starts and ends.')
    if (String(input.to) <= String(input.from)) return fail('It must end after it starts.')
    startsAt = wallToInstant(date, String(input.from), zone)
    endsAt = wallToInstant(date, String(input.to), zone)
    if (!startsAt || !endsAt) return fail('Pick when it starts and ends.')
  } else if (input.when === 'range') {
    const end = String(input.end ?? '')
    if (!ISO.test(end) || end < date) return fail('Pick the last day, on or after the first.')
    if (end > addDays(date, 62)) return fail('A few days is up to two months.')
    endDate = end
  }

  const client = kind === 'milestone' ? String(input.client ?? '').trim() : ''
  return {
    ok: true,
    row: {
      kind, team_id: teamId, title, start_date: date, end_date: endDate, starts_at: startsAt, ends_at: endsAt,
      time_zone: startsAt ? zone : null,
      place: String(input.place ?? '').trim().slice(0, 300) || null,
      audience_team_ids: teams.length ? teams : null,
      client: client || null,
      description: String(input.description ?? '').trim().slice(0, 2000) || null,
      add_to_google: !!input.google,
    },
  }
}

/** What the outbox sends the team Google Calendar for an event (gcal_upsert). */
export function calendarPayload(r: Pick<EventRow, 'title' | 'start_date' | 'end_date' | 'starts_at' | 'ends_at' | 'time_zone' | 'place' | 'description'>): { [k: string]: Json } {
  return r.starts_at && r.ends_at
    ? { summary: r.title, startAt: r.starts_at, endAt: r.ends_at, timeZone: r.time_zone ?? EVENT_ZONES[0].zone, location: r.place, description: r.description }
    : { summary: r.title, start: r.start_date, end: r.end_date, location: r.place, description: r.description }
}

/** Two versions of an event put the same thing on the calendar. */
export function sameOnCalendar(a: Parameters<typeof calendarPayload>[0], b: Parameters<typeof calendarPayload>[0]): boolean {
  return JSON.stringify(calendarPayload(a)) === JSON.stringify(calendarPayload(b))
}

/**
 * What an edit does to the team Google Calendar, through the outbox:
 *   remove   the copy already there comes off (gcal_delete with its id)
 *   drop     jobs not sent yet are taken back (they carry the old version)
 *   send     the new version is queued (gcal_upsert)
 * Nothing at all when it stays on the calendar unchanged.
 */
export function calendarPlan(before: EventRow & { google_event_id: string | null; calendar_state: string | null }, after: EventFields):
  { remove: string | null; drop: boolean; send: boolean } {
  const unchanged = before.add_to_google && after.add_to_google && before.calendar_state !== 'failed' && sameOnCalendar(before, after)
  if (unchanged) return { remove: null, drop: false, send: false }
  return { remove: before.google_event_id, drop: true, send: after.add_to_google }
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** The form 8E opens with to edit a stored event: its times in its own zone. */
export function editOf(id: number, r: EventRow, fallbackZone: string): EventEdit {
  const zone = r.time_zone ?? (EVENT_ZONES.some(z => z.zone === fallbackZone) ? fallbackZone : EVENT_ZONES[0].zone)
  const timed = !!(r.starts_at && r.ends_at)
  return {
    id, kind: r.kind, title: r.title,
    when: timed ? 'time' : r.end_date > r.start_date ? 'range' : 'day',
    date: timed ? localDate(r.starts_at!, zone) : r.start_date,
    end: !timed && r.end_date > r.start_date ? r.end_date : '',
    from: timed ? hhmm(localMinutes(r.starts_at!, zone)) : '09:00',
    to: timed ? hhmm(localMinutes(r.ends_at!, zone)) : '10:00',
    zone, place: r.place ?? '', teams: r.audience_team_ids ?? [], client: r.client ?? '', desc: r.description ?? '', google: r.add_to_google,
  }
}
