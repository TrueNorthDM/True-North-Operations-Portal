/**
 * POST /api/monday/webhook  (LEGACY, UNAUTHENTICATED, TEMPORARY)
 *
 * The original webhook URL. It has no credential of any kind: anyone who knows
 * a board id and an item id can drive it, and it runs as service_role. That is
 * the hole being closed.
 *
 * It is still here for one reason: the two webhooks registered on the Monday
 * side (AAAF and HFA) still point at this URL, and a webhook's URL cannot be
 * edited, only deleted and recreated. Turning this off before they are
 * recreated would stop the Href Links sync.
 *
 * DELETE THIS FILE once Admin -> Automations shows deliveries arriving as
 * `secret-url`. Every delivery through this door is tagged `legacy-url` on the
 * audit row precisely so that moment is visible rather than guessed at.
 */

import { NextRequest } from 'next/server'
import { handleMondayWebhook } from '@/lib/monday/webhook-handler'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleMondayWebhook(await req.text(), 'legacy-url')
}
