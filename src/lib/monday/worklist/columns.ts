// The columns of the work list, and which of them a reader has chosen to see.
//
// Five cannot be hidden, because without them a row is not actionable: the two
// ways out of it (Monday and its history), what it is (Item), and when it is
// due (Due and Time). Everything else is context a person may not need on a
// narrow screen or in a list that is all one board. Hiding a column only hides
// it: the filters read the rows, not the table, so filtering by a board works
// with the Board column switched off.
//
// Widths are split in two kinds. The columns that hold a chip, a date or a
// short word get a fixed width sized to what they hold, so no empty band opens
// up between Assignee and Time on a wide screen. The columns that hold names
// share what is left, Item the largest share, since it is the one people read.

import type { SortKey } from './list-view'

/** The widest the table may need with every column showing, so it fits a 1440px laptop. */
export const FITS_LAPTOP = 1320

export type ColumnKey =
  | 'monday' | 'history' | 'item' | 'parent' | 'board' | 'workspace'
  | 'who' | 'priority' | 'step' | 'status' | 'due' | 'time'

export interface ColumnDef {
  key: ColumnKey
  label: string
  required: boolean
  /** The grid track. Fixed where the content has a known size, shared where it is a name. */
  track: string
  /** The narrowest the column can be, which sets when the table starts to scroll sideways. */
  min: number
  sort?: SortKey
  align?: 'left' | 'right'
}

export const COLUMNS: ColumnDef[] = [
  { key: 'monday', label: 'Open in Monday', required: true, track: '44px', min: 44 },
  { key: 'history', label: 'History', required: true, track: '44px', min: 44 },
  // Minimums chosen so every column fits a 1440px laptop (about 1,328px of page
  // beside the sidebar) without scrolling sideways; above that, Item takes the
  // largest share of the extra width.
  { key: 'item', label: 'Item', required: true, track: 'minmax(200px,3fr)', min: 200, sort: 'item' },
  { key: 'parent', label: 'Parent item', required: false, track: 'minmax(130px,1.5fr)', min: 130, sort: 'parent' },
  { key: 'board', label: 'Board', required: false, track: 'minmax(110px,1.2fr)', min: 110, sort: 'board' },
  { key: 'workspace', label: 'Workspace', required: false, track: 'minmax(96px,1fr)', min: 96, sort: 'workspace' },
  // A name, but a short one: capped so it never takes width Item could use.
  { key: 'who', label: 'Assignee', required: false, track: 'minmax(112px,150px)', min: 112, sort: 'who' },
  // "MEDIUM" is the widest chip.
  { key: 'priority', label: 'Priority', required: false, track: '88px', min: 88, sort: 'priority' },
  { key: 'step', label: 'Step', required: false, track: 'minmax(110px,1fr)', min: 110, sort: 'step' },
  // Wide enough for "WORKING ON IT" on one line, capped for the same reason.
  { key: 'status', label: 'Status', required: false, track: 'minmax(128px,168px)', min: 128, sort: 'status' },
  // "Sep 14, 2026" and its padding.
  { key: 'due', label: 'Due', required: true, track: '108px', min: 108, sort: 'due', align: 'right' },
  // The time and the deadline badge share a cell: "9d LATE", "in 4d UPCOMING".
  { key: 'time', label: 'Time', required: true, track: 'minmax(128px,176px)', min: 128, align: 'right' },
]

export const ALL_COLUMNS: ColumnKey[] = COLUMNS.map(c => c.key)
const OPTIONAL = new Set(COLUMNS.filter(c => !c.required).map(c => c.key))

/** The grid template and the width below which the table scrolls sideways. */
export function gridFor(visible: ColumnKey[]): { template: string; minWidth: number; columns: ColumnDef[] } {
  const columns = COLUMNS.filter(c => c.required || visible.includes(c.key))
  return {
    template: columns.map(c => c.track).join(' '),
    minWidth: columns.reduce((s, c) => s + c.min, 0),
    columns,
  }
}

/**
 * Visible columns from what the browser remembered.
 *
 * What is stored is the list of columns HIDDEN, not shown: a column added to the
 * page later then appears for everybody instead of staying invisible to anyone
 * who once saved a choice. Anything unreadable falls back to every column.
 */
export function readColumnChoice(stored: string | null | undefined): ColumnKey[] {
  if (!stored) return ALL_COLUMNS
  let hidden: unknown
  try { hidden = JSON.parse(stored) } catch { return ALL_COLUMNS }
  if (!Array.isArray(hidden)) return ALL_COLUMNS
  const off = new Set(hidden.filter((k): k is ColumnKey => typeof k === 'string' && OPTIONAL.has(k as ColumnKey)))
  return ALL_COLUMNS.filter(k => !off.has(k))
}

/** What to store for a set of visible columns: the optional ones left out. */
export function writeColumnChoice(visible: ColumnKey[]): string {
  return JSON.stringify(ALL_COLUMNS.filter(k => OPTIONAL.has(k) && !visible.includes(k)))
}

/** Show or hide one column. A required column cannot be hidden, whatever is asked. */
export function toggleColumn(visible: ColumnKey[], key: ColumnKey): ColumnKey[] {
  if (!OPTIONAL.has(key)) return visible
  const on = visible.includes(key)
  return ALL_COLUMNS.filter(k => (k === key ? !on : visible.includes(k) || !OPTIONAL.has(k)))
}
