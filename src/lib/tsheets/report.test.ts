import { describe, it, expect } from 'vitest'

import { monthBounds, monthsBetween, firstOfNextMonth } from './report'

describe('monthBounds', () => {
  it('gives the first and last day of a 31-day month', () => {
    expect(monthBounds('2026-08')).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31' })
  })

  it('gives 30 for a 30-day month', () => {
    expect(monthBounds('2026-06')).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' })
  })

  it('gets February right in a common year', () => {
    expect(monthBounds('2026-02').endDate).toBe('2026-02-28')
  })

  it('gets February right in a leap year', () => {
    expect(monthBounds('2028-02').endDate).toBe('2028-02-29')
  })
})

describe('monthsBetween', () => {
  it('lists the months before the target, in order', () => {
    expect(monthsBetween('2026-01', '2026-04')).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('excludes the target month', () => {
    expect(monthsBetween('2026-01', '2026-02')).toEqual(['2026-01'])
  })

  it('is empty when the target is the start', () => {
    // The very first month of all: nothing came before it, so no special case
    // is needed at the call site to give it an opening balance of zero.
    expect(monthsBetween('2026-01', '2026-01')).toEqual([])
  })

  it('is empty when the target is before the start', () => {
    expect(monthsBetween('2026-06', '2026-01')).toEqual([])
  })

  it('crosses the year boundary, which is the whole point', () => {
    // The carryover used to restart every January because it only ever looped
    // over one calendar year (audit finding M3-3).
    expect(monthsBetween('2026-11', '2027-03')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('crosses several years', () => {
    const months = monthsBetween('2026-01', '2028-01')
    expect(months).toHaveLength(24)
    expect(months[0]).toBe('2026-01')
    expect(months[23]).toBe('2027-12')
  })

  it('pads single-digit months so the strings still sort', () => {
    expect(monthsBetween('2026-08', '2026-11')).toEqual(['2026-08', '2026-09', '2026-10'])
  })
})

describe('firstOfNextMonth', () => {
  it('moves to the first of the following month', () => {
    expect(firstOfNextMonth('2026-08-04')).toBe('2026-09-01')
  })

  it('works from the first of a month', () => {
    expect(firstOfNextMonth('2026-08-01')).toBe('2026-09-01')
  })

  it('works from the last day of a month', () => {
    expect(firstOfNextMonth('2026-08-31')).toBe('2026-09-01')
  })

  it('rolls December into the next January', () => {
    expect(firstOfNextMonth('2026-12-15')).toBe('2027-01-01')
  })

  it('pads the month so the string still sorts', () => {
    // rateFor compares these as strings; an unpadded "2026-9-01" would sort
    // after "2026-10-01" and silently pick the wrong rate.
    expect(firstOfNextMonth('2026-08-04')).toBe('2026-09-01')
    expect(firstOfNextMonth('2026-01-31')).toBe('2026-02-01')
  })

  it('does not care that February is short', () => {
    expect(firstOfNextMonth('2026-02-28')).toBe('2026-03-01')
  })
})
