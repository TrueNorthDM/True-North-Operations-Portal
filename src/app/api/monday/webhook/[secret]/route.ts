/**
 * POST /api/monday/webhook/<secret>
 *
 * The authenticated door for Monday deliveries. The path segment IS the
 * credential (see lib/monday/webhook-secret.ts for why it is a URL secret and
 * not a signature).
 *
 * A wrong or missing secret gets 404, not 401: a 401 confirms the endpoint
 * exists and invites guessing, while a 404 is indistinguishable from a typo in
 * the path. Nothing is written to monday_events either, so a scanner cannot
 * fill the audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleMondayWebhook } from '@/lib/monday/webhook-handler'
import { webhookSecretMatches } from '@/lib/monday/webhook-secret'

// Node runtime: Supabase's Node SDK plus better error tracing than Edge.
export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params
  if (!(await webhookSecretMatches(secret))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return handleMondayWebhook(await req.text(), 'secret-url')
}
