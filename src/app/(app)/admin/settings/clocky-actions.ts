'use server'

/**
 * Company settings for Clocky part 2 (Company Settings.dc.html 13A, 13B, 13C):
 * the Rippling token, the Google service account and calendars, Test
 * connection and Try again; invoice numbering and billing details; the
 * reminders. Super Admins only (the sections' -edit items), for the person
 * really signed in and never in a View Stage preview (allowedTo). Credentials
 * are written, never sent back; their changes are logged without the value.
 */

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { accessToken, parseServiceAccount } from '@/lib/integrations/google-calendar'
import { releaseWaiting } from '@/lib/integrations/outbox'
import { REMINDERS, type ReminderKey } from '@/lib/timeclock/company-settings'
import { allRows } from '@/lib/timeclock/clocky-context'
import { seqOf } from '@/lib/timeclock/doc-number'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const refresh = () => revalidatePath('/admin/settings')

async function logChange(setting: string, action: string): Promise<void> {
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('settings_change_log').insert({ setting, action, actor_person_id: me?.id ?? null, actor_name: me?.full_name ?? null, actor_email: null })
  if (error) console.error('[settings] the change was not logged:', error.message)
}

// ── 13A Integrations ────────────────────────────────────────────────────────

export async function saveRipplingToken(input: { token: string }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const token = String(input.token ?? '').trim()
  if (token.length < 16 || /\s/.test(token)) return no('Paste the whole Rippling API token.')
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('app_settings').update({ rippling_api_token: token, rippling_connected_by: me?.id ?? null, rippling_connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] rippling:', error.message); return no(NOT_SAVED) }
  await logChange('rippling_api_token', 'saved')
  refresh()
  return { ok: true, toast: 'Saved. Rippling gets what waits once the portal\'s Rippling calls are written.' }
}

export async function removeRipplingToken(): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const { error } = await createAdminClient().from('app_settings').update({ rippling_api_token: null, rippling_connected_by: null, rippling_connected_at: null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] rippling:', error.message); return no(NOT_SAVED) }
  await logChange('rippling_api_token', 'removed')
  refresh()
  return { ok: true, toast: 'Removed. Nothing goes to Rippling until a token is saved again.' }
}

/** The service account key (only when a new one is pasted) and the team calendar. Connecting sends what waited for Google. */
export async function saveGoogle(input: { serviceAccount?: string; teamCalendarId: string }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const c = createAdminClient()
  const team = String(input.teamCalendarId ?? '').trim()
  if (team && !/^[^\s]+@[^\s]+$/.test(team)) return no('The team calendar ID looks like an address, for example c_xxx@group.calendar.google.com.')
  const patch: { google_team_calendar_id: string | null; updated_at: string; google_service_account?: string; google_connected_by?: string | null; google_connected_at?: string } = { google_team_calendar_id: team || null, updated_at: new Date().toISOString() }
  const key = String(input.serviceAccount ?? '').trim()
  if (key) {
    try { parseServiceAccount(key) } catch (e) { return no(e instanceof Error ? e.message : 'That key is not a Google service account.') }
    const me = await getRealPerson()
    patch.google_service_account = key
    patch.google_connected_by = me?.id ?? null
    patch.google_connected_at = new Date().toISOString()
  }
  // Unread is not "no key": saving on a guess would say "Add the key" and leave the waiting jobs where they are.
  const { data: before, error: readError } = await c.from('app_settings').select('google_service_account').eq('singleton_id', 1).maybeSingle()
  if (readError) { console.error('[settings] google read:', readError.message); return no(NOT_SAVED) }
  const { error } = await c.from('app_settings').update(patch).eq('singleton_id', 1)
  if (error) { console.error('[settings] google:', error.message); return no(NOT_SAVED) }
  if (key) await logChange('google_service_account', 'saved')
  const connected = !!(key || before?.google_service_account) && !!team
  // Saved either way: what waited for Google is released now, or by the next save or retry.
  let released = 0, stuck = false
  if (connected) {
    try { released = await releaseWaiting('google') } catch (e) { stuck = true; console.error('[settings] google release:', e instanceof Error ? e.message : e) }
  }
  refresh()
  return { ok: true, toast: !connected ? 'Saved. Add the service account key and the team calendar to connect it.'
    : stuck ? 'Saved and connected. What waited for the calendar could not be sent yet: try again in a moment.'
      : `Saved and connected.${released ? ` ${released} waiting item${released === 1 ? '' : 's'} go to the calendar in the next few minutes.` : ''}` }
}

export async function removeGoogle(): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const { error } = await createAdminClient().from('app_settings').update({ google_service_account: null, google_connected_by: null, google_connected_at: null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] google:', error.message); return no(NOT_SAVED) }
  await logChange('google_service_account', 'removed')
  refresh()
  return { ok: true, toast: 'Removed. Nothing goes to the calendar until a key is saved again.' }
}

/** Test connection: a token from the key, then a read of the team calendar. */
export async function testGoogle(): Promise<Done> {
  if (!(await allowedTo('cs-integrations'))) return no('Integrations is not open to your access.')
  const c = createAdminClient()
  const { data: s } = await c.from('app_settings').select('google_service_account, google_team_calendar_id').eq('singleton_id', 1).maybeSingle()
  if (!s?.google_service_account) return no('Google Calendar is not connected: paste the service account key first.')
  try {
    const token = await accessToken(parseServiceAccount(s.google_service_account))
    const read = async (id: string) => {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
      return res.ok
    }
    const team = s.google_team_calendar_id ? await read(s.google_team_calendar_id) : null
    await c.from('app_settings').update({ google_checked_at: new Date().toISOString() }).eq('singleton_id', 1)
    refresh()
    const part = team === null ? 'no team calendar is set' : team ? 'the team calendar can be read' : 'the team calendar is not shared with the service account'
    return team ? { ok: true, toast: `Google Calendar answered: ${part}.` } : no(`Google Calendar answered, but ${part}.`)
  } catch (e) {
    return no(e instanceof Error ? e.message : 'Google Calendar did not answer.')
  }
}

const CLIENT_ID = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/
const BLANK_KEY = /^[A-Za-z0-9_-]{20,}$/

/**
 * The portal's own Google app (migration 139): the "Portal web" client of the
 * project "True North Operations Portal", and the Picker key. A blank secret
 * or key keeps the one saved, so the Client ID can be fixed alone.
 */
export async function saveGoogleApp(input: { clientId: string; clientSecret?: string; pickerKey?: string }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const clientId = String(input.clientId ?? '').trim()
  const secret = String(input.clientSecret ?? '').trim()
  const picker = String(input.pickerKey ?? '').trim()
  if (!CLIENT_ID.test(clientId)) return no('The Client ID ends in .apps.googleusercontent.com. Copy it from Google Auth Platform > Clients > Portal web.')
  if (secret && !BLANK_KEY.test(secret)) return no('Paste the whole Client secret, the "client_secret" value in the JSON file.')
  if (picker && !BLANK_KEY.test(picker)) return no('Paste the whole Picker API key.')
  const c = createAdminClient()
  const { data: before, error: readError } = await c.from('app_settings').select('google_oauth_client_secret').eq('singleton_id', 1).maybeSingle()
  if (readError) { console.error('[settings] google app read:', readError.message); return no(NOT_SAVED) }
  if (!secret && !before?.google_oauth_client_secret) return no('Paste the Client secret too.')
  const me = await getRealPerson()
  const patch: { google_oauth_client_id: string; google_oauth_saved_by: string | null; google_oauth_saved_at: string; updated_at: string; google_oauth_client_secret?: string; google_picker_key?: string } = { google_oauth_client_id: clientId, google_oauth_saved_by: me?.id ?? null, google_oauth_saved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (secret) patch.google_oauth_client_secret = secret
  if (picker) patch.google_picker_key = picker
  const { error } = await c.from('app_settings').update(patch).eq('singleton_id', 1)
  if (error) { console.error('[settings] google app:', error.message); return no(NOT_SAVED) }
  await logChange('google_oauth_app', secret || picker ? 'saved' : 'client id changed')
  refresh()
  return { ok: true, toast: 'Saved. People can now connect their Google accounts in Agenda settings.' }
}

export async function removeGoogleApp(): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins change the integrations.')
  const { error } = await createAdminClient().from('app_settings').update({ google_oauth_client_id: null, google_oauth_client_secret: null, google_picker_key: null, google_oauth_saved_by: null, google_oauth_saved_at: null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] google app:', error.message); return no(NOT_SAVED) }
  await logChange('google_oauth_app', 'removed')
  refresh()
  return { ok: true, toast: 'Removed. Nobody can connect a Google account until the keys are saved again; accounts already connected keep their access until then.' }
}

/**
 * What the Drive folder Picker needs in the Super Admin's browser: office@'s
 * short-lived token, the Picker key and the app number. The token sees only
 * what the portal made or what is picked (drive.file) and expires in an hour.
 */
const fail = (error: string) => ({ ok: false as const, error })
export async function drivePicker(): Promise<{ ok: true; token: string; key: string; appId: string } | { ok: false; error: string }> {
  if (!(await allowedTo('cs-integrations-edit'))) return fail('Only Super Admins pick the Drive folder.')
  const { driveAccount, driveToken } = await import('@/lib/agenda/google-drive')
  const a = await driveAccount()
  if (!a.ok) return fail(a.why)
  const { data } = await createAdminClient().from('app_settings').select('google_oauth_client_id, google_picker_key').eq('singleton_id', 1).maybeSingle()
  if (!data?.google_picker_key || !data.google_oauth_client_id) return fail('Save the Picker key in Google sign-in first (Change keys).')
  const token = await driveToken()
  if (!token) return fail(`${a.email} needs to be connected again in Agenda settings.`)
  return { ok: true, token, key: data.google_picker_key, appId: data.google_oauth_client_id.split('-')[0] }
}

/** The folder picked in the Picker: the portal writes receipts and invoices there. */
export async function saveDriveFolder(input: { id: string; name: string }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins pick the Drive folder.')
  const id = String(input?.id ?? '').trim(), name = String(input?.name ?? '').trim().slice(0, 200)
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return no('That is not a Drive folder. Pick it again.')
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('app_settings').update({ drive_folder_id: id, drive_folder_name: name || 'Drive folder', drive_folder_by: me?.id ?? null, drive_folder_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] drive folder:', error.message); return no(NOT_SAVED) }
  await logChange('drive_folder', `picked ${name}`)
  refresh()
  return { ok: true, toast: `Saved. The portal writes into "${name}".` }
}

/** Writes a small text file into the picked folder, to show the connection works end to end. */
export async function testDrive(): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins test the integrations.')
  try {
    const { saveToDrive } = await import('@/lib/agenda/google-drive')
    const text = `The True North Operations Portal can write into this folder. Written ${new Date().toISOString()}. You can delete this file.`
    await saveToDrive({ name: 'Portal connection test.txt', mime: 'text/plain', bytes: new TextEncoder().encode(text) })
    return { ok: true, toast: 'It works: "Portal connection test.txt" is in the folder. You can delete it there.' }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'Drive did not answer. Try again in a moment.')
  }
}

/** Try again on one failed item of the outbox; its request shows it waiting again. */
export async function retryIntegrationJob(input: { id: number }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins try again.')
  const c = createAdminClient()
  try {
    const { data: j, error } = await c.from('integration_jobs').select('id, kind, ref_table, ref_id, state').eq('id', Number(input.id)).maybeSingle()
    if (error) throw new Error(error.message)
    if (!j || j.state !== 'failed') return no('That item is not waiting to be tried again.')
    const { retryJobs } = await import('@/lib/integrations/outbox')
    await retryJobs(j.ref_table, j.ref_id, [j.kind as Parameters<typeof retryJobs>[2][number]])
    if (j.ref_table === 'tc_absence_requests' && j.kind === 'rippling_pto') await c.from('tc_absence_requests').update({ rippling_state: 'waiting_connection', rippling_error: null }).eq('id', j.ref_id)
    if (j.ref_table === 'tc_absence_requests' && j.kind === 'gcal_upsert') await c.from('tc_absence_requests').update({ calendar_state: 'queued' }).eq('id', j.ref_id)
  } catch (e) {
    console.error('[settings] retry:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
  refresh()
  return { ok: true, toast: 'Queued again. It goes in the next few minutes, or when its connection works.' }
}

// ── 13B Invoices ────────────────────────────────────────────────────────────

export async function saveInvoiceSettings(input: { prefix: string; nextNumber: string; rmbPrefix: string; billingName: string; address: string; country: string; email: string; paymentDays: string; mileageRate: string }): Promise<Done> {
  if (!(await allowedTo('cs-invoices-edit'))) return no('Only Super Admins change the invoice settings.')
  const prefix = String(input.prefix ?? '').trim().toUpperCase()
  const rmb = String(input.rmbPrefix ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2,6}$/.test(prefix) || !/^[A-Z]{2,6}$/.test(rmb)) return no('A prefix is 2 to 6 letters, like INV or RMB.')
  if (prefix === rmb) return no('Invoices and reimbursement documents need different prefixes.')
  const next = Number(String(input.nextNumber ?? '').trim())
  if (!Number.isInteger(next) || next < 1 || next > 9999) return no('The next number goes from 1 to 9999.')
  const days = Number(String(input.paymentDays ?? '').trim())
  if (!Number.isInteger(days) || days < 0 || days > 120) return no('Payment terms go from 0 to 120 days.')
  // Mileage (Tina's review, 29 October 2026): dollars a mile, like 0.76.
  const rateRaw = String(input.mileageRate ?? '').trim().replace(/^\$/, '')
  const rate = Number(rateRaw)
  if (!/^\d+(\.\d{1,3})?$/.test(rateRaw) || !(rate > 0 && rate <= 5)) return no('The mileage rate is dollars a mile, like 0.76.')
  const email = String(input.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return no('The billing email is not an address.')
  const name = String(input.billingName ?? '').trim().slice(0, 200)
  if (!name) return no('Write the billing name.')
  const c = createAdminClient()
  // The count runs across years, so a number used in any year cannot be given again.
  let used: { number: string }[]
  try {
    used = await allRows<{ number: string }>((from, to) => c.from('invoices').select('number').like('number', `${prefix}-%`).order('id').range(from, to), 'Invoice numbers')
  } catch (e) {
    console.error('[settings] invoices:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
  const top = used.reduce<{ n: number; number: string }>((m, u) => (seqOf(u.number) > m.n ? { n: seqOf(u.number), number: u.number } : m), { n: 0, number: '' })
  if (next <= top.n) return no(`${top.number} is already used: the next number must be ${top.n + 1} or more.`)
  const me = await getRealPerson()
  const { error } = await c.from('invoice_settings').update({
    prefix, next_number: next, rmb_prefix: rmb, billing_name: name,
    billing_address: [String(input.address ?? '').trim(), String(input.country ?? '').trim()].filter(Boolean).join('\n') || null,
    billing_email: email || null, payment_days: days, mileage_rate: rate, updated_by: me?.id ?? null, updated_at: new Date().toISOString(),
  }).eq('singleton_id', 1)
  if (error) { console.error('[settings] invoices:', error.message); return no(NOT_SAVED) }
  refresh()
  return { ok: true, toast: 'Saved. New invoices use these details; approved ones stay as they were.' }
}

// ── 13C Reminders ───────────────────────────────────────────────────────────

export async function setReminder(input: { key: ReminderKey; on: boolean }): Promise<Done> {
  if (!(await allowedTo('cs-reminders-edit'))) return no('Only Super Admins change the reminders.')
  if (!REMINDERS.some(r => r.key === input.key)) return no('No such reminder.')
  const c = createAdminClient()
  // Unread is not "none set": the others would be written back as missing, and missing reads as on.
  const { data, error: readError } = await c.from('app_settings').select('clocky_reminders').eq('singleton_id', 1).maybeSingle()
  if (readError) { console.error('[settings] reminders:', readError.message); return no(NOT_SAVED) }
  const next = { ...((data?.clocky_reminders ?? {}) as Record<string, boolean>), [input.key]: !!input.on }
  const { error } = await c.from('app_settings').update({ clocky_reminders: next, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] reminders:', error.message); return no(NOT_SAVED) }
  refresh()
  return { ok: true, toast: input.on ? 'On. The bell reminds people again.' : 'Off. Nobody gets this reminder until it is on again.' }
}
