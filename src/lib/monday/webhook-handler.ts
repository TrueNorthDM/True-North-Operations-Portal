/**
 * The Monday webhook, minus the URL it arrives on.
 *
 * One route calls this today: the secret URL (/api/monday/webhook/<secret>).
 *
 * `via` is recorded on every audit row and outlived its first purpose. It
 * existed to tell deliveries on the secret URL apart from ones still arriving
 * on /api/monday/webhook, the unauthenticated route that used to sit here; that
 * route is gone, and the count on Admin -> Automations is what proved it was
 * safe to delete. The tag stays because 'legacy-url' rows are still in the
 * event log and because a second door may exist again one day.
 *
 * Responsibilities:
 *
 *   1. Subscription challenge handshake. When you register a webhook, Monday's
 *      first POST contains `{ challenge: "<random>" }`. We must echo it within
 *      a few seconds or Monday refuses to enable the subscription.
 *
 *   2. Dispatch. Each event is logged to `monday_events` (audit trail), then
 *      routed by `boardId + columnId + newValue` to the right handler. Unknown
 *      shapes are logged with result='skipped:<reason>' and return 200: we
 *      never make Monday retry on something we don't understand, because the
 *      retry storm just wastes both sides' budget.
 *
 * AUTHENTICATION lives in the route, not here, because it IS the URL. Monday
 * does not sign webhooks created with a personal API token: signing requires an
 * integration app, and this account has none (verified in the Developer Center,
 * "My apps" is empty). See lib/monday/webhook-secret.ts.
 *
 * Always returns 200, failures included (audit, 10 October 2026). A 5xx makes
 * Monday retry, and a retry of a failure that is Monday's own (an outage, the
 * rate limit) fails again; it used to answer 500 on any Monday error and leave
 * an empty row per retry. A failure is written on the event's row as
 * "error:...", and the site's Recent activity feed shows it to the SEO team.
 *
 * Each delivery is processed once: its key (Monday's trigger id, else item,
 * column and time) is unique in monday_events (migration 107), so a replay of
 * the same delivery is refused before anything is done.
 */

import { NextResponse } from 'next/server'
import type { Json } from '@/lib/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { isChallengeBody, isEventBody, type MondayEventBody } from '@/lib/monday/types'
import { runLinkHandler, doneHandler } from '@/lib/monday/handlers'

/** 'legacy-url' is historical: that route was removed on 2026-08-04. */
export type DeliveryDoor = 'secret-url' | 'legacy-url'

export async function handleMondayWebhook(rawBody: string, via: DeliveryDoor) {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // Challenge handshake. Monday sends this when the subscription is created.
  if (isChallengeBody(body)) {
    return NextResponse.json({ challenge: body.challenge }, { status: 200 })
  }

  if (!isEventBody(body)) {
    return NextResponse.json({ error: 'unexpected payload shape' }, { status: 400 })
  }

  // Machine-to-machine endpoint with no user session, so the admin
  // (service_role) client: RLS would otherwise hide every row in sites,
  // app_settings and the rest.
  const supabase = createAdminClient()
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('monday_api_token')
    .eq('singleton_id', 1)
    .maybeSingle<{ monday_api_token: string | null }>()
  const token = settingsRow?.monday_api_token ?? ''

  // Persist the audit row early. If processing crashes after this point, the
  // event still shows up in monday_events for forensics.
  const event = body.event
  const auditRow = {
    event_type: String(event.type ?? 'unknown'),
    board_id: event.boardId != null ? String(event.boardId) : null,
    monday_item_id: event.pulseId != null ? String(event.pulseId) : null,
    column_id: event.columnId ?? null,
    old_value: (event.previousValue ?? null) as Json,
    new_value: (event.value ?? null) as Json,
    user_id: event.userId != null ? String(event.userId) : null,
    raw_payload: body as unknown as Json,
  }
  const deliveryKey = keyOfDelivery(event)
  const { data: auditInsert, error: auditErr } = await supabase
    .from('monday_events')
    .insert({ ...auditRow, delivery_key: deliveryKey })
    .select('id')
    .single()
  if (auditErr?.code === '23505') {
    return NextResponse.json({ ok: true, result: 'skipped:duplicate delivery' }, { status: 200 })
  }
  if (auditErr) console.error('[monday-webhook] the event could not be logged:', auditErr.message)
  const auditId = auditInsert?.id as string | undefined

  let dispatched: string
  try {
    dispatched = await dispatch(event, { token, supabase })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[monday-webhook] handling failed:', message)
    dispatched = `error:monday (${message.slice(0, 200)})`
  }
  const result = `${via} · ${dispatched}`

  if (auditId) {
    await supabase
      .from('monday_events')
      .update({ processed_at: new Date().toISOString(), result })
      .eq('id', auditId)
  }

  return NextResponse.json({ ok: true, result }, { status: 200 })
}

/**
 * Route the event by (board, column, new label) to a handler.
 * Returns a short string for the audit log.
 *
 * We don't hardcode the Href Links column ID here, instead the handlers
 * receive the boardId and look up the column mapping themselves via
 * sites.monday_column_ids. That keeps the routing logic data-driven and
 * means a new project doesn't require a code change.
 */
async function dispatch(
  event: MondayEventBody['event'],
  ctx: { token: string; supabase: ReturnType<typeof createAdminClient> },
): Promise<string> {
  const colId = event.columnId
  const boardId = event.boardId != null ? String(event.boardId) : null
  const itemId = event.pulseId != null ? String(event.pulseId) : null
  if (!colId || !boardId || !itemId) return 'skipped:missing column/board/item id'

  // The new value of a status column is wrapped, Monday sends e.g.
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

  // The label in the delivery says what to do; Monday itself is asked again
  // before anything is done (handlers.ts), so a forged or stale delivery acts
  // on nothing.
  if (newLabel === 'Run Link') {
    return runLinkHandler(boardId, itemId, ctx, newLabel)
  }
  if (newLabel === 'Done') {
    return doneHandler(boardId, itemId, ctx, newLabel)
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

/** One Monday delivery's identity: its trigger id when Monday sends one, else item, column and time. */
export function keyOfDelivery(event: MondayEventBody['event']): string | null {
  const e = event as MondayEventBody['event'] & { triggerUuid?: string }
  if (e.triggerUuid) return `uuid:${e.triggerUuid}`
  if (e.pulseId != null && e.columnId && e.triggerTime) return `${e.pulseId}:${e.columnId}:${e.triggerTime}`
  return null
}
