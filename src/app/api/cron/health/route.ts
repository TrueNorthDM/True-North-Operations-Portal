/**
 * GET /api/cron/health, integration health check (every 2 days via Vercel Cron).
 *
 * Verifies Monday + TSheets connectivity and that the Monday webhooks are still
 * registered, then records the results to system_health_checks. This is the
 * safety net for silent outages: the Monday webhook once stopped delivering for
 * ~18 days with nobody noticing. Now that shows up red on the Automations page
 * and a dashboard banner.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks } from '@/lib/health/checks'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is
  // set. Enforce it so the endpoint can't be triggered by random callers.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results = await runHealthChecks(supabase)
  const allOk = results.every(r => r.ok)

  return NextResponse.json({ ok: allOk, checkedAt: new Date().toISOString(), results })
}
