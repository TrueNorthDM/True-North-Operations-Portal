/**
 * Zoom sign-in for the Agenda (owner, 12 November 2026): the address that
 * sends a person to Zoom, the answer Zoom sends back, the tokens, and the
 * meeting calls. Each person connects their own Zoom account; the portal's
 * Zoom app (a "General app", user-managed, kept inside True North's Zoom
 * account) is entered in Company settings > Integrations. What it may do is
 * set on the app itself in Zoom, not asked for here: read the user, and
 * create, change and delete meetings. Not a "use server" file; no database.
 */

export const ZOOM_CALLBACK_PATH = '/api/agenda/zoom/callback'
export const ZOOM_STATE_COOKIE = 'tn_zoom_connect'

export interface ZoomApp { clientId: string; clientSecret: string }
export interface ZoomTokenAnswer { access_token: string; refresh_token: string; expires_in: number; scope?: string }

/** A Zoom token error: "invalid_grant" means the access was taken away in Zoom, so the account needs a reconnect. */
export class ZoomTokenError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}

export function zoomAuthUrl(app: Pick<ZoomApp, 'clientId'>, redirectUri: string, state: string): string {
  return `https://zoom.us/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: app.clientId, redirect_uri: redirectUri, state })}`
}

/** The cookie that ties Zoom's answer to the person who asked, and where to send them after: "<state>.<person id>.<s|d>" (settings or the drawer). */
export function zoomStateCookie(state: string, personId: string, from: 'settings' | 'agenda'): string {
  return `${state}.${personId}.${from === 'agenda' ? 'a' : 's'}`
}

export function readZoomStateCookie(raw: string | undefined): { state: string; personId: string; from: 'settings' | 'agenda' } | null {
  const m = /^([A-Za-z0-9_-]{20,})\.([0-9a-f-]{36})\.([as])$/.exec(raw ?? '')
  return m ? { state: m[1], personId: m[2], from: m[3] === 'a' ? 'agenda' : 'settings' } : null
}

const basic = (app: ZoomApp) => `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString('base64')}`

async function token(app: ZoomApp, body: Record<string, string>): Promise<ZoomTokenAnswer> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: basic(app), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const json = await res.json().catch(() => ({})) as Partial<ZoomTokenAnswer> & { error?: string; reason?: string; error_description?: string }
  if (!res.ok || !json.access_token || !json.refresh_token) throw new ZoomTokenError(json.error ?? `http_${res.status}`, json.reason ?? json.error_description ?? `Zoom answered ${res.status}.`)
  return json as ZoomTokenAnswer
}

export const exchangeZoomCode = (app: ZoomApp, code: string, redirectUri: string) =>
  token(app, { grant_type: 'authorization_code', code, redirect_uri: redirectUri })

/** Zoom gives a new refresh token with every refresh and retires the old one: the caller must keep the new one. */
export const refreshZoom = (app: ZoomApp, refreshToken: string) =>
  token(app, { grant_type: 'refresh_token', refresh_token: refreshToken })

/** Disconnect also tells Zoom. Best effort. */
export async function revokeZoom(app: ZoomApp, tokenValue: string): Promise<void> {
  try {
    await fetch('https://zoom.us/oauth/revoke', { method: 'POST', signal: AbortSignal.timeout(10_000), headers: { Authorization: basic(app), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokenValue }) })
  } catch (e) {
    console.error('[agenda zoom] revoke:', e instanceof Error ? e.message : e)
  }
}

const API = 'https://api.zoom.us/v2'

export async function zoomCall(accessToken: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}${path}`, {
    method, signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, json }
}

/** Who signed in: their Zoom user id and address. */
export async function zoomMe(accessToken: string): Promise<{ id: string; email: string } | null> {
  const r = await zoomCall(accessToken, 'GET', '/users/me')
  const j = r.json as { id?: unknown; email?: unknown } | null
  return r.status < 300 && typeof j?.id === 'string' && typeof j.email === 'string' ? { id: j.id, email: j.email.toLowerCase() } : null
}

export interface EventForZoom {
  title: string
  starts_at: string | null
  ends_at: string | null
  time_zone: string | null
  description: string | null
  /** A series keeps one link for every occurrence. */
  recurrence?: string | null
}

/**
 * What Zoom is sent for an event. One event is a scheduled meeting at its
 * time; a series is a recurring meeting with no fixed time (Zoom's type 3),
 * so one link serves every occurrence and the days stay Google's to keep.
 * The meeting's other settings (waiting room, passcode) stay the person's own
 * Zoom defaults.
 */
export function zoomMeetingBody(e: EventForZoom): Record<string, unknown> {
  const topic = e.title.slice(0, 200)
  const agenda = e.description ? e.description.slice(0, 2000) : undefined
  if (e.recurrence || !e.starts_at || !e.ends_at) return { topic, type: 3, agenda }
  const minutes = Math.max(1, Math.round((Date.parse(e.ends_at) - Date.parse(e.starts_at)) / 60_000))
  return { topic, type: 2, start_time: new Date(e.starts_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), duration: minutes, timezone: e.time_zone ?? undefined, agenda }
}

/** The meeting's id and join link in Zoom's answer. */
export function zoomMeetingOf(json: unknown): { id: string; link: string } | null {
  const j = json as { id?: unknown; join_url?: unknown } | null
  const id = typeof j?.id === 'number' || typeof j?.id === 'string' ? String(j.id) : null
  return id && typeof j?.join_url === 'string' ? { id, link: j.join_url } : null
}

/** A Zoom join link, on any of Zoom's addresses (zoom.us, us02web.zoom.us, a vanity name). */
export const isZoomLink = (link: string | null | undefined): boolean => !!link && /^https:\/\/([a-z0-9-]+\.)*zoom\.(us|com)\/(j|my|w|s)\//i.test(link)

/** The line the Google invitation's description ends with, and how it is found again on the way back. */
export const ZOOM_LINE = 'Join Zoom meeting: '
export const withZoomLine = (description: string | null | undefined, link: string): string =>
  [description?.trim() || null, `${ZOOM_LINE}${link}`].filter(Boolean).join('\n\n')
export function withoutZoomLine(description: string | null | undefined): string | null {
  const d = (description ?? '').split('\n').filter(l => !l.trim().startsWith(ZOOM_LINE)).join('\n').trim()
  return d || null
}

/** What Agenda settings says after Zoom sends the person back (?zoom=<code>). Unknown codes say nothing. */
export function zoomNotice(code: string | null | undefined, email?: string | null): { text: string; error: boolean } | null {
  const who = email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : 'Your Zoom account'
  const ok = (text: string) => ({ text, error: false })
  const bad = (text: string) => ({ text, error: true })
  switch (code) {
    case 'connected': return ok(`${who} is connected to Zoom.`)
    case 'cancelled': return bad('Zoom was not connected. Nothing changed, and you can try again any time.')
    case 'expired': return bad('That sign-in took too long or was opened twice. Click Connect Zoom again.')
    case 'signin': return bad('Sign in to the portal again, then connect Zoom.')
    case 'no_app': return bad('Zoom is not set up yet. A Super Admin adds the Zoom app\'s keys in Company settings > Integrations.')
    case 'taken': return bad(`${who} is already connected by someone else.`)
    case 'failed': return bad('Zoom did not finish the sign-in. Try again in a moment.')
    default: return null
  }
}
