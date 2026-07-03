/**
 * GET /api/cron/tsheets-sync — automatic TSheets → portal sync.
 *
 * Run by Vercel Cron (see vercel.json) on the same 4-hourly cadence as the
 * Monday ingest. Pulls job codes (→ tr_clients) and users (→ people directory
 * link/import) using the token from Settings. Runs with the admin/service-role
 * client because a cron has no user session — the same reason the Monday
 * ingest uses createAdminClient().
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncClientsCore, syncPeopleCore } from '@/lib/tsheets/sync'

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
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()

  const token = (settings as { tsheets_api_token?: string | null } | null)?.tsheets_api_token
  if (!token) {
    return NextResponse.json({ error: 'TSheets token not configured (Settings → QuickBooks Time).' }, { status: 500 })
  }

  const t0 = Date.now()
  const clients = await syncClientsCore(supabase, token)
  const people = await syncPeopleCore(supabase, token)

  return NextResponse.json({
    ok: clients.ok && people.ok,
    elapsedMs: Date.now() - t0,
    clients,
    people,
  })
}
