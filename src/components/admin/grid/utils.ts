// Pure sort/filter helpers for the Directory grid. No React — just data in, data
// out — so they're trivial to reason about and reuse across the three tabs.

import type { ColType, FilterCond, GridColumn, Operator, SortState } from './types'

// Operators offered for each column type. The first entry is the default.
export function operatorsFor(type: ColType): { op: Operator; label: string }[] {
  switch (type) {
    case 'text':
      return [
        { op: 'contains', label: 'contains' },
        { op: 'is', label: 'is' },
        { op: 'is_not', label: 'is not' },
        { op: 'empty', label: 'is empty' },
        { op: 'not_empty', label: 'is not empty' },
      ]
    case 'enum':
      return [
        { op: 'is', label: 'is' },
        { op: 'is_not', label: 'is not' },
        { op: 'empty', label: 'is empty' },
        { op: 'not_empty', label: 'is not empty' },
      ]
    case 'number':
      return [
        { op: 'is', label: '=' },
        { op: 'gt', label: '>' },
        { op: 'lt', label: '<' },
        { op: 'empty', label: 'is empty' },
        { op: 'not_empty', label: 'is not empty' },
      ]
    case 'date':
      return [
        { op: 'after', label: 'after' },
        { op: 'before', label: 'before' },
        { op: 'is', label: 'on' },
        { op: 'empty', label: 'is empty' },
        { op: 'not_empty', label: 'is not empty' },
      ]
  }
}

export const isValuelessOp = (op: Operator) => op === 'empty' || op === 'not_empty'

const norm = (v: string | number | null) => (v == null ? '' : String(v)).toLowerCase().trim()
const isEmpty = (v: string | number | null) => v == null || String(v).trim() === ''

function matches<T>(row: T, col: GridColumn<T>, cond: FilterCond): boolean {
  const raw = col.get(row)
  switch (cond.op) {
    case 'empty': return isEmpty(raw)
    case 'not_empty': return !isEmpty(raw)
    case 'contains': return norm(raw).includes(norm(cond.value))
    case 'is':
      if (col.type === 'number') return Number(raw) === Number(cond.value)
      return norm(raw) === norm(cond.value)
    case 'is_not': return norm(raw) !== norm(cond.value)
    case 'gt': return !isEmpty(raw) && Number(raw) > Number(cond.value)
    case 'lt': return !isEmpty(raw) && Number(raw) < Number(cond.value)
    // ISO dates (YYYY-MM-DD) compare correctly as plain strings.
    case 'after': return !isEmpty(raw) && String(raw) > cond.value
    case 'before': return !isEmpty(raw) && String(raw) < cond.value
    default: return true
  }
}

export function applyFilters<T>(rows: T[], cols: GridColumn<T>[], conds: FilterCond[]): T[] {
  if (conds.length === 0) return rows
  const byId = new Map(cols.map(c => [c.id, c]))
  return rows.filter(row =>
    conds.every(cond => {
      const col = byId.get(cond.col)
      if (!col) return true
      // A value operator with no value yet is a no-op (don't hide everything).
      if (!isValuelessOp(cond.op) && cond.value === '') return true
      return matches(row, col, cond)
    }),
  )
}

// Stable sort with empties always pushed to the end (regardless of direction).
export function applySort<T>(rows: T[], cols: GridColumn<T>[], sort: SortState | null): T[] {
  if (!sort) return rows
  const col = cols.find(c => c.id === sort.id)
  if (!col) return rows
  const dir = sort.dir === 'asc' ? 1 : -1
  return rows
    .map((r, i) => [r, i] as const)
    .sort(([a, ai], [b, bi]) => {
      const av = col.get(a), bv = col.get(b)
      const ae = isEmpty(av), be = isEmpty(bv)
      if (ae && be) return ai - bi
      if (ae) return 1
      if (be) return -1
      const cmp = col.type === 'number'
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return cmp !== 0 ? cmp * dir : ai - bi
    })
    .map(([r]) => r)
}

// Click behaviour: unsorted → asc → desc → unsorted, per column.
export function nextSort(cur: SortState | null, id: string): SortState | null {
  if (!cur || cur.id !== id) return { id, dir: 'asc' }
  if (cur.dir === 'asc') return { id, dir: 'desc' }
  return null
}

// Human-readable chip text for an active condition, e.g. "Team is Writers".
export function chipText<T>(col: GridColumn<T>, cond: FilterCond): string {
  const opLabel = operatorsFor(col.type).find(o => o.op === cond.op)?.label ?? cond.op
  if (isValuelessOp(cond.op)) return `${col.label} ${opLabel}`
  const valLabel = col.options?.find(o => o.value === cond.value)?.label ?? cond.value
  return `${col.label} ${opLabel} ${valLabel}`
}
