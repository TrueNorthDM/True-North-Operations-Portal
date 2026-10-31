/**
 * The new Agenda's events (owner, 30 October 2026; the approved mockup's New
 * event drawer). Pure: the server actions read the database and the access and
 * decide with these.
 *
 *   Type       Members a Meeting; Team Leaders also Training, Deadline and
 *              Milestone; Admins and Super Admins also Company event and
 *              Celebration.
 *   Who        Guests (people one by one), Teams (Team Leaders their own,
 *              Admins any) or True North (the levels a Super Admin chooses),
 *              and guests on top. Everyone listed is invited for real.
 *   Sees it    True North: everyone. Teams: their people, the guests and the
 *              creator. Guests: only the guests and the creator, Admins and
 *              Super Admins included (owner, 30 October 2026).
 *   Changes it The creator; a Team Leader the events of their teams; Admins
 *              and Super Admins the events sent to True North (the team
 *              calendar). Owner, 30 October 2026.
 *
 * Every event is set in Washington DC time. An event made before the drawer
 * (audience null) keeps the old rules (lib/agenda/events.ts).
 */

import type { AccessLevel } from '@/lib/access/catalogue'
import { DC, instantOf } from './time'
import { cleanRepeat, lastDay, toRRule, type Repeat } from './recurrence'

export type EventType = 'meeting' | 'training' | 'deadline' | 'milestone' | 'company' | 'celebration'
export type Audience = 'guests' | 'teams' | 'all'
export type When = 'time' | 'day' | 'range'

export const TYPES: readonly { id: EventType; label: string; sub: string; guests: boolean; meet: boolean; client: boolean; when: When }[] = [
  { id: 'meeting', label: 'Meeting', sub: 'Calls, 1:1s, clients', guests: true, meet: true, client: false, when: 'time' },
  { id: 'training', label: 'Training', sub: 'Onboarding, workshops', guests: true, meet: true, client: false, when: 'time' },
  { id: 'deadline', label: 'Deadline', sub: 'Something is due', guests: true, meet: false, client: true, when: 'day' },
  { id: 'milestone', label: 'Milestone', sub: 'A launch, a goal met', guests: true, meet: false, client: true, when: 'day' },
  { id: 'company', label: 'Company event', sub: 'All-hands, webinars', guests: true, meet: true, client: false, when: 'time' },
  { id: 'celebration', label: 'Celebration', sub: 'Parties, big moments', guests: true, meet: true, client: false, when: 'time' },
]
export const typeOf = (t: EventType) => TYPES.find(x => x.id === t) ?? TYPES[0]

/** The types a level may create. */
export function typesFor(level: AccessLevel): EventType[] {
  if (level === 'super_admin' || level === 'admin') return TYPES.map(t => t.id)
  if (level === 'team_leader') return ['meeting', 'training', 'deadline', 'milestone']
  return ['meeting']
}

/** Who-it's-for choices a person has: Teams needs a team to send to, True North a level the Super Admin chose. */
export function audiencesFor(level: AccessLevel, ledTeams: number, allLevels: readonly string[]): Audience[] {
  const out: Audience[] = ['guests']
  if (level === 'super_admin' || level === 'admin' || (level === 'team_leader' && ledTeams > 0)) out.push('teams')
  if (allLevels.includes(level)) out.push('all')
  return out
}

/** The teams a person may send to: any for Admins and Super Admins, their own for a Team Leader. */
export function teamsFor(level: AccessLevel, led: ReadonlySet<string>, all: readonly string[]): string[] {
  return level === 'super_admin' || level === 'admin' ? [...all] : level === 'team_leader' ? all.filter(t => led.has(t)) : []
}

/** An old event (before the drawer) read as a type, for the icon. */
export function legacyType(kind: 'event' | 'milestone', teamId: string | null): EventType {
  return kind === 'milestone' ? 'milestone' : teamId ? 'meeting' : 'company'
}

export interface Person { id: string; teamIds: readonly string[]; active: boolean; inviteEmail: string | null }
export interface GuestIn { personId?: string | null; email: string }
export interface Invitee { person_id: string | null; email: string; via: 'guest' | 'team' | 'all' }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_GUESTS = 200

/**
 * Everyone invited, once each: True North or the chosen teams written out to
 * their people (at the address each chose for invitations), then the guests
 * one by one. The creator is not on the list: they own the event.
 */
export function invitees(audience: Audience, teams: readonly string[], guests: readonly GuestIn[], people: readonly Person[], creatorId: string): Invitee[] {
  const out = new Map<string, Invitee>()
  const add = (i: Invitee) => { const k = i.email.trim().toLowerCase(); if (k && !out.has(k)) out.set(k, { ...i, email: k }) }
  if (audience === 'all') for (const p of people) if (p.active && p.id !== creatorId && p.inviteEmail) add({ person_id: p.id, email: p.inviteEmail, via: 'all' })
  if (audience === 'teams') for (const p of people) if (p.active && p.id !== creatorId && p.inviteEmail && p.teamIds.some(t => teams.includes(t))) add({ person_id: p.id, email: p.inviteEmail, via: 'team' })
  // The creator may invite themselves at another address (owner, 31 October 2026); the address that sends it is left out on Google.
  for (const g of guests) add({ person_id: g.personId ?? null, email: g.email, via: 'guest' })
  return [...out.values()]
}

export interface DrawerInput {
  type: EventType
  when: When
  title: string
  date: string
  end?: string
  /** Minutes from midnight, Washington DC time. */
  from?: number
  to?: number
  how: 'online' | 'in_person'
  place?: string
  audience: Audience
  teams: string[]
  guests: GuestIn[]
  client?: string
  description?: string
  accountId: number | null
  /** Repeats (owner, 30 October 2026): null or absent for a single event. */
  repeat?: Repeat | null
}

