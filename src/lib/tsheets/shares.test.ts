import { describe, it, expect } from 'vitest'
import { shares } from './shares'

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

// A list of percentages that does not add to 100 is a question a client asks
// (audit, 13 October 2026).
describe('shares', () => {
  it('adds three equal parts up to 100, not 99', () => {
    const out = shares([1, 1, 1])
    expect(sum(out)).toBe(100)
    expect(out).toEqual([34, 33, 33])
  })

  it('adds four parts of 12.5% and one of 50% up to 100, not 102', () => {
    const out = shares([12.5, 12.5, 12.5, 12.5, 50])
    expect(sum(out)).toBe(100)
    expect(out[4]).toBe(50)
  })

  it('gives the missing units to the parts that lost the most in rounding', () => {
    // 41.6, 33.4, 25.0: rounding down loses 0.6, 0.4 and 0. One unit is missing.
    expect(shares([416, 334, 250])).toEqual([42, 33, 25])
  })

  it('moves no part more than one unit from its own rounding', () => {
    const values = [7, 13, 29, 31, 3, 17]
    const t = sum(values)
    const out = shares(values)
    expect(sum(out)).toBe(100)
    values.forEach((v, i) => expect(Math.abs(out[i] - (v / t) * 100)).toBeLessThan(1))
  })

  it('works at the displayed precision', () => {
    const out = shares([1, 1, 1], { decimals: 1 })
    expect(out).toEqual([33.4, 33.3, 33.3])
    expect(Math.round(sum(out) * 10)).toBe(1000)
  })

  it('adds a sub-list up to its parent share instead of 100', () => {
    expect(sum(shares([2, 1, 1], { total: 61 }))).toBe(61)
    expect(shares([2, 1, 1], { total: 61 })).toEqual([31, 15, 15])
  })

  it('keeps the order it was given', () => {
    expect(shares([10, 30, 60])).toEqual([10, 30, 60])
    expect(shares([60, 30, 10])).toEqual([60, 30, 10])
  })

  it('gives zero to a part of nothing, and to everything when there is no whole', () => {
    expect(shares([0, 5, 5])).toEqual([0, 50, 50])
    expect(shares([0, 0])).toEqual([0, 0])
    expect(shares([])).toEqual([])
    expect(shares([-3, 3])).toEqual([0, 100])
  })

  it('does not lose a unit to floating point', () => {
    // 0.29 / 1 * 100 is 28.999999999999996 in floating point.
    expect(shares([0.29, 0.71])).toEqual([29, 71])
  })

  it('is the same every time for the same figures, ties included', () => {
    expect(shares([1, 1, 1, 1, 1, 1, 1])).toEqual(shares([1, 1, 1, 1, 1, 1, 1]))
    expect(sum(shares([1, 1, 1, 1, 1, 1, 1]))).toBe(100)
  })
})
