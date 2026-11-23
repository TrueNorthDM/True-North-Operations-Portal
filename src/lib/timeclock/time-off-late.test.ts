import { describe, expect, it } from 'vitest'
import { askedLate, earliestLateDay, lateKind, ordinal } from './time-off-late'

describe('time off asked after the fact (owner, 23 November 2026)', () => {
  it('is for Sick and Unpaid only', () => {
    expect(lateKind({ name: 'Sick', kind: 'pto' })).toBe(true)
    expect(lateKind({ name: 'Unpaid Time Off', kind: 'unpaid' })).toBe(true)
    expect(lateKind({ name: 'Vacation', kind: 'pto' })).toBe(false)
    expect(lateKind({ name: 'Holiday', kind: 'pto' })).toBe(false)
    expect(lateKind(null)).toBe(false)
  })
  it('goes back to the first day whose timesheet is not sent, never before North Time', () => {
    // Started Nov 8, nothing sent yet: back to Nov 8.
    expect(earliestLateDay('2026-11-08', [], '2026-11-23')).toBe('2026-11-08')
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
