'use server'

/**
 * TSheets sync server actions — split out of settings-actions.ts (audit M5-2).
 *
 * Two layers:
 *   - token-in actions (syncTrClients / syncPeopleFromTsheets) + the manual
 *     link helper, used by the Settings UI;
 *   - portal-level wrappers that read the stored token from app_settings so the
 *     token never reaches the browser (syncClientsFromPortal / … People… /
 *     syncAllFromTsheets — the "Sync now" button and the cron parity path).
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncClientsCore, syncPeopleCore, syncTimesheetsCore } from '@/lib/tsheets/sync'
import { requireAdmin } from '@/lib/tsheets/require-admin'

// ─── Sync job codes from TSheets into tr_clients ────────────────────────────

export async function syncTrClients(token: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, count: 0, error: notAdmin }

  const supabase = await createClient()
  const result = await syncClientsCore(supabase, token)
  if (result.ok) revalidatePath('/settings')
  return result
}

// ─── Sync TSheets users into the people directory ───────────────────────────

export async function syncPeopleFromTsheets(token: string): Promise<{
  ok: boolean
  linked: number
  imported: number
  error?: string
}> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, linked: 0, imported: 0, error: notAdmin }

  const supabase = await createClient()
  const result = await syncPeopleCore(supabase, token)
  if (result.ok) revalidatePath('/settings')
  return result
}

// ─── Manually link a TSheets-only import to an existing directory person ─────

export async function linkTsheetsPersonToDirectory(input: {
  tsheetsOnlyPersonId: string   // people.id of the imported (tsheets_only) row
  directoryPersonId: string     // people.id of the real directory person
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()

  // Read the TSheets link off the imported row.
  const { data: src, error: srcErr } = await supabase
    .from('people')
    .select('id, tsheets_user_id')
    .eq('id', input.tsheetsOnlyPersonId)
    .maybeSingle()
  if (srcErr) return { ok: false, error: srcErr.message }
  if (!src || src.tsheets_user_id == null) return { ok: false, error: 'That person has no TSheets link to move.' }

  // Delete the import first to free the unique tsheets_user_id, then assign it
  // to the real person. Rates (keyed by tsheets_user_id) follow automatically.
  const { error: delErr } = await supabase.from('people').delete().eq('id', input.tsheetsOnlyPersonId)
  if (delErr) return { ok: false, error: delErr.message }

  const { error: updErr } = await supabase
    .from('people')
    .update({ tsheets_user_id: src.tsheets_user_id })
    .eq('id', input.directoryPersonId)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/settings')
  revalidatePath('/admin/people')
  revalidatePath('/')
  return { ok: true }
}

// ─── Portal-level sync wrappers (read token from DB — never exposed to browser) ─

export async function syncClientsFromPortal(): Promise<{ ok: boolean; count: number; error?: string }> {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) {
    return { ok: false, count: 0, error: 'No TSheets token configured in Settings.' }
  }
  return syncTrClients(settings.tsheets_api_token)
}

export async function syncPeopleFromPortal(): Promise<{
  ok: boolean
  linked: number
  imported: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) {
    return { ok: false, linked: 0, imported: 0, error: 'No TSheets token configured in Settings.' }
  }
  return syncPeopleFromTsheets(settings.tsheets_api_token)
}

// Manual "sync now" behind the last-synced status button: runs both syncs and
// stamps tsheets_synced_at. The cron does the same on its schedule.
export async function syncAllFromTsheets(): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) return { ok: false, error: 'No TSheets token configured in Settings.' }
  const token = settings.tsheets_api_token
  const lastSyncedAt = settings.tsheets_synced_at ?? null

  const clients = await syncClientsCore(supabase, token)
  if (!clients.ok) return { ok: false, error: clients.error }
  const people = await syncPeopleCore(supabase, token)
  if (!people.ok) return { ok: false, error: people.error }
  const timesheets = await syncTimesheetsCore(supabase, token, lastSyncedAt)
  if (!timesheets.ok) return { ok: false, error: timesheets.error }

  await supabase.from('app_settings').update({ tsheets_synced_at: new Date().toISOString() }).eq('singleton_id', 1)

  revalidatePath('/settings')
  revalidatePath('/tools/time-report')
  return { ok: true }
}
