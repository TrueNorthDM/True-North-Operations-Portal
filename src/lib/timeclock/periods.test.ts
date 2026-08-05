import { describe, it, expect } from 'vitest'
import { periodFor, shiftMonth, monthName, whatCanIDo } from './periods'

describe('periodFor', () => {
  it('gives the month a date falls in, with both ends', () => {
    expect(periodFor('2026-08-05')).toEqual({ month: '2026-08', start: '2026-08-01', end: '2026-08-31' })
  })

  it('knows the short months', () => {
    expect(periodFor('2026-04-30').end).toBe('2026-04-30')
    expect(periodFor('2026-02-10').end).toBe('2026-02-28')
  })

  it('knows a leap February', () => {
    expect(periodFor('2024-02-01').end).toBe('2024-02-29')
  })

  it('handles the last day of December without rolling the year', () => {
    expect(periodFor('2025-12-31')).toEqual({ month: '2025-12', start: '2025-12-01', end: '2025-12-31' })
  })
})

describe('shiftMonth', () => {
  it('steps back and forward', () => {
    expect(shiftMonth('2026-08', -1)).toBe('2026-07')
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
  })

  it('crosses the year in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('does not drift when stepping from a long month to a short one', () => {
    // The classic date bug: adding a month to the 31st lands in the month after
    // next. Building from the first of the month is what avoids it.
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
    expect(shiftMonth('2026-03', -1)).toBe('2026-02')
  })

  it('walks a whole year without losing a month', () => {
    let m = '2026-01'
    const seen = [m]
    for (let i = 0; i < 11; i++) { m = shiftMonth(m, 1); seen.push(m) }
    expect(seen).toHaveLength(12)
    expect(new Set(seen).size).toBe(12)
    expect(seen[11]).toBe('2026-12')
  })
})

describe('monthName', () => {
  it('reads as a person would say it', () => {
    expect(monthName('2026-08')).toBe('August 2026')
    expect(monthName('2026-01')).toBe('January 2026')
  })
})

describe('whatCanIDo', () => {
  it('lets an untouched month be edited and sent', () => {
    const r = whatCanIDo(null)
    expect(r.canEdit).toBe(true)
    expect(r.canSubmit).toBe(true)
  })

  it('freezes a month that is waiting on somebody', () => {
    const r = whatCanIDo('submitted')
    expect(r.canEdit).toBe(false)
    expect(r.canSubmit).toBe(false)
  })

  it('freezes an approved month hardest of all', () => {
    const r = whatCanIDo('approved')
    expect(r.canEdit).toBe(false)
    expect(r.canSubmit).toBe(false)
  })

  it('reopens a month that was handed back, and lets it be sent again', () => {
    const r = whatCanIDo('returned')
    expect(r.canEdit).toBe(true)
    expect(r.canSubmit).toBe(true)
  })

  it('never lets a month be submitted while it cannot be edited', () => {
    // Not a coincidence worth relying on by accident: if a state is ever added
    // that allows sending what cannot be changed, this is where it shows up.
    for (const s of [null, 'draft', 'submitted', 'approved', 'returned'] as const) {
      const r = whatCanIDo(s)
      if (r.canSubmit) expect(r.canEdit).toBe(true)
    }
  })
})
