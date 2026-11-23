import { describe, expect, it } from 'vitest'
import { balanceLeft, balanceLine, balanceNote, hoursText, offRefusal, sickOpensOn, vacationOpensOn, yearLater, type OffStanding } from './time-off-rules'

const H = 3600
const standing = (over: Partial<OffStanding> = {}): OffStanding => ({ employee: true, vacationFrom: null, sickFrom: null, sickUsed: {}, balances: {}, ...over })

describe('when each kind opens', () => {
  it('Vacation opens a year after they became an employee, else after the hire date', () => {
    expect(vacationOpensOn(null, '2026-02-09')).toBe('2027-02-09')
    expect(vacationOpensOn('2026-10-01', '2020-06-01')).toBe('2027-10-01')
    expect(vacationOpensOn(null, null)).toBeNull()
    expect(yearLater('2024-02-29')).toBe('2025-03-01')
  })
  it('sick leave opens on the 91st day', () => {
    expect(sickOpensOn('2026-02-09')).toBe('2026-05-10')
    expect(sickOpensOn(null)).toBeNull()
  })
})

describe('offRefusal', () => {
  it('refuses Vacation in the first year, and lets it through from the day it opens', () => {
    const s = standing({ vacationFrom: '2027-02-09' })
    expect(offRefusal('vacation', ['2026-12-21'], 8, s)).toContain('from Tue, Feb 9, 2027')
    expect(offRefusal('vacation', ['2027-02-09'], 8, s)).toBeNull()
    expect(offRefusal('sick', ['2026-12-21'], 8, s)).toBeNull()
    expect(offRefusal('unpaid', ['2026-12-21'], 8, s)).toBeNull()
  })
  it('refuses sick leave before the 91st day', () => {
    expect(offRefusal('sick', ['2026-03-02'], 8, standing({ sickFrom: '2026-05-10' }))).toContain('91st day')
  })
  it('refuses sick leave past 40 hours in a calendar year, and says what is left', () => {
    const s = standing({ sickUsed: { '2026': 28 * H } })
    expect(offRefusal('sick', ['2026-12-01'], 8, s)).toBeNull()
    expect(offRefusal('sick', ['2026-12-01', '2026-12-02'], 8, s)).toContain('12h can still be asked, and this is 16h')
    expect(offRefusal('sick', ['2026-12-01'], 8, standing({ sickUsed: { '2026': 42.5 * H } }))).toContain('you have 42h 30m taken or asked')
    // Each year has its own 40 hours.
    expect(offRefusal('sick', ['2026-12-31', '2027-01-04'], 8, standing({ sickUsed: { '2026': 32 * H } }))).toBeNull()
  })
  it('leaves everyone who is not a US employee alone', () => {
    expect(offRefusal('vacation', ['2026-12-21'], 8, standing({ employee: false, vacationFrom: '2027-02-09' }))).toBeNull()
  })
})

describe('balanceLeft', () => {
  const req = (over: object) => ({ kind: 'vacation' as const, state: 'approved' as const, days: ['2026-11-25'], hoursPerDay: 8, decidedOn: '2026-11-20', ...over })
  it('takes off the approved days after the report, and days approved after it', () => {
    const b = balanceLeft('vacation', 118.26, '2026-11-20', [
      req({}),                                                              // a later day: off
      req({ days: ['2026-11-18'], decidedOn: '2026-11-17' }),               // before the report: Rippling had it
      req({ days: ['2026-11-19'], decidedOn: '2026-11-23', hoursPerDay: 4 }), // asked after the fact: off
      req({ kind: 'sick' as const }),                                       // another kind
      req({ state: 'pending' as const, days: ['2026-12-01', '2026-12-02'], decidedOn: null }),
    ])
    expect(b.usedSince).toBe(12 * H)
    expect(b.waiting).toBe(16 * H)
    expect(hoursText(b.left)).toBe('106h 16m')
    expect(balanceNote(b)).toBe('Rippling on Nov 20, less 12h approved since')
  })
  it('writes the line for a request', () => {
    const b = balanceLeft('sick', 7.1, '2026-11-20', [])
    expect(balanceLine('Sick', b)).toBe('Sick: 7h 06m left (Rippling on Nov 20).')
    expect(balanceLine('Sick', b, 8 * H)).toContain('This asks 8h, more than is left.')
    expect(balanceLine('Vacation', undefined)).toContain('no balance loaded yet')
    expect(hoursText(-4 * H)).toBe('-4h')
  })
})
