/**
 * GET /api/cron/clocky-safety, Clocky's safety net (every 5 minutes, from the
 * server's crontab). "Still working?" at 4h 30m, the automatic stop at 5h 00m
 * with its one email, clocks still open from QuickBooks Time included, and
 * once a day the Super Admins' line about yesterday's automatic clock-outs.
 * See src/lib/timeclock/clocky-safety-run.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { publicOrigin } from '@/lib/auth/public-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { runClockSafety } from '@/lib/timeclock/clocky-safety-run'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runClockSafety(createAdminClient(), { origin: publicOrigin(request.url) })
    if (report.errors.length) console.error('[clocky-safety]', report.errors.slice(0, 5).join(' | '))
    // Errors answer 500, so the crontab log says FAIL.
    const ok = report.errors.length === 0
    return NextResponse.json({ ok, ...report, errors: report.errors.slice(0, 5) }, { status: ok ? 200 : 500 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
