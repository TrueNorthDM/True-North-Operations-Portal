'use server'

/**
 * TSheets sync server actions (split out of settings-actions.ts, audit M5-2):
 *   - linkTsheetsPersonToDirectory: manual link of a TSheets-only import to a
 *     real directory person (People tab).
 *   - syncAllFromTsheets: the "Sync now" button: clients + people + timesheets,
 *     then stamp tsheets_synced_at. The cron runs the same cores on schedule.
 *     Hours are NOT pulled here: they come through the Clocky import.
 *
 * (Four granular wrappers, syncTrClients / syncPeopleFromTsheets /
 * syncClientsFromPortal / syncPeopleFromPortal, were removed in the audit:
 * dead code, no callers.)
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { syncClientsCore, syncPeopleCore } from '@/lib/tsheets/sync'
import { requireAdmin } from '@/lib/tsheets/require-admin'
import { ROUTES } from '@/lib/nav/routes'

// ─── Manually link a TSheets-only import to an existing directory person ─────

// ─── Manual "sync now", clients + people + timesheets, then stamp the time ──

export async function syncAllFromTsheets(): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  // The token is the server's own (app_settings is closed to sessions,
  // migration 108); who may run this was decided above.
  const admin = createAdminClient()
  const { data: settings, error: settingsErr } = await admin
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (settingsErr) return { ok: false, error: 'The TSheets settings could not be read. Try again in a moment.' }
  if (!settings?.tsheets_api_token) return { ok: false, error: 'No TSheets token configured in Settings.' }
  const token = settings.tsheets_api_token

  const clients = await syncClientsCore(supabase, token)
  if (!clients.ok) return { ok: false, error: clients.error }
  const people = await syncPeopleCore(supabase, token)
  if (!people.ok) return { ok: false, error: people.error }

  const { error: stampErr } = await admin.from('app_settings').update({ tsheets_synced_at: new Date().toISOString() }).eq('singleton_id', 1)
  if (stampErr) console.error('[tsheets sync] the sync time was not stamped:', stampErr.message)

  revalidatePath('/admin/settings')
  revalidatePath(ROUTES.i7)
  return { ok: true }
}
