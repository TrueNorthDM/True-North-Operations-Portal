// Recovering the hand-off dates the change log was too late to see.
//
// The log starts the day it starts. Everything already open on that day has
// no assigned event, so it has no held time and cannot appear in "sitting
// longest" however long it has actually been sitting. Monday still remembers
// some of it in activity_logs, and this reads it back.
//
// Only OPEN assignments are worth recovering. A step already finished before
// the log existed is a delivery nobody will count either way; a step still
// sitting with somebody is a number a lead would act on today.

import { gql } from './discover'
import { diffAssignments, type AssignmentEvent } from './changes'

type RawLog = { id: string; event: string; data: string; created_at: string; user_id: string | null }

/** Monday's created_at is microseconds since the epoch, as a string. */
export function whenOf(raw: string): string | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Math.round(n / 10000)).toISOString()
}

/**
 * The Monday accounts named in a people-column value.
 *
 * Teams can be assigned as well as people; a team is not somebody's workload
 * and the ingest already skips them, so this does too.
 */
export function accountsIn(value: unknown): number[] {
  if (value == null) return []
  const v = typeof value === 'string' ? safeParse(value) : value
  const list = (v as { personsAndTeams?: { id: number | string; kind?: string }[] })?.personsAndTeams
  if (!Array.isArray(list)) return []
  return list.filter(p => (p.kind ?? 'person') === 'person').map(p => Number(p.id)).filter(Number.isFinite)
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

export type OpenAssignment = {
  board_id: number
  item_id: number
  people_col: string
  monday_user_id: number
  status_text: string | null
  status_done: boolean | null
  due_date: string | null
}

/**
 * When each of these people landed on this item's step, from Monday's own log.
 *
 * Reads the column changes for one item and returns the moment each account
 * LAST appeared in the column and stayed. A person added, removed and added
 * again is holding it since the second time, which is the same rule the live
 * diff follows.
 */
export function handoffsFrom(logs: RawLog[], peopleCol: string): Map<number, string> {
  const changes = logs
    .filter(l => l.event === 'update_column_value')
    .map(l => ({ at: whenOf(l.created_at), parsed: safeParse(l.data) as Record<string, unknown> | null }))
    .filter(l => l.at && l.parsed?.column_id === peopleCol)
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))

  const since = new Map<number, string>()
  for (const c of changes) {
    const before = new Set(accountsIn(c.parsed?.previous_value))
    const after = accountsIn(c.parsed?.value)
    const now = new Set(after)

    for (const id of after) if (!before.has(id)) since.set(id, c.at!)
    for (const id of before) if (!now.has(id)) since.delete(id)
  }
  return since
}

/**
 * Backfilled assigned events for one item.
 *
 * Anything Monday cannot date is left out rather than dated from the item's
 * creation or from today. A wrong hand-off date is worse than a missing one:
 * it produces a held time that looks measured.
 */
export function backfillEvents(
  open: OpenAssignment[], handoffs: Map<number, string>,
): AssignmentEvent[] {
  return open
    .map(a => ({ a, at: handoffs.get(a.monday_user_id) }))
    .filter((x): x is { a: OpenAssignment; at: string } => Boolean(x.at))
    .map(({ a, at }) => ({
      board_id: a.board_id,
      item_id: a.item_id,
      people_col: a.people_col,
      monday_user_id: a.monday_user_id,
      event: 'assigned' as const,
      from_value: null,
      to_value: a.status_text,
      status_done: a.status_done,
      due_date: a.due_date,
      occurred_at: at,
    }))
}

/** Reads one item's column history. Kept here so the route stays about flow. */
export async function fetchItemLogs(
  token: string, boardId: number, itemId: number,
): Promise<RawLog[]> {
  const d = await gql<{ boards: { activity_logs: RawLog[] }[] }>(token, `
    query ($board: [ID!], $item: [ID!]) {
      boards(ids: $board) {
        activity_logs(item_ids: $item, limit: 200) { id event data created_at user_id }
      }
    }`, { board: [String(boardId)], item: [String(itemId)] })
  return d.boards?.[0]?.activity_logs ?? []
}

export { diffAssignments }
