/**
 * GET /api/cron/clocky-safety, Clocky's safety net (every 5 minutes, from the
 * server's crontab). The automatic stop at 12h (leadership, 4 November 2026: no
 * "Still working?" question) or at the weekly allowance, with its one email,
 * on North Time's own clocks only: a clock copied from TSheets, or of someone
 * whose start date has not come, is never touched (audit, 5 November 2026).
 * Once a day, the Super Admins' line about yesterday's automatic clock-outs.
 * See src/lib/timeclock/clocky-safety-run.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { CLOSED_SKIP, northTimeOpen } from '@/lib/timeclock/north-time-lock'
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
  // North Time closed (migration 132): its scheduled jobs do nothing.
  if (!(await northTimeOpen())) return NextResponse.json(CLOSED_SKIP)
  try {
    const report = await runClockSafety(createAdminClient(), { origin: publicOrigin(request.url) })
    if (report.errors.length) console.error('[clocky-safety]', report.errors.slice(0, 5).join(' | '))
    // Errors answer 500, so the crontab log says FAIL.
    const ok = report.errors.length === 0
    return NextResponse.json({ ok, ...report, errors: report.errors.slice(0, 5) }, { status: ok ? 200 : 500 })
  } catch (e) {
    // The detail goes to the portal's log, not to the caller (security audit, 8 November 2026).
    console.error('[cron] clocky-safety:', e)
    return NextResponse.json({ ok: false, error: 'The job failed. The portal log has the details.' }, { status: 500 })
  }
}
