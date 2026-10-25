import { describe, it, expect } from 'vitest'
import { cleanHiddenChoice, fixedTrack, flexTrack, hiddenFor, layoutColumns, readHidden } from './columns'

const COLS = [
  { key: 'person', ...flexTrack(1.9, 142) },
  { key: 'team', ...flexTrack(1, 64) },
  { key: 'clientRate', ...fixedTrack(150) },
  { key: 'over', ...fixedTrack(90) },
]
const OPTS = { gap: 14, padX: 44 }

describe('layoutColumns', () => {
  it('draws every column when nothing is hidden', () => {
    const l = layoutColumns(COLS, [], ['person'], OPTS)
    expect(l.visible.map(c => c.key)).toEqual(['person', 'team', 'clientRate', 'over'])
    expect(l.template).toBe('minmax(142px, 1.9fr) minmax(64px, 1fr) 150px 90px')
    expect(l.minWidth).toBe(142 + 64 + 150 + 90 + 3 * 14 + 44)
  })

  it('takes a hidden column out of the grid and the width', () => {
    const l = layoutColumns(COLS, ['team', 'over'], ['person'], OPTS)
    expect(l.visible.map(c => c.key)).toEqual(['person', 'clientRate'])
    expect(l.template).toBe('minmax(142px, 1.9fr) 150px')
    expect(l.minWidth).toBe(142 + 150 + 14 + 44)
  })

  it('never hides a fixed column, and ignores keys the table does not have', () => {
    const l = layoutColumns(COLS, ['person', 'team', 'clientRate', 'over', 'nope'], ['person'], OPTS)
    expect(l.visible.map(c => c.key)).toEqual(['person'])
    expect(l.minWidth).toBe(142 + 44)
  })
})

describe('hiddenFor', () => {
  it('uses the table default until the person chooses', () => {
    expect(hiddenFor({}, 'directory-people')).toEqual(['job', 'role', 'type', 'time'])
    expect(hiddenFor({ 'directory-people': [] }, 'directory-people')).toEqual([])
    expect(hiddenFor({}, 'rates')).toEqual([])
  })

  it('drops fixed and unknown keys and keeps the table order', () => {
    expect(hiddenFor({ rates: ['over', 'person', 'x', 'team', 'team'] }, 'rates')).toEqual(['team', 'over'])
    expect(hiddenFor({ 'directory-access': ['when', 'device'] }, 'directory-access')).toEqual(['device'])
  })
})

describe('readHidden', () => {
  it('reads only known tables with lists', () => {
    expect(readHidden(null)).toEqual({})
    expect(readHidden([])).toEqual({})
    expect(readHidden({ rates: ['joined', 'person'], other: ['a'], 'directory-emails': 'coe' })).toEqual({ rates: ['joined'] })
  })
})

describe('cleanHiddenChoice', () => {
  it('accepts a known table and a list of strings', () => {
    expect(cleanHiddenChoice('directory-portal', ['twoStep', 'access', 'signsIn'])).toEqual({ table: 'directory-portal', hidden: ['signsIn', 'twoStep'] })
    expect(cleanHiddenChoice('rates', [])).toEqual({ table: 'rates', hidden: [] })
  })

  it('refuses what it cannot read', () => {
    expect(cleanHiddenChoice('nope', [])).toBeNull()
    expect(cleanHiddenChoice('rates', 'team')).toBeNull()
    expect(cleanHiddenChoice('rates', [1])).toBeNull()
    expect(cleanHiddenChoice('toString', [])).toBeNull()
  })
})
