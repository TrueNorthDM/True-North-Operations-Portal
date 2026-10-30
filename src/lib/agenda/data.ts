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
import { linkIn, type AgendaItem, type AgendaWho } from './model'
import { editOf, mayManageEvent, type EventRights, type EventRow } from './events'

export interface AgendaViewer { id: string; zone: string; superAdmin: boolean; admin: boolean; teamIds: readonly string[] }

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
  const [dir, people, catalog, offRes, evRes, homeRes] = await Promise.all([
    loadDirectory(),
    loadCelebrationPeople(),
    loadCatalog(),
    c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, calendar_state').eq('state', 'approved').lte('start_date', to).gte('end_date', from).limit(2000),
    // A day either side: a timed event can fall on another day in the viewer's zone.
    c.from('agenda_events').select('id, kind, team_id, title, start_date, end_date, starts_at, ends_at, time_zone, place, audience_team_ids, client, description, add_to_google, calendar_state, created_by')
      .lte('start_date', addDays(to, 1)).gte('end_date', addDays(from, -1)).limit(2000),
    // Where people live, for the national holidays.
    c.from('people').select('id, address, location').limit(5000),
  ])
  for (const r of [offRes, evRes, homeRes]) if (r.error) throw new Error(`The Agenda could not be read: ${r.error.message}`)
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
  for (const e of evRes.data ?? []) {
    const audience = e.audience_team_ids ?? []
    const sees = !audience.length || v.superAdmin || v.admin || e.created_by === v.id || audience.some(t => v.teamIds.includes(t))
    if (!sees) continue
    const team = e.team_id ? dir.teams.get(e.team_id) : undefined
    let a = e.start_date, b = e.end_date, s: number | undefined, en: number | undefined
    if (e.starts_at && e.ends_at) {
      a = localDate(e.starts_at, v.zone); b = a
      s = localMinutes(e.starts_at, v.zone) / 60
      en = localDate(e.ends_at, v.zone) === a ? localMinutes(e.ends_at, v.zone) / 60 : 24
    }
    if (b < from || a > to) continue
    items.push({
      id: `ev:${e.id}`, k: e.kind === 'milestone' ? 'ms' : 'event', a, b, s, e: en, title: e.title, place: e.place, link: linkIn(e.place),
      teams: audience.length ? audience.map(t => dir.teams.get(t)?.name).filter(Boolean).join(', ') : 'Everyone',
      team: team ? { id: team.id, name: team.name, color: teamColour(team.color, team.name) } : null,
      by: e.created_by ? dir.nameOf(e.created_by) : null, desc: e.description, client: e.client, onGoogle: e.calendar_state === 'done', audience,
      ...(rights && mayManageEvent(rights, e) ? { edit: editOf(e.id, e as EventRow, v.zone) } : {}),
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

/** The person looking, for the loader; null when the login is not linked to anyone. */
export async function agendaViewer(access: Pick<Access, 'personId' | 'level'>): Promise<AgendaViewer | null> {
  if (!access.personId) return null
  const dir = await loadDirectory()
  return { id: access.personId, zone: dir.zoneOf(access.personId), superAdmin: access.level === 'super_admin', admin: access.level === 'admin', teamIds: dir.people.get(access.personId)?.teamIds ?? [] }
}
