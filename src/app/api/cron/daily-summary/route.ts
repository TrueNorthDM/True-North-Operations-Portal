/**
 * GET /api/cron/daily-summary, the daily summary emails (every 15 minutes, from
 * the server's crontab). Each run sends the summaries that are due: 8:00 has
 * passed in the person's time zone, and it is a working day there. Most runs
 * find nothing to do. See src/lib/notifications/summary.ts.
 */

import { NextResponse } from 'next/server'
import { publicOrigin } from '@/lib/auth/public-origin'
import { sendDailySummaries } from '@/lib/notifications/summary'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await sendDailySummaries({ origin: publicOrigin(request.url) })
  if (report.errors.length) console.error('[daily-summary]', report.errors.slice(0, 5).join(' | '))
  return NextResponse.json({ ok: report.errors.length === 0, ...report, errors: report.errors.slice(0, 5) })
}
