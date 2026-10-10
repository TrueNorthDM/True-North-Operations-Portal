/**
 * GET /api/admin/monday-account?id=<monday user id>
 *
 * The evidence for "who was this", as JSON, so the links screen can show it
 * where the decision is made instead of sending somebody to a text endpoint
 * and back.
 */

import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAccountProfile } from '@/lib/monday/worklist/account'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await allowedTo('monday-accounts'))) return new Response('Admins only.', { status: 403 })
  const id = Number(new URL(request.url).searchParams.get('id') ?? '')
  if (!Number.isFinite(id)) return Response.json({ error: 'Pass ?id=<monday user id>' }, { status: 400 })
  try {
    return Response.json(await loadAccountProfile(createAdminClient(), id))
  } catch (e) {
    // The detail goes to the log; the screen gets a sentence (audit, 10 October 2026).
    console.error('[monday-account]', (e as Error).message)
    return Response.json({ error: 'This account could not be read. Try again in a moment.' }, { status: 500 })
  }
}