export interface DrawerRights { level: AccessLevel; led: ReadonlySet<string>; allLevels: readonly string[]; teamIds: readonly string[] }

export interface DrawerRow {
  kind: 'event' | 'milestone'
  type: EventType
  audience: Audience
  title: string
  start_date: string
  end_date: string
  starts_at: string | null
  ends_at: string | null
  time_zone: string | null
  how: 'online' | 'in_person' | null
  place: string | null
  audience_team_ids: string[] | null
  client: string | null
  description: string | null
  sent_from_account_id: number
  /** A series: its rule in Google's words, and its last day (null: never ends). */
  recurrence: string | null
  recur_until: string | null
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

/** What the drawer may save, or a sentence saying why not. */
export function checkDrawer(input: DrawerInput, r: DrawerRights): { ok: true; row: DrawerRow; guests: GuestIn[] } | { ok: false; error: string } {
  const t = TYPES.find(x => x.id === input?.type)
  if (!t || !typesFor(r.level).includes(t.id)) return { ok: false, error: 'That type is not open to your access.' }
  const title = clean(input.title, 160)
  if (!title) return { ok: false, error: 'Give it a title.' }
  if (!ISO.test(input.date ?? '')) return { ok: false, error: 'Pick a date.' }
  if (input.accountId == null || !Number.isSafeInteger(input.accountId)) return { ok: false, error: 'Select the account to send from.' }
  const audiences = audiencesFor(r.level, r.led.size, r.allLevels)
  if (!audiences.includes(input.audience)) return { ok: false, error: input.audience === 'all' ? 'Inviting all of True North is not open to your access.' : 'Sending to teams is not open to your access.' }
  const teams = input.audience === 'teams' ? [...new Set(input.teams ?? [])] : []
  if (input.audience === 'teams') {
    if (!teams.length) return { ok: false, error: 'Add at least one team.' }
    const allowed = teamsFor(r.level, r.led, r.teamIds)
    if (teams.some(x => !allowed.includes(x))) return { ok: false, error: 'You can only send to teams you lead.' }
  }
  const guests = (input.guests ?? []).map(g => ({ personId: g.personId ?? null, email: clean(g.email, 254).toLowerCase() }))
  if (guests.some(g => !EMAIL.test(g.email))) return { ok: false, error: 'One of the guests is not an email address.' }
  if (guests.length > MAX_GUESTS) return { ok: false, error: `Up to ${MAX_GUESTS} guests.` }
  if (input.audience === 'guests' && !guests.length && !t.client) return { ok: false, error: 'Add at least one guest.' }

  const start_date = input.date
  let end_date = input.date, starts_at: string | null = null, ends_at: string | null = null
  if (input.when === 'range') {
    if (!ISO.test(input.end ?? '') || (input.end as string) < input.date) return { ok: false, error: 'The last day has to be on or after the first.' }
    end_date = input.end as string
  } else if (input.when === 'time') {
    const f = Number(input.from), to = Number(input.to)
    if (!Number.isInteger(f) || !Number.isInteger(to) || f < 0 || to > 1440 || to <= f) return { ok: false, error: 'The end time has to be after the start.' }
    starts_at = new Date(instantOf(input.date, f, DC)).toISOString()
    ends_at = new Date(instantOf(input.date, to, DC)).toISOString()
  } else if (input.when !== 'day') return { ok: false, error: 'Pick when it happens.' }

  let recurrence: string | null = null, recur_until: string | null = null
  if (input.repeat) {
    if (input.when === 'range') return { ok: false, error: 'An event of a few days cannot repeat. Make it all day or at a time.' }
    const rule = cleanRepeat(input.repeat, start_date)
    if (!rule) return { ok: false, error: 'Pick how it repeats.' }
    recurrence = toRRule(rule, start_date, input.when === 'day')
    recur_until = lastDay(rule, start_date)
  }

  const how = t.meet && input.when === 'time' ? (input.how === 'in_person' ? 'in_person' : 'online') : t.meet ? (input.how === 'in_person' ? 'in_person' : null) : null
  return {
    ok: true,
    guests,
    row: {
      kind: t.id === 'milestone' ? 'milestone' : 'event', type: t.id, audience: input.audience, title,
      start_date, end_date, starts_at, ends_at, time_zone: starts_at ? DC : null,
      how, place: how === 'in_person' ? clean(input.place, 300) || null : null,
      audience_team_ids: teams.length ? teams : null,
      client: t.client ? clean(input.client, 160) || null : null,
      description: clean(input.description, 2000) || null,
      sent_from_account_id: input.accountId,
      recurrence, recur_until,
    },
  }
}

export interface Viewer { id: string; level: AccessLevel; teamIds: readonly string[]; led: ReadonlySet<string> }
export interface SeenRow { audience: Audience | null; audience_team_ids: string[] | null; created_by: string | null; team_id: string | null }

/** Whether a person sees a new-style event; `guestIds` are the people invited one by one or through a team. */
export function seesEvent(e: SeenRow, v: Viewer, guestIds: ReadonlySet<string>): boolean {
  if (e.created_by === v.id || guestIds.has(v.id)) return true
  if (e.audience === 'all') return true
  if (e.audience === 'teams') return (e.audience_team_ids ?? []).some(t => v.teamIds.includes(t))
  return false
}

/** Whether a person may edit or delete a new-style event. */
export function mayManage(e: SeenRow, v: Viewer): boolean {
  if (e.created_by === v.id) return true
  if (v.level === 'team_leader' && e.audience === 'teams') return (e.audience_team_ids ?? []).length > 0 && (e.audience_team_ids ?? []).every(t => v.led.has(t))
  if (v.level === 'super_admin' || v.level === 'admin') return e.audience === 'all'
  return false
}
