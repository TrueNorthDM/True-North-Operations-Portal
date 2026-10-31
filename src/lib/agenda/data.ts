/**
 * What the Agenda shows one person (Agenda.dc.html), read on the server:
 * approved time off, birthdays and anniversaries (each person may hide theirs
 * in Settings > Privacy), the events and milestones they may see, the Good
 * News Calendar and the company holidays.
 *
 * Who sees what is decided here, before anything reaches the browser:
 *   - the type of time off only for a Super Admin and the person
 *   - an event for some teams only for those teams, its creator, and the
 *     Super Admins and Admins who run the calendar
 *   - national holidays (holidays.ts): the US ones (the company holidays) for
 *     everyone, the person's own country's, and every country someone at True
 *     North lives in for Super Admins and Admins
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Access } from '@/lib/access/resolve'
import { loadCelebrationPeople } from '@/lib/hr/celebrations'
import { teamColour } from '@/lib/directory/team-colour'
import { usHolidays } from '@/lib/notifications/calendar'
import { loadCatalog, loadDirectory, type Directory } from '@/lib/timeclock/clocky-context'
import { localDate, localMinutes } from '@/lib/timeclock/format'
import { addDays } from '@/lib/timeclock/periods'
import { countryOf, nationalHolidays } from './holidays'
import { answerOf, linkIn, type AgendaItem, type AgendaWho, type DetailGuest, type EventDetail } from './model'
import { editOf, mayManageEvent, type EventRights, type EventRow } from './events'
import { mayManage, seesEvent, type EventType, type SeenRow } from './event-rules'
import type { DrawerEdit } from './model'
import type { AccessLevel } from '@/lib/access/catalogue'
import { DC, localOf } from './time'
import { describe, fromRRule } from './recurrence'
import { expandSeries } from './series'

export interface AgendaViewer { id: string; zone: string; superAdmin: boolean; admin: boolean; teamIds: readonly string[]; level?: AccessLevel }

const yearsOf = (from: string, to: string) => { const out: number[] = []; for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push(y); return out }
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
/** The day a month-and-day falls on in a year; Feb 29 is kept on Feb 28 in other years. */
const onYear = (iso: string, y: number) => { const md = iso.slice(5, 10); return `${y}-${md === '02-29' && !isLeap(y) ? '02-28' : md}` }

export function whoOf(dir: Directory, personId: string): AgendaWho {
  const p = dir.people.get(personId), t = p?.teamId ? dir.teams.get(p.teamId) : undefined
  return { id: personId, name: dir.nameOf(personId), teamId: t?.id ?? null, teamName: t?.name ?? null, color: teamColour(t?.color, t?.name) }
}

/** The company holidays in a range: day -> name. */
export function holidaysIn(from: string, to: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const y of yearsOf(addDays(from, -1), addDays(to, 1))) for (const [d, n] of usHolidays(y)) if (d >= from && d <= to) out.set(d, n)
  return out
}

