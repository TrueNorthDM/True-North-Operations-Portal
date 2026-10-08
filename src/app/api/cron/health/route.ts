/**
 * GET /api/cron/health, integration health check (every 2 days, from the server's crontab).
 *
 * Verifies Monday + TSheets connectivity and that the Monday webhooks are still
 * registered, then records the results to system_health_checks. This is the
 * safety net for silent outages: the Monday webhook once stopped delivering for
 * ~18 days with nobody noticing. Now that shows up red on the Automations page
 * and a dashboard banner.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks } from '@/lib/health/checks'
import { notifyHealth } from '@/lib/notifications/run'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results = await runHealthChecks(supabase)
  const allOk = results.every(r => r.ok)
  // Admins hear about a service that stopped answering (notification S1).
  const notified = allOk ? null : await notifyHealth(supabase, results)

  return NextResponse.json({ ok: allOk, checkedAt: new Date().toISOString(), results, notified })
}
