// Filtering and sorting the rows the work list already holds.
//
// Stephanie asked for both in August 2026: filter by status or due date, and sort
// "from soonest due date to latest, or other sorting options". Jeannette's 700
// rows asked for the same thing without naming it.
//
// Done in the browser, on the rows the page loaded, for the reason the search box
// is: which rows are fetched is decided by person and team on the server, and
// narrowing rows the browser already has should not cost a database round trip
// per click. Kept apart from the component because the rules are the part worth
// testing, and a filter that quietly drops rows is the failure this module most
// has to avoid.

import type { WorkRow } from './data'

export type DueFilter = '' | 'late' | 'today' | 'week' | 'month' | 'none'
export type ChangeFilter = '' | 'recent30' | 'recent90' | 'stale180' | 'stale365'

export interface ListFilters {
  /** A status label exactly as Monday writes it, or NO_STATUS for a step with none. */
  status: string
  board: string
  due: DueFilter
  change: ChangeFilter
}

export const NO_FILTERS: ListFilters = { status: '', board: '', due: '', change: '' }

/** The value the Status filter uses for a step whose status is blank. */
export const NO_STATUS = '__none__'

export type SortKey = 'item' | 'parent' | 'board' | 'workspace' | 'who' | 'priority' | 'step' | 'status' | 'due'
export interface Sort { key: SortKey; dir: 'asc' | 'desc' }

export const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: '', label: 'Any due date' },
  { value: 'late', label: 'Late' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due in the next 7 days' },
  { value: 'month', label: 'Due in the next 30 days' },
  { value: 'none', label: 'No due date' },
]

export const CHANGE_OPTIONS: { value: ChangeFilter; label: string }[] = [
  { value: '', label: 'Any last change' },
  { value: 'recent30', label: 'Changed in the last 30 days' },
  { value: 'recent90', label: 'Changed in the last 3 months' },
  { value: 'stale180', label: 'No change in 6+ months' },
  { value: 'stale365', label: 'No change in 12+ months' },
]

export function activeFilterCount(f: ListFilters): number {
  return [f.status, f.board, f.due, f.change].filter(Boolean).length
}

const DAY = 86_400_000

/** Midnight today as YYYY-MM-DD in the viewer's own calendar, which is what "late" means to them. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY)
  return t.toISOString().slice(0, 10)
}

/**
 * A usable deadline, or null.
 *
 * A suspect date (year 202, typed wrong once) is treated as no date everywhere
 * here, as the page already does: an unreadable year is not an urgency.
 */
function deadline(r: WorkRow): string | null {
  return r.dueDate && !r.dueSuspect ? r.dueDate : null
}

export function matchesDue(r: WorkRow, due: DueFilter, today: string): boolean {
  if (!due) return true
  const d = deadline(r)
  if (due === 'none') return d == null
  // A finished step is not late, and is not due this week either. Without this
  // "Late" matched every completed row whose date had passed, which is most of
  // them, and buried the three that were actually late.
  if (r.statusDone === true) return false
  if (d == null) return false
  if (due === 'late') return d < today
  if (due === 'today') return d === today
  if (due === 'week') return d >= today && d <= addDays(today, 7)
  return d >= today && d <= addDays(today, 30)
}

/**
 * When the ITEM last changed in Monday, which is the only date a step carries
 * that says whether anybody is still touching it. A row with no stamp matches
 * none of these, rather than pretending to be old or new.
 */
export function matchesChange(r: WorkRow, change: ChangeFilter, now: Date): boolean {
  if (!change) return true
  if (!r.itemUpdatedAt) return false
  const age = (now.getTime() - new Date(r.itemUpdatedAt).getTime()) / DAY
  if (change === 'recent30') return age <= 30
  if (change === 'recent90') return age <= 90
  if (change === 'stale180') return age >= 180
  return age >= 365
}

export function applyListFilters<T extends { row: WorkRow }>(rows: T[], f: ListFilters, now = new Date()): T[] {
  if (!activeFilterCount(f)) return rows
  const today = todayIso(now)
  return rows.filter(({ row: r }) =>
    (!f.status || (f.status === NO_STATUS ? !r.statusText : r.statusText === f.status))
    && (!f.board || String(r.boardId) === f.board)
    && matchesDue(r, f.due, today)
    && matchesChange(r, f.change, now))
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Sort by one column. Blanks always go last, in both directions: "soonest due
 * first" and "latest due first" should both put the rows with no date at the
 * bottom, since neither question is about them.
 */
export function sortRows<T extends { row: WorkRow }>(rows: T[], sort: Sort): T[] {
  const value = (r: WorkRow): string | number | null => {
    switch (sort.key) {
      case 'item': return r.itemName.toLowerCase()
      case 'parent': return r.parentItemName?.toLowerCase() ?? null
      case 'board': return r.boardName.toLowerCase()
      case 'workspace': return r.workspaceName?.toLowerCase() ?? null
      case 'who': return r.who.toLowerCase()
      case 'priority': return PRIORITY_RANK[r.priority] ?? 1
      case 'step': return r.stepName.toLowerCase()
      case 'status': return r.statusText?.toLowerCase() ?? null
      case 'due': return deadline(r)
    }
  }
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a.row), y = value(b.row)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return c * sign || a.row.itemName.localeCompare(b.row.itemName)
  })
}

/** The next sort a header click asks for: ascending, then descending, then back to the list's own order. */
export function nextSort(current: Sort | null, key: SortKey): Sort | null {
  if (!current || current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return null
}

// ── The URL ─────────────────────────────────────────────────────────────────
//
// Filters and sort are written to the address bar so a filtered list can be
// bookmarked or sent, as person and team already are. Short keys, because they
// sit beside the existing ones.

export function readListParams(p: { get(key: string): string | null }): { filters: ListFilters; sort: Sort | null } {
  const due = p.get('due') ?? ''
  const change = p.get('changed') ?? ''
  const rawSort = p.get('sort') ?? ''
  const key = rawSort.replace(/^-/, '') as SortKey
  const KEYS: SortKey[] = ['item', 'parent', 'board', 'workspace', 'who', 'priority', 'step', 'status', 'due']
  return {
    filters: {
      status: p.get('status') ?? '',
      board: p.get('board') ?? '',
      due: DUE_OPTIONS.some(o => o.value === due) ? (due as DueFilter) : '',
      change: CHANGE_OPTIONS.some(o => o.value === change) ? (change as ChangeFilter) : '',
    },
    sort: KEYS.includes(key) ? { key, dir: rawSort.startsWith('-') ? 'desc' : 'asc' } : null,
  }
}

export function writeListParams(base: URLSearchParams, filters: ListFilters, sort: Sort | null): URLSearchParams {
  const next = new URLSearchParams(base.toString())
  const set = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k))
  set('status', filters.status)
  set('board', filters.board)
  set('due', filters.due)
  set('changed', filters.change)
  set('sort', sort ? `${sort.dir === 'desc' ? '-' : ''}${sort.key}` : '')
  return next
}
