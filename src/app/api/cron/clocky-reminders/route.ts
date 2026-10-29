/**
 * GET /api/cron/clocky-reminders, every hour (Clocky part 2, 13C): the
 * timesheet reminders at 9:00 AM in each person's zone, and the allowance
 * lines. See src/lib/timeclock/reminders-run.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { CLOSED_SKIP, northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { runClockyReminders } from '@/lib/timeclock/reminders-run'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // North Time closed (migration 132): its scheduled jobs do nothing.
  if (!(await northTimeOpen())) return NextResponse.json(CLOSED_SKIP)
  try {
    return NextResponse.json({ ok: true, ...(await runClockyReminders()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
