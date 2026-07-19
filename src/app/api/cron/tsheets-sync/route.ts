/**
 * GET /api/cron/tsheets-sync, automatic TSheets → portal sync.
 *
 * Run by Vercel Cron (see vercel.json) on the same 4-hourly cadence as the
 * Monday ingest. Pulls job codes (→ tr_clients) and users (→ people directory
 * link/import) using the token from Settings. Runs with the admin/service-role
 * client because a cron has no user session, the same reason the Monday
 * ingest uses createAdminClient().
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncClientsCore, syncPeopleCore, syncTimesheetsCore } from '@/lib/tsheets/sync'

export const runtime = 'nodejs'
export const maxDuration = 120
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is
  // set. Enforce it so the endpoint can't be triggered by random callers.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const row = settings as { tsheets_api_token?: string | null; tsheets_synced_at?: string | null } | null
  const token = row?.tsheets_api_token
  if (!token) {
    return NextResponse.json({ error: 'TSheets token not configured (Settings → QuickBooks Time).' }, { status: 500 })
  }

  // The previous sync time is the watermark for the incremental timesheet pull,
  // read it before we overwrite it below.
  const lastSyncedAt = row?.tsheets_synced_at ?? null

  const t0 = Date.now()
  const clients = await syncClientsCore(supabase, token)
  const people = await syncPeopleCore(supabase, token)
  const timesheets = await syncTimesheetsCore(supabase, token, lastSyncedAt)

  // Stamp the last-synced time so the UI can show "Last synced X ago".
  await supabase.from('app_settings').update({ tsheets_synced_at: new Date().toISOString() }).eq('singleton_id', 1)

  return NextResponse.json({
    ok: clients.ok && people.ok && timesheets.ok,
    elapsedMs: Date.now() - t0,
    clients,
    people,
    timesheets,
  })
}
