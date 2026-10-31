/**
 * The portal's Google app and the connected accounts' tokens (migration 139).
 * Server only: the client secret and the tokens never reach a browser.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleTokenError, refreshAccess, type GoogleApp, type TokenAnswer } from './google-oauth'

/** The app's keys, or null until a Super Admin saves them in Company settings > Integrations. */
export async function loadGoogleApp(): Promise<(GoogleApp & { pickerKey: string | null }) | null> {
  const { data, error } = await createAdminClient().from('app_settings')
    .select('google_oauth_client_id, google_oauth_client_secret, google_picker_key').eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`The Google app could not be read: ${error.message}`)
  if (!data?.google_oauth_client_id || !data.google_oauth_client_secret) return null
  return { clientId: data.google_oauth_client_id, clientSecret: data.google_oauth_client_secret, pickerKey: data.google_picker_key ?? null }
}

/**
 * Keeps an account that just signed in: the person's own (or the team
 * calendar for a Super Admin), source 'google', with its tokens. A sample
 * account with the same address becomes the real one, keeping its id, so
 * events, the booking link and "Invitations to you go to" stay on it.
 */
export async function saveConnection(i: {
  purpose: 'me' | 'team'; personId: string; email: string; sub: string; answer: TokenAnswer
}): Promise<{ ok: true; accountId: number } | { ok: false; reason: 'taken' | 'is_team' | 'personal' | 'no_refresh' }> {
  const c = createAdminClient()
  const { data: existing, error: readErr } = await c.from('agenda_accounts').select('id, person_id, team_calendar').ilike('email', i.email).maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (existing) {
    if (i.purpose === 'me' && existing.team_calendar) return { ok: false, reason: 'is_team' }
    if (i.purpose === 'me' && existing.person_id !== i.personId) return { ok: false, reason: 'taken' }
    if (i.purpose === 'team' && !existing.team_calendar) return { ok: false, reason: 'personal' }
  }
  // Without a refresh token the portal could only act for an hour. Google sends one on consent, which the sign-in always asks for.
  let refresh = i.answer.refresh_token
  if (!refresh && existing) {
    const { data: t } = await c.from('agenda_account_tokens').select('refresh_token').eq('account_id', existing.id).maybeSingle()
    refresh = t?.refresh_token
  }
  if (!refresh) return { ok: false, reason: 'no_refresh' }

  let accountId: number
  const now = new Date().toISOString()
  if (existing) {
    const { error } = await c.from('agenda_accounts').update({ source: 'google', status: 'connected', connected_by: i.personId, connected_at: now }).eq('id', existing.id)
    if (error) throw new Error(error.message)
    accountId = existing.id
  } else {
    if (i.purpose === 'team') {
      const { error } = await c.from('agenda_accounts').delete().eq('team_calendar', true)
      if (error) throw new Error(error.message)
    }
    const { data, error } = await c.from('agenda_accounts').insert(i.purpose === 'team'
      ? { person_id: null, team_calendar: true, email: i.email, source: 'google', connected_by: i.personId }
      : { person_id: i.personId, email: i.email, source: 'google', connected_by: i.personId }).select('id').single()
    if (error) throw new Error(error.message)
    accountId = data.id
  }
  // Busy times read from the sample give way to Google's on the next read.
  await c.from('agenda_busy').delete().eq('account_id', accountId).eq('source', 'sample')
  const { error } = await c.from('agenda_account_tokens').upsert({
    account_id: accountId, refresh_token: refresh, access_token: i.answer.access_token,
    access_expires_at: new Date(Date.now() + i.answer.expires_in * 1000).toISOString(),
    scopes: (i.answer.scope ?? '').split(/\s+/).filter(Boolean), google_sub: i.sub, updated_at: now,
  }, { onConflict: 'account_id' })
  if (error) throw new Error(error.message)
  return { ok: true, accountId }
}

/**
 * An access token for an account, renewed when it has under five minutes
 * left. When Google refuses the refresh token (the person removed the portal
 * from their Google account) the account is marked "needs reconnect" and
 * null comes back.
 */
export async function accessTokenFor(accountId: number, now = Date.now()): Promise<string | null> {
  const c = createAdminClient()
  const { data: t, error } = await c.from('agenda_account_tokens').select('refresh_token, access_token, access_expires_at').eq('account_id', accountId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!t) return null
  if (t.access_token && t.access_expires_at && Date.parse(t.access_expires_at) - now > 5 * 60_000) return t.access_token
  const app = await loadGoogleApp()
  if (!app) return null
  try {
    const a = await refreshAccess(app, t.refresh_token)
    await c.from('agenda_account_tokens').update({
      access_token: a.access_token, access_expires_at: new Date(now + a.expires_in * 1000).toISOString(), updated_at: new Date(now).toISOString(),
      ...(a.refresh_token ? { refresh_token: a.refresh_token } : {}),
    }).eq('account_id', accountId)
    return a.access_token
  } catch (e) {
    if (e instanceof GoogleTokenError && e.code === 'invalid_grant') {
      await c.from('agenda_accounts').update({ status: 'needs_reconnect' }).eq('id', accountId)
      return null
    }
    throw e
  }
}
