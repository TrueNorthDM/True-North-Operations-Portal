/**
 * The new Agenda's sample data on staging (owner, 30 October 2026), for the
 * training sessions: the team calendar, a Google account for almost everyone
 * (the owner gets two, a few people none, to show the Connect state), working
 * hours and six weeks of busy times. Staging only; safe to run again: accounts
 * and settings are kept, sample busy times are written again the same way.
 * Server only. Run by /api/cron/agenda-sample-seed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { IS_STAGING } from '@/lib/environment'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { sampleBusy, sampleHours, seeded } from './sample-plan'
import { readHours } from './working-hours'
import { invitees, type Audience, type EventType } from './event-rules'
import { DC, instantOf, localOf } from './time'
import { APPROVED_DOMAIN } from './accounts'
import { bookingTitle, hostLine, slugFor } from './booking'
import { notifyAgendaBooking } from '@/lib/notifications/run'

const TEAM_CALENDAR = `office@${APPROVED_DOMAIN}`
/** The owner's two accounts in the approved mockup (he has no work address in the Directory). */
const OWNER_ACCOUNTS = ['arnaldo@truenorthdigitalmarketing.com', 'arnaldo@leveluponline.org']

export interface SeedReport { accounts: number; withoutAccount: number; busy: number; settings: number; events: number; guests: number; links: number; bookings: number }

export async function seedAgendaSamples(c: SupabaseClient, today: string): Promise<SeedReport> {
  if (!IS_STAGING) throw new Error('Sample data is for staging only.')
  const dir = await loadDirectory()
  const { data: people, error } = await c.from('people').select('id, full_name, email_true_north, email_goodnews').eq('status', 'active').order('full_name')
  if (error) throw new Error(`People could not be read: ${error.message}`)
  // Each person's sample account: the work address, else the Good News one.
  const rows = ((people ?? []) as { id: string; full_name: string; email_true_north: string | null; email_goodnews: string | null }[])
    .map(p => ({ id: p.id, name: p.full_name, email: (p.email_true_north || p.email_goodnews || '').trim().toLowerCase() }))
  const owner = rows.find(p => p.name.trim().toLowerCase() === 'arnaldo oliveira')
  const people2 = rows.filter(p => p.email || p.id === owner?.id)
  // About three people without an account, to show the Connect state; never the owner.
  const without = new Set(people2.filter(p => p.id !== owner?.id && seeded(`none:${p.id}`)() < 0.1).slice(0, 3).map(p => p.id))

  // The team calendar.
  const { data: team } = await c.from('agenda_accounts').select('id').eq('team_calendar', true).maybeSingle()
  if (!team) {
    const { error: e } = await c.from('agenda_accounts').insert({ person_id: null, team_calendar: true, email: TEAM_CALENDAR, source: 'sample', connected_by: owner?.id ?? null })
    if (e) throw new Error(`The team calendar could not be added: ${e.message}`)
  }

  // Accounts: the work address, and the owner's second one. Existing rows are kept.
  const wanted = people2.filter(p => !without.has(p.id)).flatMap(p => (p.id === owner?.id ? OWNER_ACCOUNTS : [p.email]).map(email => ({ person_id: p.id, email })))
  const { data: existing, error: exErr } = await c.from('agenda_accounts').select('id, person_id, email').not('person_id', 'is', null)
  if (exErr) throw new Error(`Accounts could not be read: ${exErr.message}`)
  const have = new Set((existing ?? []).map(a => (a.email as string).toLowerCase()))
  const add = wanted.filter(a => !have.has(a.email)).map(a => ({ ...a, source: 'sample', connected_by: a.person_id }))
  if (add.length) {
    const { error: e } = await c.from('agenda_accounts').insert(add)
    if (e) throw new Error(`Accounts could not be added: ${e.message}`)
  }

  // Working hours for whoever has none yet.
  const { data: set } = await c.from('agenda_person_settings').select('person_id')
  const hasSettings = new Set((set ?? []).map(s => s.person_id as string))
  const settings = people2.filter(p => !hasSettings.has(p.id)).map(p => ({ person_id: p.id, working_hours: sampleHours(p.id) }))
  if (settings.length) {
    const { error: e } = await c.from('agenda_person_settings').insert(settings)
    if (e) throw new Error(`Working hours could not be added: ${e.message}`)
  }

  // Busy times: six weeks from a week ago, written again for every sample account.
  const { data: accounts, error: aErr } = await c.from('agenda_accounts').select('id, person_id, email').eq('source', 'sample').not('person_id', 'is', null)
  if (aErr) throw new Error(`Accounts could not be read: ${aErr.message}`)
  const { data: hoursRows } = await c.from('agenda_person_settings').select('person_id, working_hours')
  const hoursOf = new Map((hoursRows ?? []).map(h => [h.person_id as string, h.working_hours]))
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
  const ids = (accounts ?? []).map(a => a.id as number)
  if (ids.length) {
    const { error: e } = await c.from('agenda_busy').delete().eq('source', 'sample').in('account_id', ids)
    if (e) throw new Error(`Old sample busy times could not be cleared: ${e.message}`)
  }
  const busy = (accounts ?? []).flatMap(a => {
    const pid = a.person_id as string
    return sampleBusy(String(a.email), readHours(hoursOf.get(pid)), dir.zoneOf(pid), from, 49)
      .map(([s, e]) => ({ account_id: a.id as number, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(), source: 'sample' }))
  })
  for (let i = 0; i < busy.length; i += 1000) {
    const { error: e } = await c.from('agenda_busy').insert(busy.slice(i, i + 1000))
    if (e) throw new Error(`Busy times could not be added: ${e.message}`)
  }
  const ev = await seedEvents(c, today, people2, owner?.id ?? null, dir)
  const bk = await seedBookings(c, today, people2, owner?.id ?? null, dir, hoursOf)
  return { accounts: add.length, withoutAccount: without.size, busy: busy.length, settings: settings.length, ...ev, ...bk }
}

