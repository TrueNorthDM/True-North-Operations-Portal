import { describe, expect, it } from 'vitest'
import { budgetFigures, budgetPace, hoursText, todayET, workingDays } from './i7-view'

// The i7 budget against its pace (owner, 11 November 2026): working days, the month's money available, 10% either way.
const C = { monthUsed: 17263.75, totalAvailable: 84224.29 }

describe('the i7 budget pace', () => {
  it('counts working days: weekdays that are not company holidays', () => {
    const nov = workingDays('2026-11')
    expect(nov).toHaveLength(19)
    expect(nov).not.toContain('2026-11-26')
    expect(nov).not.toContain('2026-11-27')
    expect(nov).toContain('2026-11-11')
  })
  it('reads Nov 11, 2026 as the owner\'s example: 8 of 19 days, behind pace', () => {
    const p = budgetPace(C, '2026-11', '2026-11-11')
    expect([p.gone, p.days]).toEqual([8, 19])
    expect(Math.round(p.expected * 100) / 100).toBe(35462.86)
    expect(Math.round(p.diff * 100) / 100).toBe(-18199.11)
    expect(p.status).toBe('behind')
    expect(Math.round(p.perDayToCatchUp)).toBe(1654)
  })
  it('is on pace within 10% either way, ahead past it', () => {
    const at = (used: number) => budgetPace({ ...C, monthUsed: used }, '2026-11', '2026-11-11').status
    expect(at(35462.86 * 0.91)).toBe('onpace')
    expect(at(35462.86 * 1.09)).toBe('onpace')
    expect(at(35462.86 * 0.89)).toBe('behind')
    expect(at(35462.86 * 1.11)).toBe('ahead')
  })
  it('says Over budget past the money available, and No budget without any', () => {
    expect(budgetPace({ ...C, monthUsed: 90000 }, '2026-11', '2026-11-11').status).toBe('bad')
    expect(budgetPace({ monthUsed: 10, totalAvailable: 0 }, '2026-11', '2026-11-11').status).toBe('none')
  })
  it('a past month has its whole budget as the pace; before the first working day nothing is expected', () => {
    expect(budgetPace(C, '2026-10', '2026-11-11').share).toBe(1)
    expect(budgetPace({ ...C, monthUsed: 0 }, '2026-11', '2026-11-01')).toMatchObject({ gone: 0, status: 'onpace' })
  })
  it('takes today in Washington DC', () => {
    expect(todayET(new Date('2026-11-12T03:00:00Z'))).toBe('2026-11-11')
  })
})

describe('the i7 budget in hours (owner, 11 November 2026)', () => {
  const c = { opening: 29224.29, monthBudget: 55000, monthUsed: 17263.75, totalAvailable: 84224.29, totalLeft: 66960.54, openingFrom: '2026-01', openingComplete: true, monthHours: 181.75, rate: 95 }
  it('reads the money available at the i7 rate against the hours worked', () => {
    const f = budgetFigures(c, '2026-11', 'hours', '2026-11-11')
    expect(f.unit).toBe('hours')
    expect(hoursText(f.total)).toBe('886.6h')
    expect(hoursText(f.left)).toBe('704.8h')
    expect(hoursText(f.pace.expected)).toBe('373.3h')
    expect(f.pace.status).toBe('behind')
  })
  it('falls back to dollars when the month has no i7 rate or no hours', () => {
    expect(budgetFigures({ ...c, rate: 0 }, '2026-11', 'hours', '2026-11-11').unit).toBe('dollars')
    expect(budgetFigures({ ...c, monthHours: undefined }, '2026-11', 'hours', '2026-11-11').unit).toBe('dollars')
    expect(budgetFigures(c, '2026-11', 'dollars', '2026-11-11')).toMatchObject({ unit: 'dollars', total: 84224.29, left: 66960.54 })
  })
})
