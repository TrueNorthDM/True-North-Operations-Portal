import { describe, it, expect } from 'vitest'
import { gridFor, readColumnChoice, writeColumnChoice, toggleColumn, ALL_COLUMNS, COLUMNS, FITS_LAPTOP } from './columns'

describe('the columns that cannot be hidden', () => {
  it('are Monday, History, Item, Due and Time', () => {
    expect(COLUMNS.filter(c => c.required).map(c => c.key)).toEqual(['monday', 'history', 'item', 'due', 'time'])
  })

  it('stay visible whatever is stored or toggled', () => {
    expect(readColumnChoice(JSON.stringify(['item', 'due', 'board']))).toEqual(ALL_COLUMNS.filter(k => k !== 'board'))
    expect(toggleColumn(ALL_COLUMNS, 'item')).toEqual(ALL_COLUMNS)
  })
})

describe('readColumnChoice and writeColumnChoice', () => {
  it('shows every column when nothing was saved or the value is unreadable', () => {
    expect(readColumnChoice(null)).toEqual(ALL_COLUMNS)
    expect(readColumnChoice('not json')).toEqual(ALL_COLUMNS)
    expect(readColumnChoice('{"a":1}')).toEqual(ALL_COLUMNS)
  })

  it('round-trips a choice, storing what is hidden', () => {
    const visible = toggleColumn(toggleColumn(ALL_COLUMNS, 'workspace'), 'priority')
    const stored = writeColumnChoice(visible)
    expect(JSON.parse(stored)).toEqual(['workspace', 'priority'])
    expect(readColumnChoice(stored)).toEqual(visible)
  })

  // A column added to the page later appears for somebody who saved a choice
  // before it existed, rather than staying invisible to them.
  it('ignores names it does not know', () => {
    expect(readColumnChoice(JSON.stringify(['someday', 'board']))).toEqual(ALL_COLUMNS.filter(k => k !== 'board'))
  })
})

describe('toggleColumn', () => {
  it('hides and shows again, keeping the table order', () => {
    const hidden = toggleColumn(ALL_COLUMNS, 'board')
    expect(hidden).not.toContain('board')
    expect(toggleColumn(hidden, 'board')).toEqual(ALL_COLUMNS)
  })
})

describe('gridFor', () => {
  it('builds one track per visible column, in order', () => {
    const g = gridFor(['monday', 'history', 'item', 'due', 'time'])
    expect(g.columns.map(c => c.key)).toEqual(['monday', 'history', 'item', 'due', 'time'])
    expect(g.template.split(' ')).toHaveLength(5)
  })

  it('always includes the required columns, even if asked for none', () => {
    expect(gridFor([]).columns.map(c => c.key)).toEqual(['monday', 'history', 'item', 'due', 'time'])
  })

  // The width the table needs before it scrolls: hiding columns has to lower it,
  // or the chooser would not free any room.
  it('fits a 1440px laptop with every column showing', () => {
    expect(gridFor(ALL_COLUMNS).minWidth).toBeLessThanOrEqual(FITS_LAPTOP)
  })

  it('needs less width with fewer columns', () => {
    expect(gridFor(['monday', 'history', 'item', 'due', 'time']).minWidth).toBeLessThan(gridFor(ALL_COLUMNS).minWidth)
  })
})
