/**
 * POST /api/cron/structure-2026-seed, puts the 2026 job structure (clients,
 * divisions, projects and the 26 activities, with their "When to use" lines)
 * into the portal's job tables (structure-2026-seed.ts). Only from the server
 * (Claude runs it once per database, after migration 125); safe to run again:
 * what is already there is kept, nothing is deleted or renamed.
 */

import { isCronRequest } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { seedStructure2026 } from '@/lib/timeclock/structure-2026-seed'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) return new Response('Only from the server.', { status: 403 })
  try {
    const r = await seedStructure2026(createAdminClient())
    return Response.json(r)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[structure-2026 seed]', msg)
    return new Response(`The seed stopped: ${msg}`, { status: 500 })
  }
}
