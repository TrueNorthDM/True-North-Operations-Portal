/**
 * How fresh the hours behind the client reports actually are.
 *
 * There are two pipelines out of QuickBooks Time and they are not the same
 * thing. `app_settings.tsheets_synced_at` is stamped by the clients-and-people
 * sync; the HOURS arrive through the Clocky import, which records itself in
 * tc_import_runs. The report used to display the first one, so it described the
 * freshness of a pipeline it does not read. If the import stopped, the report
 * would have gone on saying "last synced an hour ago", indefinitely, because
 * the other pipeline kept running.
 *
 * It also reports a FAILED run, which the old badge had no way to express: its
 * timestamp only moved on success, so a failure looked exactly like a quiet
 * hour. A stale number on a client report should say so on the client report.
 *
 * Privileged for the same reason as tsheets/status.ts: fixed table, fixed
 * columns, no caller input, and only a timestamp and a boolean come back.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface HoursImportStatus {
  /** When the last successful import finished, or null if none ever has. */
  syncedAt: string | null
  /** The most recent finished run failed, so `syncedAt` is older than it looks. */
  failed: boolean
}

export async function getHoursImportStatus(): Promise<HoursImportStatus> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tc_import_runs')
    .select('state, finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(20)

  const runs = (data ?? []) as { state: string; finished_at: string }[]
  const lastDone = runs.find(r => r.state === 'done')
  return {
    syncedAt: lastDone?.finished_at ?? null,
    // Only the most recent finished run counts. An older failure that a later
    // run recovered from is history, and reporting it would cry wolf.
    failed: runs[0]?.state === 'failed',
  }
}
