/**
 * The portal's Zoom app, each person's Zoom account and the meetings made on
 * it (migration 167). Server only: the client secret and the tokens never
 * reach a browser.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { isZoomLink, refreshZoom, zoomCall, zoomMeetingBody, zoomMeetingOf, ZoomTokenError, type ZoomApp, type ZoomTokenAnswer } from './zoom-oauth'

/** The app's keys, or null until a Super Admin saves them in Company settings > Integrations. */
export async function loadZoomApp(): Promise<ZoomApp | null> {
  const { data, error } = await createAdminClient().from('app_settings').select('zoom_client_id, zoom_client_secret').eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`The Zoom app could not be read: ${error.message}`)
  if (!data?.zoom_client_id || !data.zoom_client_secret) return null
  return { clientId: data.zoom_client_id, clientSecret: data.zoom_client_secret }
}

export interface ZoomAccount { email: string; status: 'connected' | 'needs_reconnect'; connectedAt: string }

/** A person's Zoom account as Agenda settings and the drawer show it (never its tokens). */
export async function zoomAccountOf(personId: string): Promise<ZoomAccount | null> {
  const { data, error } = await createAdminClient().from('agenda_zoom_accounts').select('email, status, connected_at').eq('person_id', personId).maybeSingle()
  if (error) throw new Error(`The Zoom account could not be read: ${error.message}`)
  return data ? { email: data.email, status: data.status as ZoomAccount['status'], connectedAt: data.connected_at } : null
}

/** What the drawer and bookings need: is Zoom set up, is this person connected, and which link they want by default. */
export async function zoomChoiceOf(personId: string): Promise<{ ready: boolean; connected: boolean; preferred: 'meet' | 'zoom' }> {
  const c = createAdminClient()
  const [app, acct, set] = await Promise.all([
    loadZoomApp(), zoomAccountOf(personId),
    c.from('agenda_person_settings').select('meeting_link').eq('person_id', personId).maybeSingle(),
  ])
  const connected = acct?.status === 'connected'
  // Zoom as the default only counts while Zoom is connected: otherwise a new event starts on Google Meet.
  return { ready: !!app, connected, preferred: connected && set.data?.meeting_link === 'zoom' ? 'zoom' : 'meet' }
}

/** Keeps the Zoom account a person just signed in with. One Zoom account serves one person. */
export async function saveZoomConnection(i: { personId: string; zoomUserId: string; email: string; answer: ZoomTokenAnswer }): Promise<{ ok: true } | { ok: false; reason: 'taken' }> {
  const c = createAdminClient()
  const { data: other, error: readErr } = await c.from('agenda_zoom_accounts').select('person_id').eq('zoom_user_id', i.zoomUserId).neq('person_id', i.personId).maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (other) return { ok: false, reason: 'taken' }
  const now = new Date().toISOString()
  const { error } = await c.from('agenda_zoom_accounts').upsert({
    person_id: i.personId, zoom_user_id: i.zoomUserId, email: i.email, status: 'connected',
    refresh_token: i.answer.refresh_token, access_token: i.answer.access_token,
    access_expires_at: new Date(Date.now() + i.answer.expires_in * 1000).toISOString(), connected_at: now, updated_at: now,
  }, { onConflict: 'person_id' })
  if (error) throw new Error(error.message)
  return { ok: true }
}

/**
 * An access token for a person's Zoom, renewed when it has under five minutes
 * left. Zoom retires the refresh token on every renewal, so the new one is
 * saved with it. When Zoom refuses (the person removed the portal in Zoom) the
 * account is marked "needs reconnect" and null comes back.
 */
export async function zoomTokenFor(personId: string, now = Date.now()): Promise<string | null> {
  const c = createAdminClient()
  const { data: t, error } = await c.from('agenda_zoom_accounts').select('refresh_token, access_token, access_expires_at, status').eq('person_id', personId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!t || t.status !== 'connected') return null
  if (t.access_token && t.access_expires_at && Date.parse(t.access_expires_at) - now > 5 * 60_000) return t.access_token
  const app = await loadZoomApp()
  if (!app) return null
  try {
    const a = await refreshZoom(app, t.refresh_token)
    const { error: upErr } = await c.from('agenda_zoom_accounts').update({
      access_token: a.access_token, refresh_token: a.refresh_token,
      access_expires_at: new Date(now + a.expires_in * 1000).toISOString(), updated_at: new Date(now).toISOString(),
    }).eq('person_id', personId)
    if (upErr) console.error('[agenda zoom] save token:', upErr.message)
    return a.access_token
  } catch (e) {
    if (e instanceof ZoomTokenError && (e.code === 'invalid_grant' || e.code === 'invalid_request' || e.code === 'http_400' || e.code === 'http_401')) {
      await c.from('agenda_zoom_accounts').update({ status: 'needs_reconnect' }).eq('person_id', personId)
      return null
    }
    throw e
  }
}

