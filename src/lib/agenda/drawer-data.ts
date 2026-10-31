/**
 * What the New event drawer needs (owner, 30 October 2026): the types and
 * choices this person has, the teams with their people, everyone they can
 * invite with each of their addresses, their Google accounts, and, for Find a
 * time, each person's working and busy times. Server only.
 *
 * Addresses offered for a person (owner, 30 October 2026): work, Good News,
 * COE and their connected accounts; the personal address only when they have
 * no work address. An invitation through a team or True North goes to the
 * account each person chose ("Invitations to you go to"), else the work
 * address, else Good News, COE, personal.
 */

import type { Access } from '@/lib/access/resolve'
import type { AccessLevel } from '@/lib/access/catalogue'
import { createAdminClient } from '@/lib/supabase/admin'
import { teamColour } from '@/lib/directory/team-colour'
import { loadDirectory, type Directory } from '@/lib/timeclock/clocky-context'
import { usHolidays } from '@/lib/notifications/calendar'
import { audiencesFor, teamsFor, typesFor, type Audience, type EventType, type Person } from './event-rules'
import type { Avail } from './find-time'
import { refreshGoogleBusy } from './google-busy'
import { expandSeries, type SeriesRow } from './series'
import { DC, instantOf, zoneLabel } from './time'
import { readHours, workingIntervals } from './working-hours'

export interface GuestOption { personId: string; name: string; teamIds: string[]; emails: { email: string; tag: string }[] }
export interface DrawerTeam { id: string; name: string; color: string; count: number }
/** `team`: the team calendar (office@), which anyone may send an event from (Agenda settings says so). */
export interface DrawerAccount { id: number; email: string; team?: boolean }

export interface DrawerSetup {
  /** `emails`: the creator's own addresses, so they can invite themselves at another one (owner, 31 October 2026). */
  me: { id: string; name: string; zone: string; zoneName: string; emails: { email: string; tag: string }[] }
  types: EventType[]
  audiences: Audience[]
  teams: DrawerTeam[]
  people: GuestOption[]
  accounts: DrawerAccount[]
  allCount: number
  clients: string[]
}

type PersonRow = { id: string; full_name: string; status: string | null; email_true_north: string | null; email_goodnews: string | null; email_coe: string | null; email_personal: string | null }

async function addressBook(dir: Directory) {
  const c = createAdminClient()
  const [pRes, aRes, sRes] = await Promise.all([
    c.from('people').select('id, full_name, status, email_true_north, email_goodnews, email_coe, email_personal').eq('status', 'active').order('full_name'),
    c.from('agenda_accounts').select('id, person_id, email').not('person_id', 'is', null),
    c.from('agenda_person_settings').select('person_id, invite_account_id, working_hours'),
  ])
  for (const r of [pRes, aRes, sRes]) if (r.error) throw new Error(`The address book could not be read: ${r.error.message}`)
  const accounts = (aRes.data ?? []) as { id: number; person_id: string; email: string }[]
  const settings = new Map(((sRes.data ?? []) as { person_id: string; invite_account_id: number | null; working_hours: unknown }[]).map(s => [s.person_id, s]))
  const people = ((pRes.data ?? []) as PersonRow[]).map(p => {
    const emails: { email: string; tag: string }[] = []
    const push = (e: string | null, tag: string) => { const x = (e ?? '').trim().toLowerCase(); if (x && !emails.some(m => m.email === x)) emails.push({ email: x, tag }) }
    push(p.email_true_north, 'Work')
    push(p.email_goodnews, 'Good News')
    push(p.email_coe, 'COE')
    for (const a of accounts.filter(a => a.person_id === p.id)) push(a.email, 'Google')
    if (!p.email_true_north) push(p.email_personal, 'Personal')
    const chosen = settings.get(p.id)?.invite_account_id
    const invite = accounts.find(a => a.id === chosen)?.email ?? emails[0]?.email ?? null
    return { id: p.id, name: p.full_name, teamIds: dir.people.get(p.id)?.teamIds ?? [], emails, invite, hours: settings.get(p.id)?.working_hours }
  })
  return { people, accounts }
}

