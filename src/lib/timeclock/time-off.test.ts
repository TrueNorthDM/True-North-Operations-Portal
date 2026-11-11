import { describe, it, expect } from 'vitest'
import { cancelAskedText, checksOf, countText, historyOf, holidaysBetween, offDays, pillOf, readsOffReason, stepsOf, type OffRequest } from './time-off'

const req = (o: Partial<OffRequest> = {}): OffRequest => ({
  id: 1, personId: 'p', who: 'Tina Gennette', type: 'Vacation', start: '2026-11-23', end: '2026-11-25', hoursPerDay: 8, state: 'pending',
  note: null, askedAt: '2026-11-02T21:40:00Z', decidedAt: null, decidedBy: null, decisionNote: null,
  calendar: null, entriesWrittenAt: null, cancelAskedAt: null, cancelReason: null, ...o,
})

describe('time off (Requests.dc.html 7A to 7E)', () => {
  it('counts weekdays and leaves the company holidays out', () => {
    const h = holidaysBetween('2026-11-23', '2026-11-27')
    expect(h.get('2026-11-26')).toBe('Thanksgiving Day')
    expect(h.get('2026-11-27')).toBe('Day after Thanksgiving')
    expect(offDays('2026-11-23', '2026-11-27', h)).toEqual({ days: ['2026-11-23', '2026-11-24', '2026-11-25'], skipped: ['2026-11-26', '2026-11-27'] })
    expect(offDays('2026-11-28', '2026-11-29', h).days).toEqual([])
    expect(countText(3, 24 * 3600)).toBe('3 working days, 24h 00m')
    expect(countText(1, 8 * 3600)).toBe('1 working day, 8h 00m')
  })

  it('waits for whoever decides it, then shows what went out by itself', () => {
    expect(checksOf(req(), 'David Sharpe')).toEqual([{ t: 'David Sharpe decides', tone: 'warn', icon: 'clock' }])
    expect(checksOf(req())).toEqual([{ t: 'Waiting for a decision', tone: 'warn', icon: 'clock' }])
    expect(checksOf(req({ state: 'approved', cancelAskedAt: '2026-11-02T14:00:00Z' }), 'Arnaldo Oliveira')).toEqual([{ t: 'Waiting for Arnaldo Oliveira', tone: 'warn', icon: 'clock' }])
    expect(stepsOf(req(), { days: 1, seconds: 8 * 3600, stamp: () => '', who: 'David Sharpe' })[0].sub).toBe('When David Sharpe approves: the team calendar and the time entries, by themselves. Finance takes it to payroll.')
    expect(pillOf(req())).toEqual({ label: 'Waiting', tone: 'warn' })
    const done = req({ state: 'approved', calendar: 'done', entriesWrittenAt: '2026-11-03T14:00:00Z' })
    expect(checksOf(done).map(c => c.t)).toEqual(['On the team calendar'])
    const steps = stepsOf(done, { days: 3, seconds: 24 * 3600, stamp: () => 'Nov 3, 2026, 9:00 AM' })
    expect(steps.map(s => s.t)).toEqual(['On the team calendar', 'Written into the time entries'])
    expect(steps[1].sub).toBe('3 days of Vacation, 8h 00m each.')
  })

  it('never names Rippling as something the portal sends to (owner, 11 November 2026)', () => {
    const r = req({ state: 'approved', calendar: 'done', entriesWrittenAt: '2026-11-03T14:00:00Z' })
    const all = [...checksOf(r).map(c => c.t), ...stepsOf(r, { days: 1, seconds: 8 * 3600, stamp: () => '' }).flatMap(s => [s.t, s.sub])].join(' ')
    expect(all).not.toMatch(/Rippling/)
  })

  it('waits for the calendar when Google is not connected', () => {
    const r = req({ state: 'approved', calendar: 'waiting_connection', entriesWrittenAt: '2026-11-03T14:00:00Z' })
    expect(checksOf(r).map(c => c.t)).toEqual(['Waiting for the calendar'])
    expect(stepsOf(r, { days: 3, seconds: 24 * 3600, stamp: () => '' }).map(s => s.state)).toEqual(['wait', 'ok'])
  })

  it('a cancellation asked shows as waiting again', () => {
    const r = req({ state: 'approved', calendar: 'done', cancelAskedAt: '2026-11-03T14:32:00Z' })
    expect(pillOf(r)).toEqual({ label: 'Cancellation asked', tone: 'warn' })
    expect(checksOf(r, 'Arnaldo Oliveira')).toEqual([{ t: 'Waiting for Arnaldo Oliveira', tone: 'warn', icon: 'clock' }])
  })
})

describe('why cancel: the person and Super Admins only (owner, 5 November 2026)', () => {
  it('is read by the person and Super Admins, never an Admin, Team Leader or other decider', () => {
    expect(readsOffReason({ personId: 'p', isSuperAdmin: false }, 'p')).toBe(true)
    expect(readsOffReason({ personId: 'arnaldo', isSuperAdmin: true }, 'p')).toBe(true)
    expect(readsOffReason({ personId: 'dave', isSuperAdmin: false }, 'p')).toBe(false)
    expect(readsOffReason({ personId: null, isSuperAdmin: false }, 'p')).toBe(false)
  })
  it('stays out of the bell and the email to whoever decides', () => {
    expect(cancelAskedText('Tina Gennette', 'Vacation', '2026-12-28', '2026-12-31')).toBe('Tina Gennette asked to cancel approved time off: Vacation, Mon, Dec 28 to Thu, Dec 31. Decide it in Approvals.')
  })
  it('the history shows it only when it was read', () => {
    const stamp = () => 'Nov 3'
    const nameOf = () => 'Arnaldo Oliveira'
    const r = req({ state: 'approved', decidedAt: '2026-11-02T22:00:00Z', cancelAskedAt: '2026-11-03T14:32:00Z' })
    expect(historyOf({ ...r, cancelReason: 'Plans changed.' }, { stamp, nameOf })[0].t).toBe('Cancellation asked by Tina Gennette: "Plans changed."')
    expect(historyOf({ ...r, cancelReason: null }, { stamp, nameOf })[0].t).toBe('Cancellation asked by Tina Gennette')
  })
})
