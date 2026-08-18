'use server'

/**
 * TSheets sync server actions (split out of settings-actions.ts, audit M5-2):
 *   - linkTsheetsPersonToDirectory: manual link of a TSheets-only import to a
 *     real directory person (People tab).
 *   - syncAllFromTsheets: the "Sync now" button: clients + people + timesheets,
 *     then stamp tsheets_synced_at. The cron runs the same cores on schedule.
 *
 * (Four granular wrappers, syncTrClients / syncPeopleFromTsheets /
 * syncClientsFromPortal / syncPeopleFromPortal, were removed in the audit:
 * dead code, no callers.)
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncClientsCore, syncPeopleCore, syncTimesheetsCore } from '@/lib/tsheets/sync'
import { requireAdmin } from '@/lib/tsheets/require-admin'

// ─── Manually link a TSheets-only import to an existing directory person ─────

export async function linkTsheetsPersonToDirectory(input: {
  tsheetsOnlyPersonId: string   // people.id of the imported (tsheets_only) row
  directoryPersonId: string     // people.id of the real directory person
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()

  // Hands the whole thing to merge_people (migration 063). What this used to do
  // was delete the imported row and then move its TSheets id across, in two
  // statements with no transaction between them. That cannot work any more and
  // should not have worked before: the delete is refused outright once the
  // person has hours, ON DELETE RESTRICT; and when it did go through, anything
  // hanging off the imported row (team membership, submissions, absences) was
  // cascaded away in silence while grants, which have no foreign key, were left
  // pointing at somebody who no longer existed. The function moves all of it,
  // records what it moved, and keeps every TSheets account the two rows had.
  const { error } = await supabase.rpc('merge_people', {
    winner: input.directoryPersonId,
    loser: input.tsheetsOnlyPersonId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  revalidatePath('/admin/people')
  revalidatePath('/')
  return { ok: true }
}

// ─── Manual "sync now", clients + people + timesheets, then stamp the time ──

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
