/**
 * GET /api/cron/clocky-invoices, day 1 (Clocky part 2): the fixed, no
 * timesheet contractors' invoices for the month that just ended. Safe to run
 * again: a person's month is invoiced once. See src/lib/timeclock/invoices-cron.ts.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { CLOSED_SKIP, northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { runFixedInvoices } from '@/lib/timeclock/invoices-cron'

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
    const report = await runFixedInvoices()
    if (report.errors.length) console.error('[clocky-invoices]', report.errors.join(' | '))
    // Errors answer 500, so the crontab log says FAIL.
    const ok = report.errors.length === 0
    return NextResponse.json({ ok, ...report }, { status: ok ? 200 : 500 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