/** `rights`: the viewer's event rights; the events they may edit carry the form to edit them. */
export async function loadAgendaItems(v: AgendaViewer, from: string, to: string, rights?: EventRights): Promise<AgendaItem[]> {
  const c = createAdminClient()
  const [dir, people, catalog, offRes, evRes, seriesRes, homeRes] = await Promise.all([
    loadDirectory(),
    loadCelebrationPeople(),
    loadCatalog(),
    c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, calendar_state').eq('state', 'approved').lte('start_date', to).gte('end_date', from).limit(2000),
    // A day either side: a timed event can fall on another day in the viewer's zone.
    c.from('agenda_events').select('id, kind, team_id, title, start_date, end_date, starts_at, ends_at, time_zone, place, audience_team_ids, client, description, add_to_google, calendar_state, created_by, type, audience, how, meet_link, sent_from_account_id, created_at, google_html_link, recurrence, skip_days, series_id')
      .lte('start_date', addDays(to, 1)).gte('end_date', addDays(from, -1)).is('recurrence', null).limit(2000),
    // Series that began before the range and still run in it (owner, 30 October 2026).
    c.from('agenda_events').select('id, kind, team_id, title, start_date, end_date, starts_at, ends_at, time_zone, place, audience_team_ids, client, description, add_to_google, calendar_state, created_by, type, audience, how, meet_link, sent_from_account_id, created_at, google_html_link, recurrence, skip_days, series_id')
      .not('recurrence', 'is', null).lte('start_date', addDays(to, 1)).or(`recur_until.is.null,recur_until.gte.${addDays(from, -1)}`).limit(500),
    // Where people live, for the national holidays.
    c.from('people').select('id, address, location').limit(5000),
  ])
  for (const r of [offRes, evRes, seriesRes, homeRes]) if (r.error) throw new Error(`The Agenda could not be read: ${r.error.message}`)
  const items: AgendaItem[] = []

  // Approved time off, with its kind (Vacation, Sick...) for everyone (owner, 27 October 2026; it was the person and Super Admins only).
  for (const r of offRes.data ?? []) {
    if (!dir.people.get(r.person_id)?.active) continue
    const j = catalog.jobs.get(r.jobcode_id)
    items.push({ id: `pto:${r.id}`, k: 'pto', a: r.start_date, b: r.end_date, who: whoOf(dir, r.person_id),
      type: j?.short || j?.path || 'Time off', onGoogle: r.calendar_state === 'done' })
  }

  // Birthdays (never the year) and work anniversaries, from the Directory.
  for (const p of people) {
    for (const y of yearsOf(from, to)) {
      if (p.dob) { const d = onYear(p.dob, y); if (d >= from && d <= to) items.push({ id: `bday:${p.id}:${y}`, k: 'bday', a: d, b: d, who: whoOf(dir, p.id) }) }
      if (p.hireDate) {
        const yrs = y - Number(p.hireDate.slice(0, 4)), d = onYear(p.hireDate, y)
        if (yrs >= 1 && d >= from && d <= to) items.push({ id: `anni:${p.id}:${y}`, k: 'anni', a: d, b: d, who: whoOf(dir, p.id), yrs })
      }
    }
  }

  // Events and milestones made in the portal.
  // Who was invited to the drawer's events (owner, 30 October 2026): they see them, and an edit starts from them.
  const allRows = [...(evRes.data ?? []), ...(seriesRes.data ?? [])]
  const newIds = allRows.filter(e => e.audience).map(e => e.id)
  const fromIds = [...new Set(allRows.map(e => e.sent_from_account_id).filter((x): x is number => x != null))]
  const [guestRows, acctRows] = await Promise.all([
    newIds.length ? c.from('agenda_event_guests').select('event_id, person_id, email, via, response').in('event_id', newIds).then(r => r.data ?? []) : [],
    fromIds.length ? c.from('agenda_accounts').select('id, email, team_calendar').in('id', fromIds).then(r => r.data ?? []) : [],
  ])
  const sentFrom = new Map(acctRows.map(a => [a.id as number, { email: a.email as string, team: !!a.team_calendar }]))
  const guestsOf = new Map<number, { person_id: string | null; email: string; via: string; response: string }[]>()
  for (const g of guestRows) (guestsOf.get(g.event_id) ?? guestsOf.set(g.event_id, []).get(g.event_id)!).push(g)
  const viewer = { id: v.id, level: v.level ?? (v.superAdmin ? 'super_admin' : v.admin ? 'admin' : 'user') as AccessLevel, teamIds: v.teamIds, led: rights?.led ?? new Set<string>() }

  // A series is drawn as its occurrences, each with its own id and day; its first day names the rule.
  const firstOf = new Map(allRows.filter(e => e.recurrence).map(e => [e.id, e.start_date]))
  const rows = allRows.flatMap(e => expandSeries(e, addDays(from, -1), addDays(to, 1)))
  for (const { row: e, day: occ } of rows) {
    const audience = e.audience_team_ids ?? []
    const isNew = !!e.audience
    const gs = guestsOf.get(e.id) ?? []
    const sees = isNew
      ? seesEvent(e as SeenRow, viewer, new Set(gs.map(g => g.person_id).filter((x): x is string => !!x)))
      : !audience.length || v.superAdmin || v.admin || e.created_by === v.id || audience.some(t => v.teamIds.includes(t))
    if (!sees) continue
    const team = e.team_id ? dir.teams.get(e.team_id) : isNew && e.audience === 'teams' && audience.length === 1 ? dir.teams.get(audience[0]) : undefined
    let a = e.start_date, b = e.end_date, s: number | undefined, en: number | undefined
    if (e.starts_at && e.ends_at) {
      a = localDate(e.starts_at, v.zone); b = a
      s = localMinutes(e.starts_at, v.zone) / 60
      en = localDate(e.ends_at, v.zone) === a ? localMinutes(e.ends_at, v.zone) / 60 : 24
    }
    if (b < from || a > to) continue
    items.push({
      id: occ ? `ev:${e.id}:${occ}` : `ev:${e.id}`, k: e.kind === 'milestone' ? 'ms' : 'event', a, b, s, e: en, title: e.title,
      place: isNew && e.how === 'online' ? 'Google Meet' : e.place, link: e.meet_link || linkIn(e.place),
      teams: isNew && e.audience === 'guests' ? `${gs.length} guest${gs.length === 1 ? '' : 's'}` : audience.length ? audience.map(t => dir.teams.get(t)?.name).filter(Boolean).join(', ') : 'Everyone',
      ...(isNew && e.type ? { evType: e.type as EventType } : {}),
      team: team ? { id: team.id, name: team.name, color: teamColour(team.color, team.name) } : null,
      by: e.created_by ? dir.nameOf(e.created_by) : null, desc: e.description, client: e.client, onGoogle: e.calendar_state === 'done', audience,
      ...(isNew
        ? { detail: detailOf(e, gs, dir, v.id, sentFrom.get(e.sent_from_account_id ?? -1) ?? null, occ, firstOf.get(e.id) ?? null),
            ...(mayManage(e as SeenRow, viewer) ? { drawerEdit: drawerEditOf(e, gs.filter(g => g.via === 'guest'), occ) } : {}) }
        : rights && mayManageEvent(rights, e) ? { edit: editOf(e.id, e as EventRow, v.zone) } : {}),
    })
  }

  for (const [d, name] of holidaysIn(from, to)) items.push({ id: `hol:${d}`, k: 'hol', a: d, b: d, title: name, country: 'US' })

  // Other countries' national holidays, shown only (owner, 2026-10-23).
  const home = new Map((homeRes.data ?? []).map(r => [r.id as string, countryOf(r.address as { country?: string } | null, r.location as string | null)]))
  const wanted = new Set<string>()
  if (v.superAdmin || v.admin) { for (const [id, cc] of home) if (cc && dir.people.get(id)?.active) wanted.add(cc) }
  else { const mine = home.get(v.id); if (mine) wanted.add(mine) }
  wanted.delete('US')
  for (const cc of [...wanted].sort()) {
    for (const [d, name] of nationalHolidays(cc, from, to)) items.push({ id: `hol:${cc}:${d}`, k: 'hol', a: d, b: d, title: name, country: cc })
  }
  return items
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

/** The open card's details of a drawer event: who it is for, who answered, where it went on Google. */
export function detailOf(
  e: { id: number; how: string | null; place: string | null; audience: string | null; audience_team_ids: string[] | null; created_by: string | null; created_at: string | null; google_html_link: string | null; starts_at: string | null; calendar_state: string | null; recurrence?: string | null },
  gs: { person_id: string | null; email: string; response: string }[], dir: Directory, viewerId: string, from: { email: string; team: boolean } | null,
  occ: string | null = null, first: string | null = null,
): EventDetail {
  const rule = fromRRule(e.recurrence)
  const guestOf = (pid: string | null, email: string, response: string, organizer: boolean): DetailGuest => {
    const p = pid ? dir.people.get(pid) : undefined
    if (pid && p) {
      const w = whoOf(dir, pid)
      return { key: organizer ? 'organizer' : email.toLowerCase(), name: w.name, ini: initials(w.name), color: w.color, sub: organizer ? `Organizer${w.teamName ? ` · ${w.teamName}` : ''}` : (w.teamName ?? 'True North'), answer: organizer ? 'yes' : answerOf(response), zone: dir.zoneOf(pid), organizer }
    }
    return { key: email.toLowerCase(), name: email, ini: (email[0] ?? '?').toUpperCase(), color: '#e3e7ee', sub: 'Outside True North', answer: answerOf(response), zone: null, organizer }
  }
  // The organizer is the account it was sent from: the team calendar (office@), or the creator's own account.
  // The creator invited at another address is a real guest, with their own answer (owner, 31 October 2026).
  const org: DetailGuest[] = from?.team
    ? [{ key: 'organizer', name: from.email, ini: 'TN', color: '#F2C40A', sub: 'Organizer · team calendar', answer: 'yes', zone: null, organizer: true }]
    : e.created_by ? [guestOf(e.created_by, '', 'accepted', true)] : []
  const sender = from?.email.toLowerCase()
  const rest = gs.filter(g => g.email.toLowerCase() !== sender).map(g => guestOf(g.person_id, g.email, g.response, false))
  const teamIds = e.audience === 'teams' ? (e.audience_team_ids ?? []) : []
  const mine = gs.find(g => g.person_id === viewerId && g.email.toLowerCase() !== sender)
  return {
    eventId: e.id,
    how: e.how === 'online' || e.how === 'in_person' ? e.how : null,
    address: e.how === 'in_person' ? (e.place || null) : null,
    audience: (e.audience ?? 'guests') as EventDetail['audience'],
    teams: teamIds.map(t => {
      const team = dir.teams.get(t)
      return { name: team?.name ?? 'A team', color: teamColour(team?.color, team?.name), count: gs.filter(g => g.person_id && dir.people.get(g.person_id)?.teamIds.includes(t)).length }
    }),
    guests: [...org, ...rest],
    sentFrom: from?.email ?? null,
    teamCalendar: !!from?.team,
    created: e.created_at ? e.created_at.slice(0, 10) : null,
    googleLink: e.calendar_state === 'done' ? e.google_html_link : null,
    startsAt: e.starts_at,
    myAnswer: mine ? answerOf(mine.response) : null,
    onGoogle: e.calendar_state === 'done',
    repeat: rule && first ? describe(rule, first) : null,
    occurrence: occ ? { seriesId: e.id, day: occ } : null,
  }
}

type DrawerRowIn = { id: number; type: string | null; title: string; start_date: string; end_date: string; starts_at: string | null; ends_at: string | null; how: string | null; place: string | null; audience: string | null; audience_team_ids: string[] | null; client: string | null; description: string | null; sent_from_account_id: number | null; recurrence?: string | null }

/** The drawer's form from a stored event, in Washington time. */
export function drawerEditOf(e: DrawerRowIn, guests: { person_id: string | null; email: string }[], occurrence: string | null = null): DrawerEdit {
  const s = e.starts_at ? localOf(Date.parse(e.starts_at), DC) : null
  const en = e.ends_at ? localOf(Date.parse(e.ends_at), DC) : null
  return {
    id: e.id, type: (e.type ?? 'meeting') as EventType, title: e.title,
    when: s ? 'time' : e.end_date > e.start_date ? 'range' : 'day',
    date: occurrence ?? s?.date ?? e.start_date, repeat: fromRRule(e.recurrence), occurrence, end: e.end_date, from: s?.minutes ?? 600, to: en ? (en.date === s?.date ? en.minutes : 1440) : 660,
    how: e.how === 'in_person' ? 'in_person' : 'online', place: e.place ?? '',
    audience: (e.audience ?? 'guests') as DrawerEdit['audience'], teams: e.audience_team_ids ?? [],
    guests: guests.map(g => ({ personId: g.person_id, email: g.email })), client: e.client ?? '', description: e.description ?? '', accountId: e.sent_from_account_id,
  }
}

/** The person looking, for the loader; null when the login is not linked to anyone. */
export async function agendaViewer(access: Pick<Access, 'personId' | 'level'>): Promise<AgendaViewer | null> {
  if (!access.personId) return null
  const dir = await loadDirectory()
  return { id: access.personId, zone: dir.zoneOf(access.personId), superAdmin: access.level === 'super_admin', admin: access.level === 'admin', teamIds: dir.people.get(access.personId)?.teamIds ?? [], level: access.level as AccessLevel }
}
