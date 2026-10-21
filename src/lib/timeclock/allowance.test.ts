import { describe, it, expect } from 'vitest'
import { allowanceRange, allowanceStatus } from './allowance'

const H = (h: number) => h * 3600

describe('allowanceStatus', () => {
  it('ok under 90%, near from 90%, over past the limit (10B)', () => {
    expect(allowanceStatus(H(100), 140).state).toBe('ok')
    // "This month 128h of 140h": 91%, near.
    expect(allowanceStatus(H(128), 140)).toMatchObject({ state: 'near', left: H(12) })
    expect(allowanceStatus(H(140), 140).state).toBe('near')
    expect(allowanceStatus(H(143), 140)).toMatchObject({ state: 'over', over: H(3), left: 0 })
  })

  it('approved extra hours raise the limit (Cheyenne: 151h 15m, 140h + 8h approved, 3h 15m over)', () => {
    const s = allowanceStatus(H(151.25), 140, 8)
    expect(s.limit).toBe(H(148))
    expect(s.over).toBe(H(3.25))
  })
})

describe('allowanceRange', () => {
  it('a month runs from the 1st to its last day', () => {
    expect(allowanceRange('2026-11-17', 'month')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(allowanceRange('2028-02-10', 'month')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('a week starts on the company week start (Sunday by default)', () => {
    // Thu, Oct 15, 2026.
    expect(allowanceRange('2026-10-15', 'week')).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(allowanceRange('2026-10-15', 'week', 1)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(allowanceRange('2026-10-11', 'week')).toEqual({ from: '2026-10-11', to: '2026-10-17' })
  })
})
