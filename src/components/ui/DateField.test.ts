import { describe, expect, it } from 'vitest'
import { dateLabel, monthGrid } from './DateField'

describe('the date field', () => {
  it('writes the day out', () => {
    expect(dateLabel('2026-11-08')).toBe('Sun, Nov 8, 2026')
  })
  it('draws whole weeks, Sunday first', () => {
    const g = monthGrid('2026-11-20')
    expect(g[0]).toBe('2026-11-01')
    expect(g.length % 7).toBe(0)
    expect(g.at(-1)).toBe('2026-12-05')
    expect(monthGrid('2026-12-01')[0]).toBe('2026-11-29')
  })
})
