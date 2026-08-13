import { describe, it, expect } from 'vitest'
import { money, moneySigned, fmtHours } from './format'

// These exist because a display bug reached a client's invoice. The report's
// arithmetic was exactly right and the last step threw the cents away, so every
// internal number agreed with every other internal number and only accounting
// noticed.
describe('money', () => {
  it('keeps the cents, which is the whole point', () => {
    expect(money(11251.25)).toBe('$11,251.25')
    expect(money(4156.25)).toBe('$4,156.25')
    expect(money(27977.5)).toBe('$27,977.50')
    expect(money(498.75)).toBe('$498.75')
  })

  it('adds up on screen to what the report computed', () => {
    // July 2026, the month accounting queried. Displaying whole dollars made
    // these four read as $39,728 against a real $39,727.50.
    const parts = [11251.25, 498.75, 27977.5]
    const shown = parts.map(money)
    expect(shown).toEqual(['$11,251.25', '$498.75', '$27,977.50'])
    expect(money(parts.reduce((a, b) => a + b, 0))).toBe('$39,727.50')
  })

  it('rounds half away from zero at the cent, as US accounting does', () => {
    // Accounting's own example: $4.375 becomes $4.38, not $4.37.
    expect(money(4.375)).toBe('$4.38')
    expect(money(4.374)).toBe('$4.37')
  })

  it('shows a whole amount with .00 rather than bare', () => {
    expect(money(55000)).toBe('$55,000.00')
    expect(money(0)).toBe('$0.00')
  })

  it('groups thousands', () => {
    expect(money(1234567.89)).toBe('$1,234,567.89')
  })
})

describe('moneySigned', () => {
  it('marks a negative balance with the minus before the sign', () => {
    expect(moneySigned(-3206.4)).toBe('−$3,206.40')
  })

  it('leaves a positive one unmarked', () => {
    expect(moneySigned(523.05)).toBe('$523.05')
  })

  it('does not render minus zero', () => {
    expect(moneySigned(0)).toBe('$0.00')
  })
})

describe('fmtHours', () => {
  it('leaves hours alone: they were never the problem', () => {
    expect(fmtHours(120)).toBe('120')
    expect(fmtHours(43.75)).toBe('43.75')
    expect(fmtHours(294.5)).toBe('294.5')
    expect(fmtHours(0)).toBe('-')
  })
})
