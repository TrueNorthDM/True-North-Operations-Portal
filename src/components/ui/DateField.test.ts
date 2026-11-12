import { describe, expect, it } from 'vitest'
import { dateLabel, monthGrid, monthLabel, spanOpen, yearBlock } from './DateField'

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
  it('shows twelve years at a time, the same block for each of them', () => {
    expect(yearBlock(2026)).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027])
    expect(yearBlock(2016)[0]).toBe(2016)
    expect(yearBlock(1990)[0]).toBe(1980)
    expect(yearBlock(1990)).toContain(1990)
  })
  it('opens a month or year when any of its days is inside min and max', () => {
    expect(spanOpen('2026-11-01', '2026-11-30', '2026-11-20')).toBe(true)
    expect(spanOpen('2026-10-01', '2026-10-31', '2026-11-20')).toBe(false)
    expect(spanOpen('2027-01-01', '2027-12-31', undefined, '2026-12-31')).toBe(false)
    expect(spanOpen('1990-01-01', '1990-12-31')).toBe(true)
  })
})

describe('the month field', () => {
  it('names the month', () => {
    expect(monthLabel('2026-11')).toBe('Nov 2026')
  })
})