const SAMPLE_EVENTS: { type: EventType; title: string; audience: Audience; minutes?: [number, number]; days?: number; external?: string; place?: string; client?: string }[] = [
  { type: 'meeting', title: 'Kickoff with Hope Clinic', audience: 'guests', minutes: [600, 660], external: 'maria.santos@hopeclinic.org' },
  { type: 'meeting', title: 'Weekly sync: Marketing', audience: 'teams', minutes: [660, 690] },
  { type: 'training', title: 'Onboarding: North Time', audience: 'teams', minutes: [720, 810] },
  { type: 'deadline', title: 'Hope Clinic proposal due', audience: 'teams', client: 'Hope Clinic' },
  { type: 'meeting', title: '1:1 check-in', audience: 'guests', minutes: [840, 870] },
  { type: 'company', title: 'All-hands, November', audience: 'all', minutes: [660, 720] },
  { type: 'milestone', title: 'i7 site launch', audience: 'teams', client: 'i7 Marketing' },
  { type: 'meeting', title: 'Content review with ADRA', audience: 'guests', minutes: [600, 645], external: 'comms@adra.example.org' },
  { type: 'training', title: 'Workshop: writing for SEO', audience: 'teams', minutes: [780, 870], place: 'Online' },
  { type: 'celebration', title: 'Thanksgiving lunch', audience: 'all', minutes: [720, 810], place: 'Main office, Silver Spring' },
  { type: 'meeting', title: 'Graphics and Writers sync', audience: 'teams', minutes: [480, 510] },
  { type: 'deadline', title: 'November invoices', audience: 'teams' },
  { type: 'meeting', title: 'Client call: Good News for All', audience: 'guests', minutes: [900, 945], external: 'office@gnfa.example.org' },
  { type: 'training', title: 'Google Calendar in the portal', audience: 'all', minutes: [600, 690] },
  { type: 'milestone', title: 'Translation of the 2026 catalogue', audience: 'teams', days: 3 },
  { type: 'meeting', title: 'Social Media planning', audience: 'teams', minutes: [690, 750] },
  { type: 'company', title: 'Quarterly review', audience: 'all', minutes: [780, 870] },
  { type: 'meeting', title: 'Budget review with leadership', audience: 'guests', minutes: [600, 660] },
  { type: 'celebration', title: 'End of year party', audience: 'all', minutes: [1020, 1140], place: 'To be confirmed' },
  { type: 'meeting', title: 'Web team retro', audience: 'teams', minutes: [840, 900] },
  { type: 'deadline', title: 'Africa report due', audience: 'teams' },
  { type: 'meeting', title: 'Intro call with a new client', audience: 'guests', minutes: [960, 990], external: 'ceo@newclient.example.com' },
  { type: 'training', title: 'Approvals in North Time', audience: 'teams', minutes: [660, 720] },
  { type: 'meeting', title: 'Interview: designer', audience: 'guests', minutes: [870, 930], external: 'candidate@mail.example.com' },
]

