/**
 * GET /api/cron/clocky-delta, keeping Clocky Hours current on its own.
 *
 * While QuickBooks Time is still the system of record, our copy has to keep up
 * with it: new entries, edits, retroactive approvals, and deletions. The delta
 * does all four in about twenty seconds, so there is no reason for a person to
 * remember to press a button.
 *
 * This exists because the alternative on the table was running the full import
 * by hand, repeatedly, for as long as the parallel period lasts. That is 45
 * minutes of somebody's attention to do what this does unattended.
 *
 * It stops the day the cutover happens: once the portal is the clock, there is
 * nothing upstream to catch up with, and the import_cutoff_date already stops
 * it reaching into days people have entered here.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runImport } from '@/lib/timeclock/runner'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings').select('tsheets_api_token').eq('singleton_id', 1).maybeSingle()
  const token = (data as { tsheets_api_token?: string | null } | null)?.tsheets_api_token
  if (!token) {
    return NextResponse.json({ skipped: 'No TSheets token configured.' })
  }

  // A cron that overlaps itself is a cron that fights itself, and two slices
  // writing the same month is exactly what left a reconciliation row recording
  // a half-written total once already. If one is still going, this one leaves.
  const { data: busy } = await supabase
    .from('tc_import_runs').select('id, started_at').eq('state', 'running')
    .order('id', { ascending: false }).limit(1).maybeSingle()
  const running = busy as { id: number; started_at: string } | null
  if (running && Date.now() - Date.parse(running.started_at) < 30 * 60_000) {
    return NextResponse.json({ skipped: `Run ${running.id} is still going.` })
  }

  try {
    const report = await runImport(supabase, token, { kind: 'delta', budgetMs: 200_000 })
    return NextResponse.json(report, { status: report.state === 'failed' ? 500 : 200 })
  } catch (e) {
    return NextResponse.json(
      { state: 'failed', error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
