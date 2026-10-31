/**
 * Google Calendar to the portal (owner, 30 October 2026): every 5 minutes
 * (api/cron/agenda-google-sync) each Google-connected account is asked what
 * changed since the last time, with Google's sync token. An event the portal
 * made follows what was done to it in Google (changed or deleted); an event
 * added straight to the team calendar (office@) shows on the Agenda for
 * everyone. Events added straight to someone's own calendar stay off the
 * Agenda: they only count as busy times. Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessTokenFor } from './google-app'
import { answersIn } from './google-events'
import { DC, localOf } from './time'

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
/** The first read of an account looks this far back; later reads ask only for changes. */
const FIRST_BACK_MS = 30 * 864e5
const PAGES = 20

export interface GoogleItem {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  hangoutLink?: string
  htmlLink?: string
  iCalUID?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  attendees?: { email?: string; responseStatus?: string; organizer?: boolean; self?: boolean }[]
  extendedProperties?: { private?: Record<string, string> }
}

const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)

/** The portal's columns for a Google event: its title, days or times, place and Meet link. Null when Google sent no start. */
export function fieldsOf(g: GoogleItem): {
  title: string; start_date: string; end_date: string; starts_at: string | null; ends_at: string | null; time_zone: string | null
  place: string | null; how: 'online' | 'in_person' | null; meet_link: string | null; description: string | null
} | null {
  const title = (g.summary ?? '').trim().slice(0, 160) || '(No title)'
  const place = g.location?.trim() || null
  const how = g.hangoutLink ? 'online' as const : place ? 'in_person' as const : null
  const common = { title, place, how, meet_link: g.hangoutLink ?? null, description: g.description?.trim() || null }
  if (g.start?.dateTime && g.end?.dateTime) {
    const zone = g.start.timeZone || DC
    const a = Date.parse(g.start.dateTime), b = Date.parse(g.end.dateTime)
    if (!(b > a)) return null
    return { ...common, start_date: localOf(a, zone).date, end_date: localOf(b - 1, zone).date, starts_at: new Date(a).toISOString(), ends_at: new Date(b).toISOString(), time_zone: zone }
  }
  if (g.start?.date) {
    // Google's all-day end is the day after the last day.
    const end = g.end?.date && g.end.date > g.start.date ? dayBefore(g.end.date) : g.start.date
    return { ...common, start_date: g.start.date, end_date: end, starts_at: null, ends_at: null, time_zone: null }
  }
  return null
}