const meetOf = (key: string) => { const r = seeded(`meet:${key}`), l = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join(''); return `https://meet.google.com/${l(3)}-${l(4)}-${l(3)}` }
const weekdayFrom = (d: string, n: number) => { let x = d, k = 0; while (k < n) { x = new Date(Date.parse(`${x}T00:00:00Z`) + 864e5).toISOString().slice(0, 10); const w = new Date(`${x}T12:00:00Z`).getUTCDay(); if (w !== 0 && w !== 6) k++ } return x }

/** About two dozen events of every type over the next weeks, by different people, upserted by sample_key. */
async function seedEvents(c: SupabaseClient, today: string, people: { id: string; email: string }[], ownerId: string | null, dir: Awaited<ReturnType<typeof loadDirectory>>): Promise<{ events: number; guests: number }> {
  const { data: accts } = await c.from('agenda_accounts').select('id, person_id, email').not('person_id', 'is', null).order('id')
  const accountOf = new Map<string, number>()
  for (const a of (accts ?? []) as { id: number; person_id: string }[]) if (!accountOf.has(a.person_id)) accountOf.set(a.person_id, a.id)
  const creators = people.filter(p => accountOf.has(p.id))
  if (!creators.length) return { events: 0, guests: 0 }
  const list = people.filter(p => p.email).map(p => ({ id: p.id, teamIds: dir.people.get(p.id)?.teamIds ?? [], active: true, inviteEmail: p.email }))
  let events = 0, guests = 0
  for (let i = 0; i < SAMPLE_EVENTS.length; i++) {
    const x = SAMPLE_EVENTS[i], r = seeded(`event:${i}`)
    // The owner makes every third one, so he can open and change them in the training.
    const creator = ownerId && accountOf.has(ownerId) && i % 3 === 0 ? ownerId : creators[Math.floor(r() * creators.length)].id
    const day = weekdayFrom(today, 1 + Math.floor(i * 0.9))
    const teamsOfCreator = dir.people.get(creator)?.teamIds ?? []
    const allTeams = [...dir.teams.keys()]
    const team = teamsOfCreator[0] ?? allTeams[Math.floor(r() * allTeams.length)]
    const timed = !!x.minutes
    const row = {
      kind: x.type === 'milestone' ? 'milestone' : 'event', type: x.type, audience: x.audience, title: x.title,
      start_date: day, end_date: x.days ? weekdayFrom(day, x.days - 1) : day,
      starts_at: timed ? new Date(instantOf(day, x.minutes![0], DC)).toISOString() : null,
      ends_at: timed ? new Date(instantOf(day, x.minutes![1], DC)).toISOString() : null,
      time_zone: timed ? DC : null,
      how: ['meeting', 'training', 'company', 'celebration'].includes(x.type) ? (x.place && x.place !== 'Online' ? 'in_person' : 'online') : null,
      place: x.place && x.place !== 'Online' ? x.place : null,
      meet_link: timed && !(x.place && x.place !== 'Online') && ['meeting', 'training', 'company', 'celebration'].includes(x.type) ? meetOf(`sample:${i}`) : null,
      audience_team_ids: x.audience === 'teams' && team ? [team] : null,
      client: x.client ?? null, description: null, add_to_google: false,
      created_by: creator, sent_from_account_id: accountOf.get(creator)!, source: 'sample', sample_key: `agenda-sample-${i}`,
    }
    const { data, error } = await c.from('agenda_events').upsert(row, { onConflict: 'sample_key' }).select('id').single()
    if (error || !data) throw new Error(`Sample event ${x.title} could not be saved: ${error?.message}`)
    events++
    const picked = x.audience === 'guests' ? creators.filter(p => p.id !== creator).sort((a, b) => seeded(`g:${i}:${a.id}`)() - seeded(`g:${i}:${b.id}`)()).slice(0, 2 + Math.floor(r() * 3)) : []
    const gs = [...picked.map(p => ({ personId: p.id, email: p.email })), ...(x.external ? [{ email: x.external }] : [])]
    const inv = invitees(x.audience, row.audience_team_ids ?? [], gs, list, creator)
    await c.from('agenda_event_guests').delete().eq('event_id', data.id)
    if (inv.length) {
      const { error: gErr } = await c.from('agenda_event_guests').insert(inv.map(g => ({ ...g, event_id: data.id })))
      if (gErr) throw new Error(`Guests of ${x.title} could not be saved: ${gErr.message}`)
      guests += inv.length
    }
  }
  return { events, guests }
}

