import { describe, it, expect } from 'vitest'
import { checksOf, countText, holidaysBetween, offDays, pillOf, stepsOf, type OffRequest } from './time-off'

const req = (o: Partial<OffRequest> = {}): OffRequest => ({
  id: 1, personId: 'p', who: 'Tina Gennette', type: 'Vacation', start: '2026-11-23', end: '2026-11-25', hoursPerDay: 8, state: 'pending',
  note: null, askedAt: '2026-11-02T21:40:00Z', decidedAt: null, decidedBy: null, decisionNote: null, rippling: null, ripplingError: null,
  ripplingSentAt: null, calendar: null, entriesWrittenAt: null, cancelAskedAt: null, cancelReason: null, ...o,
})

describe('time off (Requests.dc.html 7A to 7E)', () => {
  it('counts weekdays and leaves the company holidays out', () => {
    const h = holidaysBetween('2026-11-23', '2026-11-27')
    expect(h.get('2026-11-26')).toBe('Thanksgiving Day')
    expect(offDays('2026-11-23', '2026-11-27', h)).toEqual({ days: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27'], skipped: ['2026-11-26'] })
    expect(offDays('2026-11-28', '2026-11-29', h).days).toEqual([])
    expect(countText(3, 24 * 3600)).toBe('3 working days, 24h 00m')
    expect(countText(1, 8 * 3600)).toBe('1 working day, 8h 00m')
  })

  it('waits for a Super Admin, then shows what went out by itself', () => {
    expect(checksOf(req())).toEqual([{ t: 'A Super Admin decides', tone: 'neu', icon: 'clock' }])
    expect(pillOf(req())).toEqual({ label: 'Waiting', tone: 'warn' })
    const sent = req({ state: 'approved', rippling: 'sent', calendar: 'done', entriesWrittenAt: '2026-11-03T14:00:00Z', ripplingSentAt: '2026-11-03T14:00:00Z' })
    expect(checksOf(sent).map(c => c.t)).toEqual(['Sent to Rippling', 'On the team calendar'])
    const steps = stepsOf(sent, { days: 3, seconds: 24 * 3600, stamp: () => 'Nov 3, 2026, 9:00 AM', canRetry: true })
    expect(steps.map(s => s.t)).toEqual(['Sent to Rippling, Nov 3, 2026, 9:00 AM', 'On the team calendar', 'Written into the time entries'])
    expect(steps[2].sub).toBe('3 days of Vacation, 8h 00m each.')
  })

  it('says so when Rippling refused it, with Try again for a Super Admin only', () => {
    const r = req({ state: 'approved', rippling: 'refused', ripplingError: 'Sick balance is 0h.', calendar: 'done', entriesWrittenAt: '2026-11-03T14:00:00Z' })
    const s = stepsOf(r, { days: 1, seconds: 8 * 3600, stamp: () => '', canRetry: true })[0]
    expect(s).toMatchObject({ t: 'Rippling refused it: "Sick balance is 0h."', state: 'bad', retry: true })
    expect(s.sub).toBe('Fix the balance in Rippling, then try again. Payroll does not have this day yet.')
    expect(stepsOf(r, { days: 1, seconds: 8 * 3600, stamp: () => '', canRetry: false })[0].retry).toBe(false)
    expect(checksOf(r)[0]).toEqual({ t: 'Rippling refused it', tone: 'bad', icon: 'x' })
  })

  it('waits for the connections when Rippling and Google are not connected', () => {
    const r = req({ state: 'approved', rippling: 'waiting_connection', calendar: 'waiting_connection', entriesWrittenAt: '2026-11-03T14:00:00Z' })
    expect(checksOf(r).map(c => c.t)).toEqual(['Waiting for Rippling', 'Waiting for the calendar'])
    expect(stepsOf(r, { days: 3, seconds: 24 * 3600, stamp: () => '', canRetry: true }).map(s => s.state)).toEqual(['wait', 'wait', 'ok'])
  })

  it('a cancellation asked shows as waiting again', () => {
    const r = req({ state: 'approved', rippling: 'sent', calendar: 'done', cancelAskedAt: '2026-11-03T14:32:00Z' })
    expect(pillOf(r)).toEqual({ label: 'Cancellation asked', tone: 'warn' })
    expect(checksOf(r)).toEqual([{ t: 'Waiting for a Super Admin', tone: 'neu', icon: 'clock' }])
  })
})
