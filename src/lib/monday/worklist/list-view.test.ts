import { describe, it, expect } from 'vitest'
import {
  applyListFilters, sortRows, nextSort, matchesDue, matchesChange, readListParams, writeListParams,
  activeFilterCount, todayIso, NO_FILTERS, NO_STATUS,
} from './list-view'
import type { WorkRow } from './data'

const NOW = new Date(2026, 8, 15, 10, 0, 0) // 15 September 2026, local time
const TODAY = '2026-09-15'

const row = (o: Partial<WorkRow>): { row: WorkRow } => ({
  row: {
    id: 1, boardId: 10, boardName: 'BM - General Audits', workspaceName: 'i7 Projects', itemId: 100,
    itemName: 'Item', parentItemName: null, language: null, groupTitle: null, stepName: 'Audit', statusText: 'Working on it',
    statusDone: false, statusColor: null, dueDate: null, dueSuspect: false, dueLabel: 'Audit By', url: null,
    assigneeKnown: true, priority: 'medium', mondayUserId: 1, who: 'Stephanie Aguirre',
    itemUpdatedAt: '2026-09-10T12:00:00Z', peopleCol: 'people4',
    ...o,
  },
})

describe('todayIso', () => {
  it('is the viewer\'s own calendar day when asked for their zone', () => {
    expect(todayIso(NOW, Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(TODAY)
  })

  // Audit, 10 October 2026: New York's day, whatever clock runs it.
  it('is the New York day, not the clock of the machine asking', () => {
    // 1:30 AM in UTC (and in the evening in Asia) is still the 14th in New York.
    expect(todayIso(new Date('2026-09-15T01:30:00Z'))).toBe('2026-09-14')
    // 11 PM in New York is already the next day in UTC.
    expect(todayIso(new Date('2026-09-15T03:00:00Z'))).toBe('2026-09-14')
    expect(todayIso(new Date('2026-09-15T04:00:00Z'))).toBe('2026-09-15')
    // Winter: five hours behind, not four.
    expect(todayIso(new Date('2026-01-15T04:30:00Z'))).toBe('2026-01-14')
  })

  it('lets a filter use the day the page was given', () => {
    const late = [row({ id: 1, dueDate: '2026-09-14' })]
    const filters = { ...NO_FILTERS, due: 'late' as const }
    expect(applyListFilters(late, filters, NOW, '2026-09-14')).toHaveLength(0)
    expect(applyListFilters(late, filters, NOW, '2026-09-15')).toHaveLength(1)
  })
})

describe('matchesDue', () => {
  it('reads late, today, the next week and month, and no date', () => {
    expect(matchesDue(row({ dueDate: '2026-09-14' }).row, 'late', TODAY)).toBe(true)
    expect(matchesDue(row({ dueDate: '2026-09-15' }).row, 'late', TODAY)).toBe(false)
    expect(matchesDue(row({ dueDate: '2026-09-15' }).row, 'today', TODAY)).toBe(true)
    expect(matchesDue(row({ dueDate: '2026-09-22' }).row, 'week', TODAY)).toBe(true)
    expect(matchesDue(row({ dueDate: '2026-09-23' }).row, 'week', TODAY)).toBe(false)
    expect(matchesDue(row({ dueDate: '2026-10-15' }).row, 'month', TODAY)).toBe(true)
    expect(matchesDue(row({ dueDate: null }).row, 'none', TODAY)).toBe(true)
  })

  it('never calls finished work late or due', () => {
    expect(matchesDue(row({ dueDate: '2026-09-01', statusDone: true }).row, 'late', TODAY)).toBe(false)
    expect(matchesDue(row({ dueDate: '2026-09-16', statusDone: true }).row, 'week', TODAY)).toBe(false)
    expect(matchesDue(row({ dueDate: null, statusDone: true }).row, 'none', TODAY)).toBe(true)
  })

  // Year 202 is a typo, not a deadline two thousand years ago.
  it('treats a suspect date as no date', () => {
    expect(matchesDue(row({ dueDate: '0202-08-21', dueSuspect: true }).row, 'late', TODAY)).toBe(false)
    expect(matchesDue(row({ dueDate: '0202-08-21', dueSuspect: true }).row, 'none', TODAY)).toBe(true)
  })
})

describe('matchesChange', () => {
  it('reads recent and stale work off when the item last changed', () => {
    expect(matchesChange(row({ itemUpdatedAt: '2026-09-01T00:00:00Z' }).row, 'recent30', NOW)).toBe(true)
    expect(matchesChange(row({ itemUpdatedAt: '2026-01-01T00:00:00Z' }).row, 'stale180', NOW)).toBe(true)
    expect(matchesChange(row({ itemUpdatedAt: '2026-01-01T00:00:00Z' }).row, 'stale365', NOW)).toBe(false)
    expect(matchesChange(row({ itemUpdatedAt: '2025-03-28T00:00:00Z' }).row, 'stale365', NOW)).toBe(true)
  })

  it('does not guess the age of a row with no stamp', () => {
    expect(matchesChange(row({ itemUpdatedAt: null }).row, 'stale365', NOW)).toBe(false)
    expect(matchesChange(row({ itemUpdatedAt: null }).row, '', NOW)).toBe(true)
  })
})

describe('applyListFilters', () => {
  const rows = [
    row({ id: 1, statusText: 'Stuck', boardId: 10, dueDate: '2026-09-01' }),
    row({ id: 2, statusText: 'Working on it', boardId: 20, dueDate: '2026-09-20' }),
    row({ id: 3, statusText: null, boardId: 10, dueDate: null }),
  ]
  const ids = (r: { row: WorkRow }[]) => r.map(x => x.row.id)

  it('returns every row when nothing is chosen', () => {
    expect(applyListFilters(rows, NO_FILTERS, NOW)).toBe(rows)
  })

  it('narrows by status, including a blank status', () => {
    expect(ids(applyListFilters(rows, { ...NO_FILTERS, status: 'Stuck' }, NOW))).toEqual([1])
    expect(ids(applyListFilters(rows, { ...NO_FILTERS, status: NO_STATUS }, NOW))).toEqual([3])
  })

  it('combines filters, every one of them has to hold', () => {
    expect(ids(applyListFilters(rows, { ...NO_FILTERS, board: '10', due: 'late' }, NOW))).toEqual([1])
    expect(activeFilterCount({ ...NO_FILTERS, board: '10', due: 'late' })).toBe(2)
  })
})

describe('sortRows', () => {
  const rows = [
    row({ id: 1, itemName: 'B', dueDate: '2026-09-20', priority: 'low' }),
    row({ id: 2, itemName: 'A', dueDate: null, priority: 'high' }),
    row({ id: 3, itemName: 'C', dueDate: '2026-09-01', priority: 'medium' }),
  ]
  const ids = (r: { row: WorkRow }[]) => r.map(x => x.row.id)

  it('puts the soonest deadline first, and rows with no date last', () => {
    expect(ids(sortRows(rows, { key: 'due', dir: 'asc' }))).toEqual([3, 1, 2])
  })

  it('keeps rows with no date last when the order is reversed', () => {
    expect(ids(sortRows(rows, { key: 'due', dir: 'desc' }))).toEqual([1, 3, 2])
  })

  it('sorts by language with the rows that have none last', () => {
    const langs = [row({ id: 7, language: 'Spanish' }), row({ id: 8, language: null }), row({ id: 9, language: 'English' })]
    expect(ids(sortRows(langs, { key: 'language', dir: 'asc' }))).toEqual([9, 7, 8])
  })

  it('sorts priority by rank, not alphabetically', () => {
    expect(ids(sortRows(rows, { key: 'priority', dir: 'asc' }))).toEqual([2, 3, 1])
  })

  it('sorts by place in the team order, numerically, with finished steps last', () => {
    const ranked = [row({ id: 4, teamRank: 12 }), row({ id: 5, teamRank: null }), row({ id: 6, teamRank: 3 })]
    expect(ids(sortRows(ranked, { key: 'team', dir: 'asc' }))).toEqual([6, 4, 5])
    expect(readListParams(new URLSearchParams('sort=team')).sort).toEqual({ key: 'team', dir: 'asc' })
  })

  it('does not reorder the rows it was given', () => {
    const copy = [...rows]
    sortRows(rows, { key: 'item', dir: 'asc' })
    expect(rows).toEqual(copy)
  })
})

describe('nextSort', () => {
  it('goes ascending, descending, then back to the list\'s own order', () => {
    const a = nextSort(null, 'due')
    expect(a).toEqual({ key: 'due', dir: 'asc' })
    const b = nextSort(a, 'due')
    expect(b).toEqual({ key: 'due', dir: 'desc' })
    expect(nextSort(b, 'due')).toBeNull()
    expect(nextSort(b, 'board')).toEqual({ key: 'board', dir: 'asc' })
  })
})

describe('the URL', () => {
  it('round-trips filters and sort, and drops what it does not recognise', () => {
    const written = writeListParams(new URLSearchParams('tab=work&person='), { status: 'Stuck', board: '10', due: 'late', change: 'stale180' }, { key: 'due', dir: 'desc' })
    expect(written.get('tab')).toBe('work')
    expect(written.get('person')).toBe('')
    const read = readListParams(written)
    expect(read.filters).toEqual({ status: 'Stuck', board: '10', due: 'late', change: 'stale180' })
    expect(read.sort).toEqual({ key: 'due', dir: 'desc' })
    expect(readListParams(new URLSearchParams('due=soon&sort=banana')).filters.due).toBe('')
    expect(readListParams(new URLSearchParams('sort=banana')).sort).toBeNull()
  })

  it('removes a filter from the address when it is cleared', () => {
    const cleared = writeListParams(new URLSearchParams('status=Stuck&due=late'), NO_FILTERS, null)
    expect(cleared.toString()).toBe('')
  })
})