/** Everyone the drawer can invite, with the address an invitation through a team goes to. */
export async function invitablePeople(): Promise<Person[]> {
  const dir = await loadDirectory()
  const { people } = await addressBook(dir)
  return people.map(p => ({ id: p.id, teamIds: p.teamIds, active: true, inviteEmail: p.invite }))
}

export async function allLevels(): Promise<string[]> {
  const { data } = await createAdminClient().from('app_settings').select('agenda_all_levels').eq('singleton_id', 1).maybeSingle()
  return (data?.agenda_all_levels as string[] | null) ?? ['super_admin', 'admin']
}

export async function loadDrawerSetup(access: Pick<Access, 'personId' | 'level'>, clients: string[]): Promise<DrawerSetup | null> {
  if (!access.personId) return null
  const me = access.personId, level = access.level as AccessLevel
  const dir = await loadDirectory()
  const [{ people, accounts }, levels, teamRes] = await Promise.all([addressBook(dir), allLevels(),
    createAdminClient().from('agenda_accounts').select('id, email').eq('team_calendar', true).maybeSingle()])
  const led = dir.led.get(me) ?? new Set<string>()
  const allTeams = [...dir.teams.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const mine = new Set(teamsFor(level, led, allTeams.map(t => t.id)))
  const count = (id: string) => people.filter(p => p.teamIds.includes(id) && p.id !== me).length
  const zone = dir.zoneOf(me)
  return {
    me: { id: me, name: dir.nameOf(me), zone, zoneName: zoneLabel(zone), emails: people.find(p => p.id === me)?.emails ?? [] },
    types: typesFor(level),
    audiences: audiencesFor(level, led.size, levels),
    teams: allTeams.filter(t => mine.has(t.id)).map(t => ({ id: t.id, name: t.name, color: teamColour(t.color, t.name), count: count(t.id) })),
    people: people.filter(p => p.id !== me && p.emails.length).map(p => ({ personId: p.id, name: p.name, teamIds: p.teamIds, emails: p.emails })),
    accounts: [...accounts.filter(a => a.person_id === me).map(a => ({ id: a.id, email: a.email })),
      ...(teamRes.data ? [{ id: teamRes.data.id as number, email: teamRes.data.email as string, team: true }] : [])],
    allCount: people.filter(p => p.id !== me).length,
    clients,
  }
}

const ms = (iso: string) => Date.parse(iso)

/**
 * Working and busy times for Find a time, from a Washington day for some days.
 * Busy: every connected account (Google's own busy times for the ones signed
 * in with Google), the timed portal events the person is in,
 * approved time off (whole days in their zone) and the US holidays.
 */
export async function loadAvailability(personIds: string[], fromDay: string, days: number): Promise<{ id: string; name: string; place: string; avail: Avail }[]> {
  const ids = [...new Set(personIds)].slice(0, 80)
  if (!ids.length) return []
  const c = createAdminClient()
  const dir = await loadDirectory()
  const lo = instantOf(fromDay, 0, DC), hi = lo + days * 864e5
  const loIso = new Date(lo).toISOString(), hiIso = new Date(hi).toISOString()
  const hiDay = new Date(hi).toISOString().slice(0, 10)
  const [acc, set, off, guests, created, series] = await Promise.all([
    c.from('agenda_accounts').select('id, person_id, source').in('person_id', ids),
    c.from('agenda_person_settings').select('person_id, working_hours').in('person_id', ids),
    c.from('tc_absence_requests').select('person_id, start_date, end_date').eq('state', 'approved').in('person_id', ids)
      .lte('start_date', new Date(hi).toISOString().slice(0, 10)).gte('end_date', fromDay),
    c.from('agenda_event_guests').select('person_id, agenda_events(starts_at, ends_at)').in('person_id', ids),
    c.from('agenda_events').select('created_by, starts_at, ends_at').in('created_by', ids).not('starts_at', 'is', null).lt('starts_at', hiIso).gt('ends_at', loIso),
    // Repeating events at a time that run in these days: each occurrence is busy for its creator and its guests.
    c.from('agenda_events').select('id, created_by, start_date, end_date, starts_at, ends_at, time_zone, recurrence, skip_days, agenda_event_guests(person_id)')
      .not('recurrence', 'is', null).not('starts_at', 'is', null).lte('start_date', hiDay).or(`recur_until.is.null,recur_until.gte.${fromDay}`).limit(500),
  ])
  for (const r of [acc, set, off, created, series]) if (r.error) throw new Error(`Availability could not be read: ${r.error.message}`)
  const accounts = (acc.data ?? []) as { id: number; person_id: string; source: string }[]
  // Accounts connected by Google sign-in: their busy times come from Google, refreshed when the copy is old.
  await refreshGoogleBusy(accounts.filter(a => a.source === 'google').map(a => a.id), lo, hi)
  const busyRes = accounts.length
    ? await c.from('agenda_busy').select('account_id, starts_at, ends_at').in('account_id', accounts.map(a => a.id)).lt('starts_at', hiIso).gt('ends_at', loIso).limit(20000)
    : { data: [], error: null }
  if (busyRes.error) throw new Error(`Availability could not be read: ${busyRes.error.message}`)
  const ownerOf = new Map(accounts.map(a => [a.id, a.person_id]))
  const hoursOf = new Map(((set.data ?? []) as { person_id: string; working_hours: unknown }[]).map(s => [s.person_id, readHours(s.working_hours)]))
  const busy = new Map<string, [number, number][]>(ids.map(id => [id, []]))
  const push = (id: string | null | undefined, a: number, b: number) => { if (id && busy.has(id) && b > lo && a < hi) busy.get(id)!.push([a, b]) }
  for (const b of (busyRes.data ?? []) as { account_id: number; starts_at: string; ends_at: string }[]) push(ownerOf.get(b.account_id), ms(b.starts_at), ms(b.ends_at))
  for (const e of (created.data ?? []) as { created_by: string; starts_at: string; ends_at: string }[]) push(e.created_by, ms(e.starts_at), ms(e.ends_at))
  // A plain embed: LiteSpeed refuses "!" in the address since the server move.
  for (const g of ((guests.data ?? []) as unknown as { person_id: string; agenda_events: { starts_at: string | null; ends_at: string | null } | null }[])) {
    const e = g.agenda_events
    if (e?.starts_at && e.ends_at) push(g.person_id, ms(e.starts_at), ms(e.ends_at))
  }
  type SeriesBusy = SeriesRow & { created_by: string | null; agenda_event_guests: { person_id: string | null }[] | null }
  for (const sr of (series.data ?? []) as unknown as SeriesBusy[]) {
    const who = [sr.created_by, ...(sr.agenda_event_guests ?? []).map(g => g.person_id)]
    for (const { row } of expandSeries(sr, fromDay, hiDay)) {
      if (row.starts_at && row.ends_at) for (const p of who) push(p, ms(row.starts_at), ms(row.ends_at))
    }
  }
  for (const o of (off.data ?? []) as { person_id: string; start_date: string; end_date: string }[]) {
    const z = dir.zoneOf(o.person_id)
    push(o.person_id, instantOf(o.start_date, 0, z), instantOf(o.end_date, 1440, z))
  }
  const years = [...new Set([fromDay.slice(0, 4), new Date(hi).toISOString().slice(0, 4)])].map(Number)
  const holidays = years.flatMap(y => [...usHolidays(y).keys()])
  return ids.map(id => {
    const zone = dir.zoneOf(id)
    const b = busy.get(id)!
    for (const d of holidays) b.push([instantOf(d, 0, zone), instantOf(d, 1440, zone)])
    return {
      id, name: dir.nameOf(id), place: zone.split('/').pop()!.replace(/_/g, ' '),
      avail: { id, work: workingIntervals(hoursOf.get(id) ?? readHours(null), zone, lo, hi), busy: b.sort((x, y) => x[0] - y[0]) },
    }
  })
}
