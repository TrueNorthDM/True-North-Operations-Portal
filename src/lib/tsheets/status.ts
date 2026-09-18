/**
 * Non-secret facts about the TSheets connection, for screens regular users can
 * reach.
 *
 * WHY THIS EXISTS. /work-tools/time-report and /directory both used the *user's*
 * Supabase client to read app_settings, which meant app_settings had to stay
 * readable by every authenticated user, which meant every signed-in person
 * could pull the Monday and TSheets API tokens straight from the REST API.
 * These two reads were the only thing standing between app_settings and an
 * admin-only policy (migration 052).
 *
 * WHY THE ADMIN CLIENT IS THE RIGHT CALL HERE. The rule in lib/supabase/admin.ts
 * is that the service-role client must not act on behalf of a user, because
 * bypassing RLS on user-supplied input is how privilege escalation happens.
 * This read takes no input at all: fixed table, fixed row, fixed columns. And
 * the secret never leaves this module, because the only things returned are a
 * boolean and a timestamp. The caller cannot leak what it never receives.
 *
 * The alternative considered was column-level GRANTs (letting authenticated
 * read tsheets_synced_at but not the token columns). It works, but it splits
 * the access rules across two mechanisms (RLS + column privileges) for one
 * table, and the next person to add a column would have to know that. One
 * narrow server-side reader is easier to keep correct.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface TsheetsStatus {
  /** Whether a token is saved. Never the token itself. */
  configured: boolean
  /** ISO timestamp of the last successful sync, or null. */
  syncedAt: string | null
}

/**
 * Read-only, no arguments, no secrets out. Safe to call from any server
 * component regardless of who is looking at the page.
 */
export async function getTsheetsStatus(): Promise<TsheetsStatus> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const row = data as { tsheets_api_token?: string | null; tsheets_synced_at?: string | null } | null
  return {
    configured: Boolean(row?.tsheets_api_token?.trim()),
    syncedAt: row?.tsheets_synced_at ?? null,
  }
}
