'use server'

/**
 * Company settings for Clocky part 2 (Company Settings.dc.html 13A, 13B, 13C):
 * the Google service account and calendars, Test
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
    try { released = await releaseWaiting() } catch (e) { stuck = true; console.error('[settings] google release:', e instanceof Error ? e.message : e) }
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

/** Try again on a Drive copy that failed (the Google Drive card and the Drive columns): it waits for the next pass. */
export async function retryDriveCopy(input: { id: number }): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins try the Drive copies again.')
  try {
    const { retryCopy } = await import('@/lib/drive/copies')
    if (!(await retryCopy(Number(input?.id)))) return no('That copy is not waiting to be tried again.')
  } catch (e) {
    console.error('[settings] drive retry:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
  refresh()
  revalidatePath('/clocky-hours/invoices')
  revalidatePath('/requests/reimbursements')
  return { ok: true, toast: 'Queued again. It is copied within five minutes.' }
}

/** "Copy the missing now": one pass of the Drive copies straight away, as the scheduled one does every five minutes. */
export async function copyDriveNow(): Promise<Done> {
  if (!(await allowedTo('cs-integrations-edit'))) return no('Only Super Admins run the Drive copies.')
  try {
    const { runCopyPass, PASS_LIMIT } = await import('@/lib/drive/copies')
    const r = await runCopyPass({ limit: PASS_LIMIT * 2 })
    refresh()
    revalidatePath('/clocky-hours/invoices')
    revalidatePath('/requests/reimbursements')
    if (r.skipped) return no(`Nothing was copied: ${r.skipped.replace(/\.$/, '')}.`)
    if (!r.copied && !r.failed) return { ok: true, toast: 'Nothing was missing: everything due is in Drive.' }
    const n = (k: number) => `${k} file${k === 1 ? '' : 's'}`
    return r.failed
      ? no(`${r.copied ? `${n(r.copied)} copied; ` : ''}${n(r.failed)} could not be copied. The reason is in the list below.`)
      : { ok: true, toast: `${n(r.copied)} copied into Drive.${r.copied >= PASS_LIMIT * 2 ? ' The rest follow in the next few minutes.' : ''}` }
  } catch (e) {
    console.error('[settings] drive copy now:', e instanceof Error ? e.message : e)
    return no('The copies could not run. Try again in a moment.')
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
    if (j.ref_table === 'tc_absence_requests' && j.kind === 'gcal_upsert') await c.from('tc_absence_requests').update({ calendar_state: 'queued' }).eq('id', j.ref_id)
  } catch (e) {
    console.error('[settings] retry:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
  refresh()
  return { ok: true, toast: 'Queued again. It goes in the next few minutes, or when its connection works.' }
}

// ── 13B Invoices ────────────────────────────────────────────────────────────

export async function saveInvoiceSettings(input: { prefix: string; nextNumber: string; rmbPrefix: string; rctPrefix?: string; billingName: string; address: string; country: string; email: string; paymentDays: string; mileageRate: string }): Promise<Done> {
  if (!(await allowedTo('cs-invoices-edit'))) return no('Only Super Admins change the invoice settings.')
  const prefix = String(input.prefix ?? '').trim().toUpperCase()
  const rmb = String(input.rmbPrefix ?? '').trim().toUpperCase()
  // Receipts (owner, 31 October 2026): a form without the field keeps the one saved.
  const rct = input.rctPrefix == null ? null : String(input.rctPrefix).trim().toUpperCase()
  if (!/^[A-Z]{2,6}$/.test(prefix) || !/^[A-Z]{2,6}$/.test(rmb) || (rct != null && !/^[A-Z]{2,6}$/.test(rct))) return no('A prefix is 2 to 6 letters, like INV, RMB or RCT.')
  if (prefix === rmb) return no('Invoices and reimbursement documents need different prefixes.')
  if (rct != null && (rct === prefix || rct === rmb)) return no('Receipts need a prefix of their own, different from invoices and reimbursement documents.')
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
    prefix, next_number: next, rmb_prefix: rmb, ...(rct != null ? { rct_prefix: rct } : {}), billing_name: name,
    billing_address: [String(input.address ?? '').trim(), String(input.country ?? '').trim()].filter(Boolean).join('\n') || null,
    billing_email: email || null, payment_days: days, mileage_rate: rate, updated_by: me?.id ?? null, updated_at: new Date().toISOString(),
  }).eq('singleton_id', 1)
  if (error) { console.error('[settings] invoices:', error.message); return no(NOT_SAVED) }
  refresh()
  return { ok: true, toast: 'Saved. New invoices use these details; approved ones stay as they were.' }
}

/**
 * Finance (owner, 31 October 2026): the people who mark invoices and
 * reimbursement documents paid, chosen in Company settings, Invoices, instead
 * of in the code. Super Admins only; at least one person, all active.
 */
export async function saveFinance(input: { personIds: string[] }): Promise<Done> {
  if (!(await allowedTo('cs-invoices-edit'))) return no('Only Super Admins choose who is Finance.')
  const ids = [...new Set((Array.isArray(input?.personIds) ? input.personIds : []).map(String))]
  if (!ids.length) return no('Keep at least one person in Finance: nobody else can mark invoices paid.')
  if (ids.length > 10 || ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) return no(NOT_SAVED)
  const c = createAdminClient()
  const { data: found, error: e1 } = await c.from('people').select('id, status').in('id', ids)
  if (e1) { console.error('[settings] finance:', e1.message); return no(NOT_SAVED) }
  if ((found ?? []).length !== ids.length || (found ?? []).some(p => p.status && p.status !== 'active')) return no('Pick active people from the Directory.')
  const me = await getRealPerson()
  const { error } = await c.from('invoice_settings').update({ finance: ids, updated_by: me?.id ?? null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] finance:', error.message); return no(NOT_SAVED) }
  refresh()
  revalidatePath('/clocky-hours/invoices')
  return { ok: true, toast: 'Saved. Finance can mark invoices and reimbursement documents paid.' }
}

/**
 * Reimbursements (owner, 1 November 2026, Who approves what): the people who
 * decide reimbursements, anyone on the list, never their own. Super Admins
 * only; at least one person, all active Admins or Super Admins (who can open
 * Approvals), and each a Super Admin or in Finance (the only ones who see
 * reimbursements, money lockdown of 5 November 2026). Saved as saveFinance
 * saves Finance.
 */
export async function saveReimbursementApprovers(input: { personIds: string[] }): Promise<Done> {
  if (!(await allowedTo('cs-invoices-edit'))) return no('Only Super Admins choose who approves reimbursements.')
  const ids = [...new Set((Array.isArray(input?.personIds) ? input.personIds : []).map(String))]
  if (!ids.length) return no('Keep at least one person: a reimbursement must never wait for nobody.')
  if (ids.length > 10 || ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) return no(NOT_SAVED)
  const c = createAdminClient()
  const { data: found, error: e1 } = await c.from('people').select('id, status, access_level').in('id', ids)
  if (e1) { console.error('[settings] reimbursement approvers:', e1.message); return no(NOT_SAVED) }
  if ((found ?? []).length !== ids.length || (found ?? []).some(p => p.status && p.status !== 'active')) return no('Pick active people from the Directory.')
  if ((found ?? []).some(p => p.access_level !== 'admin' && p.access_level !== 'super_admin')) return no('Pick Admins or Super Admins: only they open Approvals to decide.')
  // Reimbursements are money (money lockdown, 5 November 2026): Approvals shows them only to Super Admins and Finance.
  const { data: inv, error: e2 } = await c.from('invoice_settings').select('finance').eq('singleton_id', 1).maybeSingle()
  if (e2) { console.error('[settings] reimbursement approvers:', e2.message); return no(NOT_SAVED) }
  const finance = new Set(((inv?.finance ?? []) as string[]).map(String))
  if ((found ?? []).some(p => p.access_level !== 'super_admin' && !finance.has(p.id))) return no('Pick Super Admins or Finance: only they see reimbursements.')
  const me = await getRealPerson()
  const { error } = await c.from('invoice_settings').update({ reimbursement_approvers: ids, updated_by: me?.id ?? null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] reimbursement approvers:', error.message); return no(NOT_SAVED) }
  refresh()
  revalidatePath('/clocky-hours/approvals')
  revalidatePath('/requests/reimbursements')
  return { ok: true, toast: 'Saved. New and waiting reimbursements go to the people on the list.' }
}

/**
 * The invoice form's rates for everyone (migration 147, decision G): a
 * translated page and a translated design asset, in dollars. A person's own,
 * when it differs, is in Rates & Costs. Super Admins only.
 */
export async function saveFormRates(input: { pageRate: string; assetRate: string }): Promise<Done> {
  if (!(await allowedTo('cs-invoices-edit'))) return no('Only Super Admins change the invoice settings.')
  const read = (v: unknown) => { const t = String(v ?? '').trim().replace(/^\$/, ''); return /^\d{1,4}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN }
  const page = read(input?.pageRate), asset = read(input?.assetRate)
  if (!(page > 0 && page < 10_000) || !(asset > 0 && asset < 10_000)) return no('A rate is dollars, more than 0, like 30.00.')
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('invoice_settings').update({ page_rate: page, asset_rate: asset, updated_by: me?.id ?? null, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (error) { console.error('[settings] form rates:', error.message); return no(NOT_SAVED) }
  await logChange('invoice_form_rates', 'saved')
  refresh()
  return { ok: true, toast: 'Saved. New invoices from the form use these rates; sent ones keep theirs.' }
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
