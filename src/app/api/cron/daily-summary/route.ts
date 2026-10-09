/**
 * GET /api/cron/daily-summary, the daily summary emails (every 15 minutes, from
 * the server's crontab). Each run sends the summaries that are due: 8:00 has
 * passed in the person's time zone, and it is a working day there. Most runs
 * find nothing to do. See src/lib/notifications/summary.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { publicOrigin } from '@/lib/auth/public-origin'
import { sendDailySummaries } from '@/lib/notifications/summary'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await sendDailySummaries({ origin: publicOrigin(request.url) })
  if (report.errors.length) console.error('[daily-summary]', report.errors.slice(0, 5).join(' | '))
  // A run with errors answers 500, so the crontab log says FAIL (a 200 with
  // "ok": false was logged as ok, audit 9 October 2026).
  const ok = report.errors.length === 0
  return NextResponse.json({ ok, ...report, errors: report.errors.slice(0, 5) }, { status: ok ? 200 : 500 })
}
