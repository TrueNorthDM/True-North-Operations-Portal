/**
 * GET /api/cron/clocky-outbox, every 5 minutes (Clocky part 2): sends what the
 * decisions queued for Rippling and Google Calendar, and writes the answers
 * back on the requests. See src/lib/integrations/outbox-run.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { runOutbox } from '@/lib/integrations/outbox-run'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runOutbox()
    if (report.errors.length) console.error('[clocky-outbox]', report.errors.slice(0, 5).join(' | '))
    // A refused job is an answer, not a failure of the run: it shows on its request.
    return NextResponse.json({ ok: true, ...report, errors: report.errors.slice(0, 5) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
