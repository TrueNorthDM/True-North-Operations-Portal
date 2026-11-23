import { describe, expect, it } from 'vitest'
import { askedLate, DAY_HOURS_CHOICES, dayHoursLabel, earliestLateDay, lateKind, ordinal, validDayHours } from './time-off-late'

describe('hours a day', () => {
  it('go by the quarter hour, from 15 minutes to 8 hours', () => {
    expect([0.25, 1.75, 2.75, 8].every(validDayHours)).toBe(true)
    expect([0, 0.1, 1.3, 8.25, NaN].some(validDayHours)).toBe(false)
    expect(DAY_HOURS_CHOICES.length).toBe(32)
    expect(DAY_HOURS_CHOICES.every(validDayHours)).toBe(true)
    expect([0.25, 1.75, 2, 8].map(dayHoursLabel)).toEqual(['15m', '1h 45m', '2h', '8h'])
  })
})

describe('time off asked after the fact (owner, 23 November 2026)', () => {
  it('is for Vacation, Sick and Unpaid', () => {
    expect(lateKind({ name: 'Sick', kind: 'pto' })).toBe(true)
    expect(lateKind({ name: 'Unpaid Time Off', kind: 'unpaid' })).toBe(true)
    expect(lateKind({ name: 'Vacation', kind: 'pto' })).toBe(true)
    expect(lateKind({ name: 'Holiday', kind: 'pto' })).toBe(false)
    expect(lateKind(null)).toBe(false)
  })
  it('goes back to the first day whose timesheet is not sent, never before North Time', () => {
    // Started Nov 8, nothing sent yet, past their first pay period: back to Nov 8.
    expect(earliestLateDay('2026-11-08', [], '2026-11-23')).toBe('2026-11-08')
    // In their first pay period (started Nov 22): the pay period before is open too (Lana, Nov 20).
    expect(earliestLateDay('2026-11-22', [], '2026-11-23')).toBe('2026-11-08')
    expect(earliestLateDay('2026-11-22', [], '2026-12-05')).toBe('2026-11-08')
    expect(earliestLateDay('2026-11-22', [], '2026-12-06')).toBe('2026-11-22')
    // The Nov 8 to 21 timesheet is sent: only from Nov 22.
    expect(earliestLateDay('2026-11-08', [{ start: '2026-11-08', end: '2026-11-21', state: 'submitted' }], '2026-11-23')).toBe('2026-11-22')
    // A draft or a returned timesheet closes nothing.
    expect(earliestLateDay('2026-11-08', [{ start: '2026-11-08', end: '2026-11-21', state: 'returned' }], '2026-11-23')).toBe('2026-11-08')
    // Everything up to yesterday is sent, or they have not started: nothing to ask back.
    expect(earliestLateDay('2026-11-08', [{ start: '2026-11-08', end: '2026-11-22', state: 'approved' }], '2026-11-23')).toBeNull()
    expect(earliestLateDay(null, [], '2026-11-23')).toBeNull()
    expect(earliestLateDay('2026-11-23', [], '2026-11-23')).toBeNull()
  })
  it('knows a request asked after its first day, and counts them', () => {
    expect(askedLate('2026-11-20', '2026-11-10')).toBe(true)
    expect(askedLate('2026-11-10', '2026-11-10')).toBe(false)
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  })
})