/** Who booked the sample meetings: people outside True North, as the booking page is for. */
const BOOKERS: { name: string; email: string; guests: string[]; note: string | null; zone: string; len: number }[] = [
  { name: 'Maria Santos', email: 'maria.santos@hopeclinic.org', guests: ['joao.lima@hopeclinic.org'], note: 'We would like to talk about the new website.', zone: 'America/Sao_Paulo', len: 30 },
  { name: 'David Mensah', email: 'david@accraschools.example.org', guests: [], note: null, zone: 'Africa/Accra', len: 60 },
  { name: 'Grace Wanjiru', email: 'grace.w@nairobihealth.example.org', guests: ['peter.k@nairobihealth.example.org', 'ann.m@nairobihealth.example.org'], note: 'Quarterly report review.', zone: 'Africa/Nairobi', len: 30 },
  { name: 'Tom Becker', email: 'tom@beckerfoundation.example.com', guests: [], note: 'Intro call.', zone: 'America/Chicago', len: 30 },
  { name: 'Ana Ribeiro', email: 'ana.ribeiro@mail.example.com', guests: [], note: null, zone: 'Europe/Lisbon', len: 60 },
  { name: 'Samuel Okafor', email: 'samuel@lagosmedia.example.com', guests: ['tola@lagosmedia.example.com'], note: 'Social media proposal.', zone: 'Africa/Lagos', len: 30 },
  { name: 'Linda Park', email: 'linda.park@sunrisechurch.example.org', guests: [], note: null, zone: 'America/Los_Angeles', len: 30 },
  { name: 'Rui Costa', email: 'rui@portoeditions.example.com', guests: [], note: 'Translation project.', zone: 'Europe/Lisbon', len: 60 },
]

/**
 * A booking link for everyone with an account (most of them on, the owner's
 * always), and eight meetings booked through them by people outside True
 * North, three with the owner. Links people already have are kept;
 * bookings and their meetings are upserted by sample_key.
 */
