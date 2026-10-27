/**
 * The stops Clock safety lists, and why each happened (owner's plan, 27
 * October 2026, "Allowance stops on the Clock safety page"):
 *
 *   auto_stop   the 5-hour safety net stopped a forgotten clock; the person
 *               confirms the real end.
 *   limit_stop  the clock reached the person's hours allowance; nothing to
 *               confirm, the hours ran out (migration 126).
 *
 * Pure: the row the stop writes, the reason it shows and the counts.
 */

import type { TablesInsert } from '@/lib/types/database.types'
import { sessionStart, type WindowedEntry } from './safety'

export const STOP_KINDS = ['auto_stop', 'limit_stop'] as const
export type StopKind = (typeof STOP_KINDS)[number]
export type StopReason = 'five_hours' | 'allowance'

export const isStopKind = (kind: string): kind is StopKind => (STOP_KINDS as readonly string[]).includes(kind)

/** Why the clock stopped, from the event's kind. */
export const stopReasonOf = (kind: string): StopReason => (kind === 'limit_stop' ? 'allowance' : 'five_hours')

/** The label on the page. */
export const STOP_REASON_LABEL: Record<StopReason, string> = {
  five_hours: '5-hour check',
  allowance: 'Allowance reached',
}

/**
 * The Clock safety row of a clock stopped at the allowance. Keyed (person,
 * kind, window_started_at) by the clock's own start: each clock reaches the
 * limit once, and a later clock (after extra hours) gets its own row.
 */
export function limitStopEvent(
  e: WindowedEntry & { person_id: string; jobcode_id: number | null; started_at: string },
  entryId: number, stoppedAtReal: string, allowance: string, now: Date,
): TablesInsert<'tc_safety_events'> {
  return {
    person_id: e.person_id,
    entry_id: entryId,
    kind: 'limit_stop',
    at: now.toISOString(),
    window_started_at: e.started_at_real ?? e.started_at,
    session_started_at: sessionStart(e),
    jobcode_id: e.jobcode_id,
    stopped_at: stoppedAtReal,
    allowance,
  }
}

/** The totals on the cards: stops of each kind, people stopped, 5-hour stops whose end is confirmed. */
export function stopCounts(stops: readonly { kind: string; person_id: string; confirmed_at: string | null }[]) {
  const five = stops.filter(s => stopReasonOf(s.kind) === 'five_hours')
  return {
    autoStops: five.length,
    allowanceStops: stops.length - five.length,
    people: new Set(stops.map(s => s.person_id)).size,
    confirmed: five.filter(s => s.confirmed_at).length,
  }
}
