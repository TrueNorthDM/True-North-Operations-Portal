/**
 * POST /api/monday/webhook
 *
 * Single entry point for Monday → us. Handles 3 responsibilities:
 *
 *   1. Subscription challenge handshake. When you register a webhook,
 *      Monday's first POST contains `{ challenge: "<random>" }`. We must
 *      echo `{ challenge: "<same>" }` within a few seconds or Monday
 *      refuses to enable the subscription.
 *
 *   2. HMAC signature verification. Every event payload is signed with
 *      the secret Monday gave us at webhook creation. We reject any
 *      payload that doesn't verify against the secret stored in
 *      app_settings.monday_signing_secret.
 *
 *      Caveat: until you save the secret in Settings, we skip verification
 *      so the handshake works during initial setup. That window must be
 *      closed by saving the secret before going live with any real flow.
 *
 *   3. Dispatch. Each event is logged to `monday_events` (audit trail),
 *      then routed by `boardId + columnId + newValue` to the right
 *      handler. Unknown shapes are logged with result='skipped:<reason>'
 *      and return 200 — we never make Monday retry on something we don't
 *      understand, because the retry storm just wastes both sides' budget.
 *
 * Always returns 200 (or 401 on bad signature). 5xx makes Monday retry,
 * and our handlers are idempotent, so retries are safe but noisy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isChallengeBody, isEventBody, type MondayEventBody } from '@/lib/monday/types'
import { verifyMondayAuthHeader } from '@/lib/monday/verify'
import { runLinkHandler, doneHandler } from '@/lib/monday/handlers'

// Force Node runtime (not Edge): we use Supabase's Node SDK + crypto.subtle
// is available in both but Node gives us better error tracing during early
// debugging. Revisit if cold-start latency becomes a problem.
export const runtime = 'nodejs'

interface AppSettings {
  monday_signing_secret: string | null
  monday_api_token: string | null
}

export async function POST(req: NextRequest) {
  // 1. Read body as raw text — we need both the JSON and the original
  //    bytes (the latter for HMAC verification of the JWT signing input,
  //    which is the JWT header+payload, not the request body — so the raw
  //    body isn't strictly required here, but keeping it gives a single
  //    truthy source if we ever switch verification strategies).
  const rawBody = await req.text()
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // 2. Challenge handshake. No signature on this one — Monday hasn't
  //    issued the secret yet at the moment they call this.
  if (isChallengeBody(body)) {
    return NextResponse.json({ challenge: body.challenge }, { status: 200 })
  }

  // 3. Anything else must be an event. Refuse weird shapes.
  if (!isEventBody(body)) {
    return NextResponse.json({ error: 'unexpected payload shape' }, { status: 400 })
  }

  // 4. Look up settings: signing secret + API token. The webhook handler
  //    uses anon client (no user session), but anon read on app_settings
  //    is allowed by RLS (we'll tighten this when service_role is wired).
  const supabase = await createServerClient()
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('monday_signing_secret, monday_api_token')
    .eq('singleton_id', 1)
    .maybeSingle<AppSettings>()
  const signingSecret = settingsRow?.monday_signing_secret ?? ''
  const token = settingsRow?.monday_api_token ?? ''

  // 5. Verify HMAC if we have a secret. If not, log and continue (initial
  //    setup window). Once you save a secret, every payload is enforced.
  let verifiedClaims: Record<string, unknown> | undefined
  if (signingSecret) {
    const result = await verifyMondayAuthHeader(
      req.headers.get('authorization'),
      signingSecret,
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: `unauthorized: ${result.reason}` },
        { status: 401 },
      )
    }
    verifiedClaims = result.claims
  }

  // 6. Persist audit row early. If our processing crashes after this
  //    point, the event still shows up in monday_events for forensics.
  const event = body.event
  const auditRow = {
    event_type: String(event.type ?? 'unknown'),
    board_id: event.boardId != null ? String(event.boardId) : null,
    monday_item_id: event.pulseId != null ? String(event.pulseId) : null,
    column_id: event.columnId ?? null,
    old_value: (event.previousValue ?? null) as object | null,
    new_value: (event.value ?? null) as object | null,
    user_id: event.userId != null ? String(event.userId) : null,
    raw_payload: body as object,
  }
  const { data: auditInsert } = await supabase
    .from('monday_events')
    .insert(auditRow)
    .select('id')
    .single()
  const auditId = auditInsert?.id as string | undefined

  // 7. Dispatch. For now, only acknowledge — handlers land in next step.
  const result = await dispatch(event, { token, supabase })

  // 8. Update audit row with the outcome.
  if (auditId) {
    await supabase
      .from('monday_events')
      .update({ processed_at: new Date().toISOString(), result })
      .eq('id', auditId)
  }

  return NextResponse.json({ ok: true, result, claims: verifiedClaims }, { status: 200 })
}

/**
 * Route the event by (board, column, new label) to a handler.
 * Returns a short string for the audit log.
 *
 * We don't hardcode the Href Links column ID here — instead the handlers
 * receive the boardId and look up the column mapping themselves via
 * sites.monday_column_ids. That keeps the routing logic data-driven and
 * means a new project doesn't require a code change.
 */
async function dispatch(
  event: MondayEventBody['event'],
  ctx: { token: string; supabase: Awaited<ReturnType<typeof createServerClient>> },
): Promise<string> {
  const colId = event.columnId
  const boardId = event.boardId != null ? String(event.boardId) : null
  const itemId = event.pulseId != null ? String(event.pulseId) : null
  if (!colId || !boardId || !itemId) return 'skipped:missing column/board/item id'

  // The new value of a status column is wrapped — Monday sends e.g.
  // { label: { index: 8, text: 'Run Link' } } or { post_id: ..., color: ... }
  // depending on column type. Read it loosely.
  const newLabel = extractStatusLabel(event.value)
  if (!newLabel) return `skipped:not a status change (${colId})`

  // Check which column this is for the site that owns the board.
  // The dispatcher does a tiny lookup so the audit log is meaningful even
  // for events on columns we don't care about.
  const { data: site } = await ctx.supabase
    .from('sites')
    .select('monday_column_ids')
    .eq('monday_board_id', boardId)
    .maybeSingle<{ monday_column_ids: { hrefLinksStatus: string } | null }>()
  const hrefCol = site?.monday_column_ids?.hrefLinksStatus
  if (!hrefCol || colId !== hrefCol) {
    return `skipped:column ${colId} not Href Links`
  }

  if (newLabel === 'Run Link') {
    return runLinkHandler(boardId, itemId, ctx)
  }
  if (newLabel === 'Done') {
    return doneHandler(boardId, itemId, ctx)
  }
  return `skipped:Href Links label "${newLabel}" not actionable`
}

function extractStatusLabel(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const v = value as { label?: { text?: string }; text?: string }
    if (v.label?.text) return v.label.text
    if (typeof v.text === 'string') return v.text
  }
  return null
}