async function seedBookings(c: SupabaseClient, today: string, people: { id: string; name: string }[], ownerId: string | null, dir: Awaited<ReturnType<typeof loadDirectory>>, hoursOf: Map<string, unknown>): Promise<{ links: number; bookings: number }> {
  const { data: accts } = await c.from('agenda_accounts').select('id, person_id').not('person_id', 'is', null).order('id')
  const accountOf = new Map<string, number>()
  for (const a of (accts ?? []) as { id: number; person_id: string }[]) if (!accountOf.has(a.person_id)) accountOf.set(a.person_id, a.id)
  const { data: links } = await c.from('agenda_booking_links').select('person_id, slug')
  const has = new Set((links ?? []).map(l => l.person_id as string))
  const taken = new Set((links ?? []).map(l => l.slug as string))
  const OPTIONS = [
    { lengths: [30, 60], gap_min: 10, notice_min: 1440, window_days: 30 },
    { lengths: [15, 30], gap_min: 0, notice_min: 120, window_days: 14 },
    { lengths: [30, 45, 60], gap_min: 15, notice_min: 2880, window_days: 60 },
  ]
  const add = people.filter(p => accountOf.has(p.id) && !has.has(p.id)).map(p => {
    const slug = slugFor(p.name, taken); taken.add(slug)
    const r = seeded(`link:${p.id}`)
    return { person_id: p.id, slug, is_on: p.id === ownerId || r() < 0.75, account_id: accountOf.get(p.id)!, ...OPTIONS[Math.floor(r() * OPTIONS.length)] }
  })
  if (add.length) {
    const { error } = await c.from('agenda_booking_links').insert(add)
    if (error) throw new Error(`Booking links could not be added: ${error.message}`)
  }
  if (ownerId && accountOf.has(ownerId)) await c.from('agenda_booking_links').update({ account_id: accountOf.get(ownerId)! }).eq('person_id', ownerId).is('account_id', null)
  if (ownerId && accountOf.has(ownerId)) await c.from('agenda_booking_links').update({ is_on: true }).eq('person_id', ownerId)

  const { data: on } = await c.from('agenda_booking_links').select('person_id, account_id').eq('is_on', true).not('account_id', 'is', null)
  const hosts = ((on ?? []) as { person_id: string; account_id: number }[]).sort((a, b) => a.person_id.localeCompare(b.person_id))
  const others = hosts.filter(h => h.person_id !== ownerId)
  const owner = hosts.find(h => h.person_id === ownerId)
  let bookings = 0
  for (let i = 0; i < BOOKERS.length; i++) {
    const host = owner && i % 3 === 0 ? owner : others[Math.floor(seeded(`bk:${i}`)() * others.length)] ?? owner
    if (!host) break
    const x = BOOKERS[i], zone = dir.zoneOf(host.person_id), hours = readHours(hoursOf.get(host.person_id))
    // A weekday the host works, in their first block, an hour in.
    let day = weekdayFrom(today, 2 + i), block = hours[String(new Date(`${day}T12:00:00Z`).getUTCDay() || 7) as keyof typeof hours]?.[0]
    for (let k = 0; !block && k < 7; k++) { day = weekdayFrom(day, 1); block = hours[String(new Date(`${day}T12:00:00Z`).getUTCDay() || 7) as keyof typeof hours]?.[0] }
    const startMin = (block?.[0] ?? 540) + 60 + (i % 2) * 90
    const start = instantOf(day, startMin, zone), end = start + x.len * 60_000
    const name = dir.nameOf(host.person_id)
    const { data: ev, error } = await c.from('agenda_events').upsert({
      kind: 'event', type: 'meeting', audience: 'guests', title: bookingTitle(x.name, name),
      start_date: localOf(start, DC).date, end_date: localOf(start, DC).date,
      starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), time_zone: DC,
      how: 'online', place: null, meet_link: meetOf(`booking:${i}`), audience_team_ids: null, client: null,
      description: [x.note, `Booked by ${x.name} (${x.email}) on ${name}'s booking link.`].filter(Boolean).join('\n\n'),
      add_to_google: false, created_by: host.person_id, sent_from_account_id: host.account_id, source: 'sample', sample_key: `agenda-booking-${i}`,
    }, { onConflict: 'sample_key' }).select('id').single()
    if (error || !ev) throw new Error(`Sample booking ${x.name} could not be saved: ${error?.message}`)
    await c.from('agenda_event_guests').delete().eq('event_id', ev.id)
    await c.from('agenda_event_guests').insert([x.email, ...x.guests].map(email => ({ event_id: ev.id, email, person_id: null, via: 'guest' })))
    const at = new Date(start - 3 * 864e5).toISOString()
    const { data: bk, error: bErr } = await c.from('agenda_bookings').upsert({
      host_id: host.person_id, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
      name: x.name, email: x.email, guests: x.guests, note: x.note, booker_zone: x.zone, state: 'booked',
      token_hash: `sample-${i}`, held_until: at, confirmed_at: at, event_id: ev.id, source: 'sample', sample_key: `agenda-booking-${i}`,
    }, { onConflict: 'sample_key' }).select('id').single()
    if (bErr || !bk) throw new Error(`Sample booking ${x.name} could not be saved: ${bErr?.message}`)
    bookings++
    if (host.person_id === ownerId) {
      try {
        await notifyAgendaBooking({ bookingId: bk.id as number, hostId: host.person_id, title: `New booking: ${x.name}`, body: hostLine(start, x.len, 1 + x.guests.length, zone) })
      } catch { /* the bell is a nicety for the training */ }
    }
  }
  return { links: add.length, bookings }
}
