/**
 * boards/types.ts
 *
 * Shapes for the data returned by /api/snapshot, plus small helpers to read
 * Monday column values. Shared by the snapshot enrichment and the React UI.
 */

export interface SnapshotColumnValue {
  id: string
  type: string
  text: string | null
  value: string | null
}

export interface SnapshotSubitem {
  id: string
  name: string
  column_values: SnapshotColumnValue[]
}

export interface SnapshotItem {
  id: string
  name: string
  created_at: string
  updated_at: string
  state: string
  group: { id: string; title: string } | null
  column_values: SnapshotColumnValue[]
  subitems?: SnapshotSubitem[]
}

export interface SnapshotGroup {
  id: string
  title: string
}

export interface SnapshotLog {
  id: string
  event: string
  created_at: string
  /** JSON string; parse to read { column_id, value, ... }. */
  data: string
}

export interface SnapshotBoard {
  id: string
  items: SnapshotItem[]
  groups: SnapshotGroup[]
  activity: SnapshotLog[]
}

export interface SnapshotResponse {
  boards: SnapshotBoard[]
  _meta?: { elapsedMs: number; region: string }
}

/** Nested map of weekly targets: { boardId: { language: target } }. */
export type TargetsMap = Record<string, Record<string, number>>

/* ---------- Column-value helpers ---------- */

export function getColumnValue(
  item: SnapshotItem | SnapshotSubitem,
  colId: string,
): SnapshotColumnValue | undefined {
  return item.column_values.find((c) => c.id === colId)
}

/** The display text of a column ('' if missing/empty). */
export function getColumnText(item: SnapshotItem | SnapshotSubitem, colId: string): string {
  return getColumnValue(item, colId)?.text ?? ''
}

/** Parse a column's raw `value` JSON, or null if absent/malformed. */
export function parseColumnValue<T = unknown>(
  item: SnapshotItem | SnapshotSubitem,
  colId: string,
): T | null {
  const raw = getColumnValue(item, colId)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Parse a Monday activity-log `data` string into an object. */
export function parseLogData(log: SnapshotLog): Record<string, unknown> {
  try {
    return typeof log.data === 'string' ? JSON.parse(log.data) : (log.data ?? {})
  } catch {
    return {}
  }
}
