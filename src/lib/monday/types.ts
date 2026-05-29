/**
 * Shape of Monday webhook deliveries we care about.
 *
 * Monday sends multiple kinds of payloads depending on the event. We deal
 * with two:
 *
 *   1. Challenge (only on subscription)
 *      { "challenge": "abc123" }
 *      We echo it back so Monday knows the endpoint is alive.
 *
 *   2. Event ({ event: { type, ... } })
 *      Many event types; we react only to `update_column_value` on the
 *      Href Links status column. Other shapes are logged and ignored.
 *
 * All fields are optional in the type — we narrow at runtime. Trusting
 * the docs to be accurate is a great way to ship a bug. See `monday/verify.ts`
 * for why we keep the raw body around too.
 */

export interface MondayChallengeBody {
  challenge: string
}

export interface MondayEventBody {
  event: {
    /** e.g. 'update_column_value', 'create_pulse', 'change_status_column_value' */
    type?: string
    /** Board ID the change happened on */
    boardId?: number | string
    /** Item ID (pulse) affected */
    pulseId?: number | string
    /** Item name at time of event */
    pulseName?: string
    /** Column ID for column-related events */
    columnId?: string
    /** Type of the column ('status', 'link', 'text', ...) */
    columnType?: string
    /** Title of the column at time of event */
    columnTitle?: string
    /** Monday user that made the change */
    userId?: number | string
    /** Old/new column values — shape varies wildly by columnType */
    value?: unknown
    previousValue?: unknown
    /** Wall-clock time Monday observed the event */
    triggerTime?: string
    /** Truthy if this came from a Monday automation, not a human */
    isTopGroup?: boolean
  }
}

export function isChallengeBody(body: unknown): body is MondayChallengeBody {
  return typeof body === 'object'
    && body !== null
    && typeof (body as MondayChallengeBody).challenge === 'string'
}

export function isEventBody(body: unknown): body is MondayEventBody {
  return typeof body === 'object'
    && body !== null
    && typeof (body as MondayEventBody).event === 'object'
    && (body as MondayEventBody).event !== null
}
