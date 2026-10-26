import { describe, it, expect } from 'vitest'
import {
  allowanceRange, allowanceStatus, limitAheadText, limitCheck, limitName, limitStopPoint, limitStoppedText, limitText, roomLeft, windowName,
} from './allowance'

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

// The allowance as a real limit (owner, 25 October 2026: "coloque um limite de verdade").
describe('the limit', () => {
  const OCT = { period: 'month' as const, from: '2026-10-01' }

  it('the window: a month by name, a week by its first day', () => {
    expect(windowName('month', '2026-10-01')).toBe('October')
    expect(windowName('week', '2026-10-18')).toBe('the week of Oct 18')
    expect(allowanceRange('2026-10-25', 'month')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('used, approved extra and what is left, on the quarter hour', () => {
    const r = limitCheck({ counted: [{ id: 1, seconds: H(100) }, { id: 2, seconds: H(37.75) }], adding: 0, hours: 140, extraHours: 8 })
    expect(r.status).toMatchObject({ used: H(137.75), limit: H(148), left: H(10.25) })
    expect(roomLeft(H(10.25))).toBe(H(10.25))
    // 37.3h is 37h 18m: only 37h 15m fit on the quarter hour.
    expect(roomLeft(H(37.3))).toBe(H(37.25))
    expect(roomLeft(-5)).toBe(0)
  })

  it('refuses time past the limit, allows time up to it', () => {
    const counted = [{ id: 1, seconds: H(138) }]
    expect(limitCheck({ counted, adding: H(2), hours: 140, extraHours: 0 }).refused).toBe(false)
    expect(limitCheck({ counted, adding: H(2.25), hours: 140, extraHours: 0 }).refused).toBe(true)
    // Approved extra hours raise it.
    expect(limitCheck({ counted, adding: H(2.25), hours: 140, extraHours: 8 }).refused).toBe(false)
  })

  it('counts a changed entry once: an edit replaces it, the week grid replaces its cells', () => {
    const counted = [{ id: 1, seconds: H(136) }, { id: 2, seconds: H(3) }]
    // Entry 2 from 3h to 4h: 140h, fits.
    expect(limitCheck({ counted, exclude: [2], adding: H(4), hours: 140, extraHours: 0 }).refused).toBe(false)
    // To 4h 15m: past it, with 4h of room.
    const r = limitCheck({ counted, exclude: [2], adding: H(4.25), hours: 140, extraHours: 0 })
    expect(r.refused).toBe(true)
    expect(r.status.left).toBe(H(4))
  })

  it('time already over before the rule is not refused when a change keeps or lowers it', () => {
    const counted = [{ id: 1, seconds: H(143) }, { id: 2, seconds: H(2) }]
    expect(limitCheck({ counted, exclude: [2], adding: H(1), hours: 140, extraHours: 0 }).refused).toBe(false)
    expect(limitCheck({ counted, exclude: [2], adding: H(2), hours: 140, extraHours: 0 }).refused).toBe(false)
    expect(limitCheck({ counted, exclude: [2], adding: H(2.25), hours: 140, extraHours: 0 }).refused).toBe(true)
  })

  it('a running clock stops where the rest of the window left it room', () => {
    // Clocked in at 9:45 (recorded) with 2h 15m left: it stops at 12:00.
    expect(limitStopPoint('2026-10-15T13:45:00.000Z', H(2.25))).toEqual({ real: '2026-10-15T16:00:00.000Z', recorded: '2026-10-15T16:00:00.000Z' })
    // Room that is not on the quarter hour: the quarter below, so the count never passes the limit.
    expect(limitStopPoint('2026-10-15T13:45:00.000Z', H(2.3)).recorded).toBe('2026-10-15T16:00:00.000Z')
    // No room: it stops where it began, never before the real clock in.
    expect(limitStopPoint('2026-10-15T13:45:00.000Z', 0, '2026-10-15T13:52:00.000Z')).toEqual({ real: '2026-10-15T13:52:00.000Z', recorded: '2026-10-15T13:45:00.000Z' })
  })

  it('says so the same way whoever adds the time', () => {
    expect(limitText({ ...OCT, limit: H(140), extraHours: 0, left: 0 }))
      .toBe('You have used your 140h 00m allowance for October. Ask for extra hours to log more.')
    expect(limitText({ ...OCT, limit: H(140), extraHours: 0, left: H(2.25) }))
      .toBe('That goes past your 140h 00m allowance for October: 2h 15m left. Ask for extra hours to log more.')
    expect(limitText({ ...OCT, limit: H(140), extraHours: 0, left: 0, name: 'Samuel Manzi' }))
      .toBe('Samuel Manzi has used their 140h 00m allowance for October. Ask for extra hours to log more.')
    expect(limitText({ period: 'week', from: '2026-10-18', limit: H(48), extraHours: 8, left: H(1), name: 'Samuel Manzi' }))
      .toBe("That goes past Samuel Manzi's 48h 00m allowance for the week of Oct 18, extra hours included: 1h 00m left. Ask for extra hours to log more.")
    expect(limitName({ ...OCT, limit: H(148), extraHours: 8 })).toBe('148h 00m allowance for October, extra hours included')
    expect(limitStoppedText('4:15 PM', { ...OCT, limit: H(140), extraHours: 0 }))
      .toBe('Your clock stopped at 4:15 PM: you have used your 140h 00m allowance for October. Ask for extra hours to log more.')
    expect(limitAheadText('4:15 PM')).toBe('Your clock stops by itself at 4:15 PM, at your allowance.')
  })
})
