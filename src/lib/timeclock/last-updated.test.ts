import { describe, it, expect } from 'vitest'
import { newestOf, sourceWording } from './last-updated'

const T = {
  old: '2026-09-01T10:00:00.000Z',
  mid: '2026-09-05T10:00:00.000Z',
  new: '2026-09-08T10:00:00.000Z',
}

describe('newestOf', () => {
  // The reason this exists. A sync badge does not move when somebody types a
  // donation, so it reads as "your figure is not in yet" while the figure is
  // sitting on the row above.
  it('lets money entered by hand win over an older import', () => {
    expect(newestOf([
      { at: T.old, source: 'import' },
      { at: T.new, source: 'money' },
    ])).toEqual({ at: T.new, source: 'money' })
  })

  it('lets the import win when it is the newest', () => {
    expect(newestOf([
      { at: T.new, source: 'import' },
      { at: T.mid, source: 'hours' },
      { at: T.old, source: 'money' },
    ])).toEqual({ at: T.new, source: 'import' })
  })

  it('ignores the sources that have nothing', () => {
    expect(newestOf([
      { at: null, source: 'import' },
      { at: undefined, source: 'hours' },
      { at: T.mid, source: 'money' },
    ])).toEqual({ at: T.mid, source: 'money' })
  })

  // A month nobody has touched at all. The badge says so rather than showing a
  // date it invented.
  it('gives nothing back when no source has anything', () => {
    expect(newestOf([
      { at: null, source: 'import' },
      { at: null, source: 'hours' },
      { at: null, source: 'money' },
    ])).toBeNull()
    expect(newestOf([])).toBeNull()
  })

  it('names every source it can return', () => {
    for (const source of ['import', 'hours', 'money'] as const) {
      expect(sourceWording(source).length).toBeGreaterThan(0)
    }
  })
})