async function changes(token: string, syncToken: string | null): Promise<{ items: GoogleItem[]; next: string | null } | 'reset'> {
  const items: GoogleItem[] = []
  let page: string | null = null
  for (let i = 0; i < PAGES; i++) {
    const q = new URLSearchParams({ showDeleted: 'true', maxResults: '250', singleEvents: 'true' })
    if (syncToken) q.set('syncToken', syncToken)
    else q.set('timeMin', new Date(Date.now() - FIRST_BACK_MS).toISOString())
    if (page) q.set('pageToken', page)
    const res = await fetch(`${API}?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
    // The token is too old for Google: start again from a full read.
    if (res.status === 410) return 'reset'
    const json = await res.json().catch(() => null) as { items?: GoogleItem[]; nextPageToken?: string; nextSyncToken?: string } | null
    if (!res.ok || !json) throw new Error(`events answered ${res.status}`)
    items.push(...(json.items ?? []))
    if (json.nextPageToken) { page = json.nextPageToken; continue }
    return { items, next: json.nextSyncToken ?? null }
  }
  throw new Error('too many changes at once; the next run carries on')
}

export interface SyncReport { accounts: number; updated: number; deleted: number; added: number; errors: string[] }

/** One run over every Google-connected account. */
export async function syncFromGoogle(): Promise<SyncReport> {
  const c = createAdminClient()
  const report: SyncReport = { accounts: 0, updated: 0, deleted: 0, added: 0, errors: [] }
  const { data: accts, error } = await c.from('agenda_accounts').select('id, email, team_calendar, person_id').eq('source', 'google').eq('status', 'connected')
  if (error) throw new Error(error.message)
  const { data: people } = await c.from('people').select('id, email_true_north, email_goodnews').eq('status', 'active')
  const personOf = new Map<string, string>()
  for (const p of (people ?? []) as { id: string; email_true_north: string | null; email_goodnews: string | null }[]) {
    for (const e of [p.email_true_north, p.email_goodnews]) if (e) personOf.set(e.trim().toLowerCase(), p.id)
  }

  for (const a of (accts ?? []) as { id: number; email: string; team_calendar: boolean; person_id: string | null }[]) {
    report.accounts++
    try {
      const token = await accessTokenFor(a.id)
      if (!token) continue
      const { data: t } = await c.from('agenda_account_tokens').select('sync_token').eq('account_id', a.id).maybeSingle()
      let got = await changes(token, t?.sync_token ?? null)
      if (got === 'reset') got = await changes(token, null)
      if (got === 'reset') throw new Error('Google refused a full read')
      const first = !t?.sync_token

      for (const g of got.items) {
        const { data: ev } = await c.from('agenda_events').select('id').eq('sent_from_account_id', a.id).eq('google_event_id', g.id).maybeSingle()
        if (g.status === 'cancelled') {
          if (ev) { await c.from('agenda_events').delete().eq('id', ev.id); report.deleted++ }
          continue
        }
        const f = fieldsOf(g)
        if (!f) continue
        const guests = (g.attendees ?? []).filter(x => x.email && !x.organizer && x.email.toLowerCase() !== a.email.toLowerCase())
        if (ev) {
          const { error: upErr } = await c.from('agenda_events').update({
            title: f.title, start_date: f.start_date, end_date: f.end_date, starts_at: f.starts_at, ends_at: f.ends_at, time_zone: f.time_zone,
            how: f.how, place: f.how === 'in_person' ? f.place : null, meet_link: f.meet_link, description: f.description,
            google_html_link: g.htmlLink ?? null, calendar_state: 'done', responses_read_at: new Date().toISOString(),
          }).eq('id', ev.id)
          if (upErr) throw new Error(upErr.message)
          await syncGuests(ev.id, guests, personOf)
          report.updated++
          continue
        }
        // New in Google: only the team calendar's events join the Agenda, never one the portal made and deleted, and not the backlog of the first read.
        const ours = Object.keys(g.extendedProperties?.private ?? {}).some(k => k.startsWith('tnPortal'))
        if (!a.team_calendar || ours || first) continue
        const { data: made, error: insErr } = await c.from('agenda_events').insert({
          kind: 'event', type: 'company', audience: 'all', title: f.title, start_date: f.start_date, end_date: f.end_date,
          starts_at: f.starts_at, ends_at: f.ends_at, time_zone: f.time_zone, how: f.how, place: f.how === 'in_person' ? f.place : null,
          meet_link: f.meet_link, description: f.description, audience_team_ids: null, client: null,
          sent_from_account_id: a.id, created_by: null, add_to_google: false, source: 'google',
          google_event_id: g.id, google_html_link: g.htmlLink ?? null, google_ical_uid: g.iCalUID ?? null, calendar_state: 'done',
        }).select('id').single()
        if (insErr) throw new Error(insErr.message)
        await syncGuests(made.id as number, guests, personOf)
        report.added++
      }
      await c.from('agenda_account_tokens').update({ sync_token: got.next, synced_at: new Date().toISOString() }).eq('account_id', a.id)
    } catch (e) {
      report.errors.push(`${a.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}

/** The guest list as Google has it: new guests added, removed ones taken off, answers kept current. */
async function syncGuests(eventId: number, guests: { email?: string; responseStatus?: string }[], personOf: Map<string, string>) {
  const c = createAdminClient()
  const answers = answersIn({ attendees: guests })
  const { data: rows } = await c.from('agenda_event_guests').select('id, email, response, via').eq('event_id', eventId)
  const have = new Map(((rows ?? []) as { id: number; email: string; response: string; via: string }[]).map(r => [r.email.toLowerCase(), r]))
  const gone = [...have.values()].filter(r => !answers.has(r.email.toLowerCase())).map(r => r.id)
  if (gone.length) await c.from('agenda_event_guests').delete().in('id', gone)
  const add = [...answers].filter(([e]) => !have.has(e)).map(([email, response]) => ({ event_id: eventId, email, person_id: personOf.get(email) ?? null, via: 'guest', response }))
  if (add.length) await c.from('agenda_event_guests').insert(add)
  await Promise.all([...answers].map(([email, response]) => {
    const r = have.get(email)
    return r && r.response !== response ? c.from('agenda_event_guests').update({ response }).eq('id', r.id) : null
  }))
}
