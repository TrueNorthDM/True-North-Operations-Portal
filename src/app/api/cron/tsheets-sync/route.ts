/**
 * GET /api/cron/tsheets-sync, automatic TSheets → portal sync.
 *
 * Run by the server's crontab (deploy/cron/portal.crontab) on the same 4-hourly cadence as the
 * Monday ingest. Pulls job codes (→ tr_clients) and users (→ people directory
 * link/import) using the token from Settings. Runs with the admin/service-role
 * client because a cron has no user session, the same reason the Monday
 * ingest uses createAdminClient().
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncClientsCore, syncPeopleCore } from '@/lib/tsheets/sync'

export const runtime = 'nodejs'
export const maxDuration = 120
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const row = settings as { tsheets_api_token?: string | null } | null
  const token = row?.tsheets_api_token
  if (!token) {
    return NextResponse.json({ error: 'TSheets token not configured (Settings → QuickBooks Time).' }, { status: 500 })
  }

  // Clients and people only. The timesheet pull that used to run here filled
  // tsheets_timesheets, a cache no report has read since the hours moved to
  // tc_entries, so it was spending API calls to keep a table nobody opened.
  // The hours arrive through the Clocky import instead (/api/cron/clocky-delta).
  const t0 = Date.now()
  const clients = await syncClientsCore(supabase, token)
  const people = await syncPeopleCore(supabase, token)

  // Still stamped, but it now means only what it says: when the clients and
  // people were last pulled. The report's freshness badge no longer reads it,
  // because the report's hours do not come from here.
  await supabase.from('app_settings').update({ tsheets_synced_at: new Date().toISOString() }).eq('singleton_id', 1)

  return NextResponse.json({
    ok: clients.ok && people.ok,
    elapsedMs: Date.now() - t0,
    clients,
    people,
  })
}
