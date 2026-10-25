/**
 * Which table columns each person shows (owner, 25 October 2026): on Rates &
 * Costs and on every table of the Directory, a person hides the columns they
 * do not need, and the choice is kept in their account
 * (person_settings.hidden_columns, migration 123), so the same columns show on
 * any computer or phone.
 *
 * Stored by table, the keys that person hides: { "rates": ["joined"] }. A
 * table with no entry shows its default set; an entry, even an empty one, is
 * the person's own choice ("Show all" stores an empty one). Each table's
 * identity column (the person, and on two tables the column a row is about)
 * is fixed: never hidden, whatever was stored.
 *
 * Pure apart from the loader, and tested (columns.test.ts).
 */

import type { Db } from '@/lib/supabase/types'

interface TableSpec {
  /** Every column the table can show, in its order. */
  keys: readonly string[]
  /** Never hidden. */
  fixed: readonly string[]
  /** Hidden until the person makes a choice of their own. */
  defaultHidden: readonly string[]
}

export const COLUMN_TABLES = {
  rates: {
    keys: ['person', 'team', 'reports', 'joined', 'timesheet', 'paysAs', 'clientRate', 'costRate', 'beRate', 'salary', 'allowance', 'over'],
    fixed: ['person'],
    defaultHidden: [],
  },
  // The People tab showed these five by default before the choice moved to
  // the account (it was kept in each browser until 25 October 2026).
  'directory-people': {
    keys: ['person', 'job', 'team', 'role', 'status', 'type', 'time', 'reports', 'joined', 'tsheets'],
    fixed: ['person'],
    defaultHidden: ['job', 'role', 'type', 'time'],
  },
  'directory-emails': {
    keys: ['person', 'trueNorth', 'goodnews', 'coe'],
    fixed: ['person'],
    defaultHidden: [],
  },
  // An access is who and when: both stay.
  'directory-access': {
    keys: ['person', 'email', 'when', 'device'],
    fixed: ['person', 'when'],
    defaultHidden: [],
  },
  // Portal access is what the tab is about, and what decides who can be ticked.
  'directory-portal': {
    keys: ['person', 'signsIn', 'access', 'lastSignIn', 'twoStep'],
    fixed: ['person', 'access'],
    defaultHidden: [],
  },
} as const satisfies Record<string, TableSpec>

export type TableId = keyof typeof COLUMN_TABLES
/** What is stored: by table, the keys hidden. */
export type HiddenColumns = Partial<Record<TableId, string[]>>
/** How a table saves a choice: the server action, or a stand-in in design checks. */
export type SaveHidden = (table: TableId, hidden: string[]) => Promise<{ ok: boolean; error?: string }>

export const isTableId = (v: unknown): v is TableId => typeof v === 'string' && Object.hasOwn(COLUMN_TABLES, v)

export const fixedOf = (table: TableId): readonly string[] => COLUMN_TABLES[table].fixed

/** Known, hideable keys of the table, once each, in the table's order. Anything else is dropped. */
function tidy(table: TableId, keys: readonly unknown[]): string[] {
  const spec: TableSpec = COLUMN_TABLES[table]
  return spec.keys.filter(k => !spec.fixed.includes(k) && keys.includes(k))
}

/** The stored value, read safely: unknown tables and keys are left out. */
export function readHidden(v: unknown): HiddenColumns {
  const out: HiddenColumns = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [table, keys] of Object.entries(v)) {
    if (isTableId(table) && Array.isArray(keys)) out[table] = tidy(table, keys)
  }
  return out
}

/** A table's hidden keys: the person's own choice, else the table's default. Never a fixed key. */
export function hiddenFor(all: HiddenColumns, table: TableId): string[] {
  return tidy(table, all[table] ?? COLUMN_TABLES[table].defaultHidden)
}

/** What a browser sent, checked. Null when it cannot be read. */
export function cleanHiddenChoice(table: unknown, hidden: unknown): { table: TableId; hidden: string[] } | null {
  if (!isTableId(table) || !Array.isArray(hidden) || hidden.length > 50) return null
  if (!hidden.every(k => typeof k === 'string')) return null
  return { table, hidden: tidy(table, hidden) }
}

/** A grid column: its key, its grid track and the narrowest it gets, in pixels. */
export interface GridCol { key: string; track: string; min: number }

/** A column of a set width. */
export const fixedTrack = (px: number) => ({ track: `${px}px`, min: px })
/** A column that takes a share of the room left, never narrower than `min`. */
export const flexTrack = (fr: number, min: number) => ({ track: `minmax(${min}px, ${fr}fr)`, min })

/**
 * The columns a table draws, its grid-template-columns and the narrowest the
 * table may get (below it the table scrolls sideways). A hidden column leaves
 * the grid; a fixed one stays, whatever is hidden.
 */
export function layoutColumns<C extends GridCol>(cols: readonly C[], hidden: readonly string[], fixed: readonly string[], opts: { gap: number; padX: number }): { visible: C[]; template: string; minWidth: number } {
  const visible = cols.filter(c => fixed.includes(c.key) || !hidden.includes(c.key))
  const minWidth = visible.reduce((n, c) => n + c.min, 0) + opts.gap * Math.max(0, visible.length - 1) + opts.padX
  return { visible, template: visible.map(c => c.track).join(' '), minWidth }
}

/** The person's choices; none (every table on its default) while the migration has not run or the read fails. */
export async function loadHiddenColumns(db: Db, personId: string | null | undefined): Promise<HiddenColumns> {
  if (!personId) return {}
  const { data, error } = await db.from('person_settings').select('hidden_columns').eq('person_id', personId).maybeSingle()
  if (error || !data) return {}
  return readHidden(data.hidden_columns)
}
