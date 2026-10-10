/**
 * GET /api/targets
 *
 * The rules the Publishing Goals dashboard (public/boards.html) counts by, the
 * same ones the Home card and the behind-pace notification use
 * (lib/boards/publishing-rules.ts, decided 10 October 2026):
 *
 *   zone        "America/New_York": a week is Monday 00:00 to Sunday 23:59 there
 *   publishers  who counts as the publisher of a page
 *   targets     the weekly targets in force this week, paused languages left out
 *   periods     every target and the weeks it was in force, so past weeks keep
 *               the target they had
 *   paused      languages paused on each board's site, left out everywhere
 *
 * For everyone with the Publishing Goals tool, as the page decides it. From 7
 * to 10 October 2026 it answered Super Admins only and the dashboard failed for
 * everybody else (audit, 10 October 2026).
 */

import { NextResponse } from 'next/server'
import { loadAccess, verifiedSession } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadPublishingRules, PUBLISHING_ZONE, targetsForWeek, weekStartDay } from '@/lib/boards/publishing-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await verifiedSession()) || !(await loadAccess()).canTool('publishing')) {
    return NextResponse.json({ error: 'Publishing Goals is not open to your access.' }, { status: 403 })
  }
  try {
    const rules = await loadPublishingRules(createAdminClient())
    return NextResponse.json({
      zone: PUBLISHING_ZONE,
      publishers: rules.publishers,
      targets: targetsForWeek(rules, weekStartDay(new Date())),
      periods: rules.periods,
      paused: rules.paused,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    // The detail goes to the server log; the dashboard gets a sentence.
    console.error('[targets]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Publishing targets could not be read. Try again in a moment.' }, { status: 500 })
  }
}
