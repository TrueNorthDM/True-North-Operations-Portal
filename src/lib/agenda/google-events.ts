/**
 * Events on Google Calendar (owner, 30 October 2026): an event made in the
 * portal on a Google-connected account (the drawer's Send from, or the host's
 * account for a booking) is created, changed and deleted on that account's
 * primary calendar. Google sends the invitations and the cancellations, and
 * makes the Meet link for an online event. The portal keeps the event either
 * way: when Google refuses, calendar_state says 'failed'. Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessTokenFor } from './google-app'

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export interface EventForGoogle {
  id: number
  title: string
  start_date: string
  end_date: string
  starts_at: string | null
  ends_at: string | null
  time_zone: string | null
  how: 'online' | 'in_person' | null
  place: string | null
  description: string | null
  client: string | null
}

const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 864e5).toISOString().slice(0, 10)

/**
 * What Google is sent for an event. `organizer` is left out of the guests:
 * Google adds the calendar's owner on its own. `meet` asks Google for a new
 * Meet link (an online event that has none yet); `dropMeet` takes it off.
 */
export function eventBody(e: EventForGoogle, guests: string[], organizer: string, opts: { meet: boolean; dropMeet: boolean }): Record<string, unknown> {
  const timed = e.starts_at && e.ends_at
  const seen = new Set<string>([organizer.toLowerCase()])
  const attendees = guests.map(g => g.trim()).filter(g => {
    const k = g.toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  }).map(email => ({ email }))
  const body: Record<string, unknown> = {
    summary: e.title,
    description: [e.description, e.client ? `Client: ${e.client}` : null].filter(Boolean).join('\n\n') || undefined,
    location: e.how === 'in_person' && e.place ? e.place : undefined,
    start: timed ? { dateTime: e.starts_at, timeZone: e.time_zone ?? undefined } : { date: e.start_date },
    end: timed ? { dateTime: e.ends_at, timeZone: e.time_zone ?? undefined } : { date: nextDay(e.end_date) },
    attendees,
    // The portal's own id, so Google's copy can be traced back.
    extendedProperties: { private: { tnPortalEventId: String(e.id) } },
  }
  if (opts.meet) body.conferenceData = { createRequest: { requestId: `tn-${e.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
  else if (opts.dropMeet) body.conferenceData = null
  return body
}

/** The Meet link in Google's answer, if it made one. */
export function meetOf(json: unknown): string | null {
  const j = json as { hangoutLink?: unknown; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: unknown }[] } }
  if (typeof j?.hangoutLink === 'string') return j.hangoutLink
  const v = j?.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri
  return typeof v === 'string' ? v : null
}

async function call(token: string, method: string, url: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method, signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, json }
}

/** Deletes an event from an account's calendar; Google sends the guests its cancellation. Gone already counts as done. */
export async function removeFromGoogle(accountId: number, googleEventId: string): Promise<boolean> {
  try {
    const token = await accessTokenFor(accountId)
    if (!token) return false
    const r = await call(token, 'DELETE', `${API}/${encodeURIComponent(googleEventId)}?sendUpdates=all`)
    if (r.status < 300 || r.status === 404 || r.status === 410) return true
    console.error(`[agenda google] delete event ${googleEventId}: ${r.status}`)
    return false
  } catch (e) {
    console.error('[agenda google] delete event:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Puts a portal event on its Send from account's Google Calendar: creates it,
 * or changes the copy already there. `before` is where the copy was, when the
 * event moved to another account: it is deleted there first. Saves the Google
 * id, the Meet link and calendar_state, and says whether Google took it.
 */
export async function sendToGoogle(eventId: number, before?: { accountId: number | null; googleEventId: string | null }): Promise<boolean> {
  const c = createAdminClient()
  const { data: e, error } = await c.from('agenda_events')
    .select('id, title, start_date, end_date, starts_at, ends_at, time_zone, how, place, description, client, sent_from_account_id, google_event_id, meet_link')
    .eq('id', eventId).maybeSingle()
  if (error || !e) { console.error('[agenda google] event to send:', error?.message ?? 'missing'); return false }
  const fail = async (why: string) => {
    console.error(`[agenda google] event ${eventId}: ${why}`)
    await c.from('agenda_events').update({ calendar_state: 'failed' }).eq('id', eventId)
    return false
  }
  if (e.sent_from_account_id == null) return fail('no account to send from')
  let googleId = e.google_event_id as string | null
  if (before?.googleEventId && before.accountId != null && before.accountId !== e.sent_from_account_id) {
    await removeFromGoogle(before.accountId, before.googleEventId)
    googleId = null
  }
  try {
    const [{ data: acct }, { data: guests }] = await Promise.all([
      c.from('agenda_accounts').select('email').eq('id', e.sent_from_account_id).maybeSingle(),
      c.from('agenda_event_guests').select('email').eq('event_id', eventId),
    ])
    const token = await accessTokenFor(e.sent_from_account_id)
    if (!acct || !token) return fail('the account needs to be connected again')
    const online = e.how === 'online'
    // A copy made by the portal before had Google's Meet link; a sample link is never kept.
    const hasMeet = !!googleId && !!e.meet_link && e.meet_link.startsWith('https://meet.google.com/')
    const body = eventBody(e as EventForGoogle, ((guests ?? []) as { email: string }[]).map(g => g.email), acct.email, { meet: online && !hasMeet, dropMeet: !online && !!googleId })
    let r = googleId
      ? await call(token, 'PATCH', `${API}/${encodeURIComponent(googleId)}?conferenceDataVersion=1&sendUpdates=all`, body)
      : await call(token, 'POST', `${API}?conferenceDataVersion=1&sendUpdates=all`, body)
    // Deleted straight in Google: make it again.
    if (googleId && (r.status === 404 || r.status === 410)) r = await call(token, 'POST', `${API}?conferenceDataVersion=1&sendUpdates=all`, eventBody(e as EventForGoogle, ((guests ?? []) as { email: string }[]).map(g => g.email), acct.email, { meet: online, dropMeet: false }))
    const id = (r.json as { id?: unknown } | null)?.id
    if (r.status >= 300 || typeof id !== 'string') return fail(`Google answered ${r.status}`)
    const { error: upErr } = await c.from('agenda_events').update({
      google_event_id: id, calendar_state: 'done', meet_link: online ? (meetOf(r.json) ?? null) : null,
    }).eq('id', eventId)
    if (upErr) console.error('[agenda google] save Google id:', upErr.message)
    return true
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
