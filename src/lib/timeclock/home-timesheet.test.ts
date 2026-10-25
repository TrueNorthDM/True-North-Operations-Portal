import { describe, expect, it } from 'vitest'
import { dueTimesheet } from './home-timesheet'

const oct = { start: '2026-10-01', end: '2026-10-31' }
const sep = { start: '2026-09-01', end: '2026-09-30' }
const yes = () => true

describe('the Home card for a timesheet to send', () => {
  it('shows on the day the period closes', () => {
    expect(dueTimesheet('2026-10-31', oct, sep, [{ ...sep, state: 'approved' }], yes)).toEqual({ state: 'today', period: oct, days: 0 })
  })
  it('stays after, as late, until it is sent', () => {
    expect(dueTimesheet('2026-11-03', { start: '2026-11-01', end: '2026-11-30' }, oct, [], yes)).toEqual({ state: 'late', period: oct, days: 3 })
    expect(dueTimesheet('2026-11-03', { start: '2026-11-01', end: '2026-11-30' }, oct, [{ ...oct, state: 'submitted' }], yes)).toBeNull()
  })
  it('stays away from a period with nothing logged in the portal, and mid-period', () => {
    expect(dueTimesheet('2026-10-15', oct, sep, [{ ...sep, state: 'approved' }], yes)).toBeNull()
    expect(dueTimesheet('2026-11-03', { start: '2026-11-01', end: '2026-11-30' }, oct, [], () => false)).toBeNull()
  })
  it('counts a returned timesheet as not sent', () => {
    expect(dueTimesheet('2026-11-02', { start: '2026-11-01', end: '2026-11-30' }, oct, [{ ...oct, state: 'returned' }], yes)?.state).toBe('late')
  })
})