/** Deletes a meeting the portal made. Gone already counts as done. */
export async function removeZoomMeeting(personId: string | null, meetingId: string | null): Promise<boolean> {
  if (!personId || !meetingId) return true
  try {
    const token = await zoomTokenFor(personId)
    if (!token) return false
    const r = await zoomCall(token, 'DELETE', `/meetings/${encodeURIComponent(meetingId)}`)
    if (r.status < 300 || r.status === 404) return true
    console.error(`[agenda zoom] delete meeting ${meetingId}: ${r.status}`)
    return false
  } catch (e) {
    console.error('[agenda zoom] delete meeting:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Brings an event's Zoom meeting in line with the event, before it goes to
 * Google (which carries the link in the invitation):
 *
 *   online by Zoom, no meeting yet   made on `hostId`'s Zoom, link saved
 *   online by Zoom, the portal's own changed there (title, time)
 *   online by Zoom, a link it did not make (one occurrence of a series, an
 *     event that came from Google)   left as it is
 *   no longer by Zoom                the portal's meeting is deleted
 *
 * 'failed': Zoom did not take it; the event stays, without a link.
 */
export async function syncZoomMeeting(eventId: number, hostId: string): Promise<'ok' | 'none' | 'failed'> {
  const c = createAdminClient()
  const { data: e, error } = await c.from('agenda_events')
    .select('id, title, starts_at, ends_at, time_zone, how, description, recurrence, online_via, meet_link, zoom_meeting_id, zoom_person_id')
    .eq('id', eventId).maybeSingle()
  if (error || !e) { console.error('[agenda zoom] event:', error?.message ?? 'missing'); return 'failed' }
  const zoom = e.how === 'online' && e.online_via === 'zoom'
  try {
    if (!zoom) {
      if (!e.zoom_meeting_id) return 'none'
      await removeZoomMeeting(e.zoom_person_id, e.zoom_meeting_id)
      await c.from('agenda_events').update({ zoom_meeting_id: null, zoom_person_id: null, ...(isZoomLink(e.meet_link) ? { meet_link: null } : {}) }).eq('id', eventId)
      return 'none'
    }
    if (e.zoom_meeting_id) {
      const token = await zoomTokenFor(e.zoom_person_id ?? hostId)
      if (!token) return 'failed'
      const r = await zoomCall(token, 'PATCH', `/meetings/${encodeURIComponent(e.zoom_meeting_id)}`, zoomMeetingBody(e))
      if (r.status < 300) {
        // The link went missing (taken out of the invitation in Google): Zoom still has it.
        if (!isZoomLink(e.meet_link)) {
          const got = zoomMeetingOf((await zoomCall(token, 'GET', `/meetings/${encodeURIComponent(e.zoom_meeting_id)}`)).json)
          if (got) await c.from('agenda_events').update({ meet_link: got.link }).eq('id', eventId)
        }
        return 'ok'
      }
      // Deleted straight in Zoom: made again below.
      if (r.status !== 404) { console.error(`[agenda zoom] change meeting ${e.zoom_meeting_id}: ${r.status}`); return 'failed' }
    } else if (isZoomLink(e.meet_link)) {
      return 'ok'
    }
    const token = await zoomTokenFor(hostId)
    if (!token) { await c.from('agenda_events').update({ meet_link: null, zoom_meeting_id: null }).eq('id', eventId); return 'failed' }
    const r = await zoomCall(token, 'POST', '/users/me/meetings', zoomMeetingBody(e))
    const made = r.status < 300 ? zoomMeetingOf(r.json) : null
    if (!made) {
      console.error(`[agenda zoom] create meeting for event ${eventId}: ${r.status}`)
      await c.from('agenda_events').update({ meet_link: null, zoom_meeting_id: null }).eq('id', eventId)
      return 'failed'
    }
    const { error: upErr } = await c.from('agenda_events').update({ meet_link: made.link, zoom_meeting_id: made.id, zoom_person_id: hostId }).eq('id', eventId)
    if (upErr) console.error('[agenda zoom] save link:', upErr.message)
    return 'ok'
  } catch (err) {
    console.error('[agenda zoom] sync:', err instanceof Error ? err.message : err)
    return 'failed'
  }
}
