/**
 * POST /api/cron/agenda-sample-seed, fills staging with the new Agenda's
 * sample data for the training sessions (lib/agenda/sample-seed.ts): accounts,
 * working hours and busy times. Only from the server, and refused anywhere but
 * staging; safe to run again. The staging data refresh runs it after copying
 * production.
 */

import { isCronRequest } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { seedAgendaSamples } from '@/lib/agenda/sample-seed'
import { IS_STAGING } from '@/lib/environment'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) return new Response('Only from the server.', { status: 403 })
  if (!IS_STAGING) return new Response('Sample data is for staging only.', { status: 403 })
  try {
    return Response.json(await seedAgendaSamples(createAdminClient(), new Date().toISOString().slice(0, 10)))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[agenda sample seed]', msg)
    return new Response(`The seed stopped: ${msg}`, { status: 500 })
  }
}
