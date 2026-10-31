/**
 * Google sign-in for the Agenda (owner, 30 October 2026): the address that
 * sends a person to Google, the answer Google sends back, and the tokens.
 * The app is "True North Operations Portal" in True North's Google Cloud,
 * External but not yet verified by Google (owner, 30 October 2026): any
 * Google account can connect after Google's "not verified" warning, up to
 * 100 people. Not a "use server" file; no database here.
 */

import { APPROVED_DOMAIN } from './accounts'

/** What the portal asks for: who the account is, its events and when it is busy. */
export const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
] as const

/** Only the team calendar (office@) also saves receipts and invoices, and sees only the Drive files the portal makes. */
export const TEAM_SCOPES = [...SCOPES, 'https://www.googleapis.com/auth/drive.file'] as const

/** Without these the account is no use to the Agenda; Drive is only for office@. */
const NEEDED = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy']

export const CALLBACK_PATH = '/api/agenda/google/callback'
export const STATE_COOKIE = 'tn_google_connect'

export type ConnectFor = 'me' | 'team'

export interface GoogleApp { clientId: string; clientSecret: string }

/** The Google page the person signs in on. Asking for consent every time is what gives a refresh token again on a reconnect. */
export function authUrl(app: Pick<GoogleApp, 'clientId'>, redirectUri: string, state: string, purpose: ConnectFor, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: (purpose === 'team' ? TEAM_SCOPES : SCOPES).join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  })
  if (loginHint) q.set('login_hint', loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

/** The cookie that ties Google's answer to the person who asked: "<state>.<me|team>.<person id>". */
export function stateCookie(state: string, purpose: ConnectFor, personId: string): string {
  return `${state}.${purpose}.${personId}`
}

export function readStateCookie(raw: string | undefined): { state: string; purpose: ConnectFor; personId: string } | null {
  const m = /^([A-Za-z0-9_-]{20,})\.(me|team)\.([0-9a-f-]{36})$/.exec(raw ?? '')
  return m ? { state: m[1], purpose: m[2] as ConnectFor, personId: m[3] } : null
}

/**
 * Who signed in, from the ID token. It came straight from Google's token
 * address over TLS in the same request, so its signature is not checked
 * again here (Google's own advice for this case).
 */
export function idTokenClaims(idToken: string): { email: string; sub: string; verified: boolean } | null {
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    const c = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { email?: unknown; sub?: unknown; email_verified?: unknown }
    if (typeof c.email !== 'string' || typeof c.sub !== 'string') return null
    return { email: c.email.toLowerCase(), sub: c.sub, verified: c.email_verified === true || c.email_verified === 'true' }
  } catch {
    return null
  }
}

/** The scopes the person unticked on Google's page that the Agenda cannot do without. */
export function missingScopes(granted: string): string[] {
  const have = new Set(granted.split(/\s+/).filter(Boolean))
  return NEEDED.filter(s => !have.has(s))
}

export const onApprovedDomain = (email: string) => email.toLowerCase().endsWith(`@${APPROVED_DOMAIN}`)

export interface TokenAnswer { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string }

/** A Google token error: "invalid_grant" means the person took the access away, so the account needs a reconnect. */
export class GoogleTokenError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}

async function token(body: Record<string, string>): Promise<TokenAnswer> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const json = await res.json().catch(() => ({})) as Partial<TokenAnswer> & { error?: string; error_description?: string }
  if (!res.ok || !json.access_token) throw new GoogleTokenError(json.error ?? `http_${res.status}`, json.error_description ?? `Google answered ${res.status}.`)
  return json as TokenAnswer
}

export function exchangeCode(app: GoogleApp, code: string, redirectUri: string): Promise<TokenAnswer> {
  return token({ code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
}

export function refreshAccess(app: GoogleApp, refreshToken: string): Promise<TokenAnswer> {
  return token({ refresh_token: refreshToken, client_id: app.clientId, client_secret: app.clientSecret, grant_type: 'refresh_token' })
}

/** Disconnect also tells Google, so the portal disappears from the person's Google account. Best effort. */
export async function revoke(tokenValue: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokenValue }) })
  } catch (e) {
    console.error('[agenda google] revoke:', e instanceof Error ? e.message : e)
  }
}

/** What Agenda settings says after Google sends the person back (?google=<code>&email=). Unknown codes say nothing. */
export function connectNotice(code: string | null | undefined, email?: string | null): { text: string; error: boolean } | null {
  const who = email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : 'That account'
  const ok = (text: string) => ({ text, error: false })
  const bad = (text: string) => ({ text, error: true })
  switch (code) {
    case 'connected': return ok(`${who} is connected to Google.`)
    case 'team_connected': return ok(`${who} is the team calendar, connected to Google.`)
    case 'cancelled': return bad('Nothing was connected: the Google sign-in was cancelled.')
    case 'expired': return bad('That sign-in took too long or was opened twice. Click Connect again.')
    case 'signin': return bad('Sign in to the portal again, then connect.')
    case 'not_allowed': return bad('Only a Super Admin connects the team calendar.')
    case 'no_app': return bad('Google sign-in is not set up yet. A Super Admin adds the app\'s keys in Company settings > Integrations.')
    case 'domain': return bad(`${who} was not connected: the team calendar is an @${APPROVED_DOMAIN} account (office@).`)
    case 'scopes': return bad(`${who} was not connected: on Google's page, leave the calendar boxes ticked so the portal can create events and see when you are busy.`)
    case 'taken': return bad(`${who} is already connected by someone else.`)
    case 'is_team': return bad(`${who} is the team calendar, so it connects from the Team calendar box above (Reconnect), not as your own account.`)
    case 'personal': return bad(`${who} is connected as someone's own account, so it cannot be the team calendar.`)
    case 'no_refresh': return bad('Google did not give the portal lasting access. Click Connect again.')
    case 'failed': return bad('Google did not finish the sign-in. Try again in a moment.')
    default: return null
  }
}
