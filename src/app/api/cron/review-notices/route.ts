/**
 * The annual review's daily job (lib/review/reminders.ts): keeps the started
 * year current and sends the reminders 3 days before, the day before and on
 * the day of every due date, each goal's month and the 6-month check-in.
 * Once a day, at 13:00 UTC (9:00 AM in Washington, most of the year).
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { runReviewNotices } from '@/lib/review/reminders'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await runReviewNotices()) })
  } catch (e) {
    console.error('[cron] review notices:', e instanceof Error ? e.message : e)
    // The detail goes to the portal's log above, not to the caller (security audit, 8 November 2026).
    return NextResponse.json({ ok: false, error: 'The job failed. The portal log has the details.' }, { status: 500 })
  }
}
