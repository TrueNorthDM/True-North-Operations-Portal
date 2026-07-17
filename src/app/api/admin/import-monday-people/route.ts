/**
 * POST /api/admin/import-monday-people — one-off (re-runnable) import of the
 * True North Team Monday board into the Directory. Slow (many API calls + file
 * downloads), so it runs on the cron runtime budget. Triggered by the admin
 * "Import from Monday" button on the Directory.
 *
 * Auth: the proxy already requires a session for this path; we additionally
 * require the caller to be an admin. The IMPORT itself runs with the
 * service-role client (bypasses RLS + Storage policies) — a background job.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { importMondayPeople } from '@/lib/monday/import-people'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()
  const result = await importMondayPeople(createAdminClient())
  return NextResponse.json({ ...result, elapsedMs: Date.now() - t0 }, { status: result.ok ? 200 : 500 })
}
