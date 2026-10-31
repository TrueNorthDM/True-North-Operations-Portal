/**
 * Google Calendar for the outbox (Clocky part 2: approved time off on the team
 * calendar, 7D; Agenda events, 8E). A Google Cloud service
 * account, entered by a Super Admin in Company settings > Integrations (13A),
 * signs a short-lived token itself (RS256, OAuth 2.0 JWT bearer grant); the
 * calendar must be shared with the service account's address.
 *
 * Only the server reads the key; it never reaches a browser.
 */

import { createSign } from 'node:crypto'
import { addDays } from '@/lib/timeclock/periods'

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

const SCOPE = 'https://www.googleapis.com/auth/calendar'
const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export function parseServiceAccount(json: string): ServiceAccount {
  let sa: Partial<ServiceAccount>
  try { sa = JSON.parse(json) as Partial<ServiceAccount> } catch { throw new Error('The Google service account is not valid JSON.') }
  if (!sa.client_email || !sa.private_key) throw new Error('The Google service account has no client_email or private_key.')
  return { client_email: sa.client_email, private_key: sa.private_key, token_uri: sa.token_uri }
}

/** An access token for the calendar scope, from the service account's key. */
export async function accessToken(sa: ServiceAccount, now = Date.now()): Promise<string> {
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const iat = Math.floor(now / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud, iat, exp: iat + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`
  const res = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
  const body = await res.json().catch(() => null) as { access_token?: string; error_description?: string; error?: string } | null
  if (!res.ok || !body?.access_token) throw new Error(`Google refused the service account: ${body?.error_description ?? body?.error ?? res.status}`)
  return body.access_token
}

type Extra = { location?: string | null; description?: string | null }
const extra = (e: Extra) => ({ ...(e.location ? { location: e.location } : {}), ...(e.description ? { description: e.description } : {}) })

async function insert(token: string, calendarId: string, event: Record<string, unknown>): Promise<string> {
  // Marked as the portal's own, so the Agenda's Google sync never brings it back as a new team event.
  const marked = { ...event, extendedProperties: { private: { tnPortalOutbox: '1' } } }
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(marked),
  })
  const body = await res.json().catch(() => null) as { id?: string; error?: { message?: string } } | null
  if (!res.ok || !body?.id) throw new Error(`Google Calendar refused the event: ${body?.error?.message ?? res.status}`)
  return body.id
}

/** An all-day event from start to end (both included). Returns its id. */
export async function insertAllDay(token: string, calendarId: string, e: { summary: string; start: string; end: string; transparent?: boolean } & Extra): Promise<string> {
  const endExclusive = new Date(Date.parse(`${e.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  return insert(token, calendarId, { summary: e.summary, start: { date: e.start }, end: { date: endExclusive }, ...(e.transparent === false ? {} : { transparency: 'transparent' }), ...extra(e) })
}

/** An event at a time (instants), shown in its own zone. Returns its id. */
export async function insertTimed(token: string, calendarId: string, e: { summary: string; startAt: string; endAt: string; timeZone: string } & Extra): Promise<string> {
  return insert(token, calendarId, { summary: e.summary, start: { dateTime: e.startAt, timeZone: e.timeZone }, end: { dateTime: e.endAt, timeZone: e.timeZone }, ...extra(e) })
}

export interface CalendarEvent {
  id: string; summary?: string; description?: string; htmlLink?: string; status?: string
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }
}

/** The events of a calendar between two instants, repeating ones one by one. */
export async function listEvents(token: string, calendarId: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(pageToken ? { pageToken } : {}) })
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json().catch(() => null) as { items?: CalendarEvent[]; nextPageToken?: string; error?: { message?: string } } | null
    if (!res.ok || !body) throw new Error(`Google Calendar could not be read: ${body?.error?.message ?? res.status}`)
    out.push(...(body.items ?? []))
    pageToken = body.nextPageToken
  } while (pageToken && out.length < 5000)
  return out
}

/** Removes an event; one already gone counts as removed. */
export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(`Google Calendar refused to remove the event: ${body?.error?.message ?? res.status}`)
  }
}

/** An event's first and last day: all-day ends are exclusive in Google; timed ones keep the day they are written in. */
export function daysOf(e: CalendarEvent): { start: string; end: string; startsAt: string | null; endsAt: string | null } | null {
  if (e.start?.date) {
    const end = e.end?.date ? addDays(e.end.date, -1) : e.start.date
    return { start: e.start.date, end: end < e.start.date ? e.start.date : end, startsAt: null, endsAt: null }
  }
  if (e.start?.dateTime) {
    const start = e.start.dateTime.slice(0, 10), end = (e.end?.dateTime ?? e.start.dateTime).slice(0, 10)
    return { start, end: end < start ? start : end, startsAt: e.start.dateTime, endsAt: e.end?.dateTime ?? null }
  }
  return null
}
