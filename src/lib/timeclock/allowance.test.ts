import { describe, it, expect } from 'vitest'
import {
  allowanceFor, allowanceFromLimit, allowanceRange, allowanceStatus, hoursForPeriod, knownCadence, limitAheadText, limitAsTyped, limitCheck, limitName,
  limitPreview, limitStopPoint, limitStoppedText, limitSummary, limitText, roomLeft, weekdaysBetween, weeklyEquivalent, windowName,
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

// One field (owner, 5 November 2026): a contractor's Hours limit is their allowance (per week or per month since 9 November 2026).
describe('allowanceFromLimit', () => {
  it('a contractor with a number has that limit, per week unless it says month', () => {
    expect(allowanceFromLimit(true, 30)).toEqual({ hours: 30, per: 'week', cadence: [], anchors: [] })
    expect(allowanceFromLimit(true, 37.5, null)?.per).toBe('week')
    expect(allowanceFromLimit(true, 120, 'month')?.per).toBe('month')
  })
  it('a contractor without a number has no limit', () => {
    expect(allowanceFromLimit(true, null)).toBeNull()
    expect(allowanceFromLimit(true, undefined)).toBeNull()
    expect(allowanceFromLimit(true, 0)).toBeNull()
  })
  it('a US employee has none, whatever their number', () => {
    expect(allowanceFromLimit(false, 40)).toBeNull()
    expect(allowanceFromLimit(false, 120, 'month')).toBeNull()
  })
})

// The hours limit covers the pay period (owner, 9 November 2026, mockup "Hours Limit by Pay Period").
describe('allowanceFor: the window and its hours', () => {
  const anchors = [{ anchor: '2026-11-08', effectiveFrom: null }]
  const biweekly = [{ cadence: 'biweekly' as const, effectiveFrom: '2026-01-01' }]
  const monthly = [{ cadence: 'monthly' as const, effectiveFrom: '2026-01-01' }]
  const al = (hours: number, per: 'week' | 'month', cadence: typeof biweekly | typeof monthly | [] = [], a = anchors) => ({ hours, per, cadence, anchors: a })

  it('counts weekdays, Monday to Friday', () => {
    expect(weekdaysBetween('2026-11-01', '2026-11-30')).toBe(21)
    expect(weekdaysBetween('2026-12-01', '2026-12-31')).toBe(23)
    expect(weekdaysBetween('2027-01-01', '2027-01-31')).toBe(21)
  })

  it('knows a cadence only when it was set for the person', () => {
    expect(knownCadence('2026-11-10', [])).toBeNull()
    expect(knownCadence('2026-11-10', biweekly)).toBe('biweekly')
    // Set from a later day: not known yet.
    expect(knownCadence('2026-11-10', [{ cadence: 'monthly', effectiveFrom: '2026-12-01' }])).toBeNull()
  })

  it('every 2 weeks, per week: the pay period, twice the weekly number', () => {
    expect(allowanceFor(al(30, 'week', biweekly), '2026-11-17')).toEqual({ period: 'pay_period', from: '2026-11-08', to: '2026-11-21', hours: 60 })
    // Counting backwards from the start date too.
    expect(allowanceFor(al(30, 'week', biweekly), '2026-11-07')).toEqual({ period: 'pay_period', from: '2026-10-25', to: '2026-11-07', hours: 60 })
  })

  it('every 2 weeks with no pay period start set: the week and the weekly number, as before', () => {
    expect(allowanceFor(al(30, 'week', biweekly, []), '2026-11-17')).toEqual({ period: 'week', from: '2026-11-15', to: '2026-11-21', hours: 30 })
  })

  it('monthly, per week: the month, the weekly number / 5 x its weekdays', () => {
    expect(allowanceFor(al(30, 'week', monthly), '2026-11-17')).toEqual({ period: 'month', from: '2026-11-01', to: '2026-11-30', hours: 126 })
    expect(allowanceFor(al(30, 'week', monthly), '2026-12-03').hours).toBe(138)
  })

  it('monthly, per month: the month, the number every month', () => {
    expect(allowanceFor(al(120, 'month', monthly), '2026-11-17')).toEqual({ period: 'month', from: '2026-11-01', to: '2026-11-30', hours: 120 })
    expect(allowanceFor(al(120, 'month', monthly), '2027-02-10')).toEqual({ period: 'month', from: '2027-02-01', to: '2027-02-28', hours: 120 })
  })

  it('no cadence set: per week is the week (as before), per month the month', () => {
    expect(allowanceFor(al(30, 'week'), '2026-11-17')).toEqual({ period: 'week', from: '2026-11-15', to: '2026-11-21', hours: 30 })
    expect(allowanceFor(al(30, 'week'), '2026-11-17', 1).from).toBe('2026-11-16')
    expect(allowanceFor(al(120, 'month'), '2026-11-17')).toEqual({ period: 'month', from: '2026-11-01', to: '2026-11-30', hours: 120 })
  })

  it('every 2 weeks, per month (Edit work does not offer it): the month, the number', () => {
    expect(allowanceFor(al(120, 'month', biweekly), '2026-11-17')).toEqual({ period: 'month', from: '2026-11-01', to: '2026-11-30', hours: 120 })
  })

  it('a timesheet is over only when it is one of the windows', () => {
    expect(hoursForPeriod(al(30, 'week', monthly), '2026-11-01', '2026-11-30')).toBe(126)
    expect(hoursForPeriod(al(30, 'week', biweekly), '2026-11-08', '2026-11-21')).toBe(60)
    expect(hoursForPeriod(al(30, 'week'), '2026-11-01', '2026-11-30')).toBeNull()
  })

  it('names the windows and writes the limit', () => {
    expect(windowName('pay_period', '2026-11-08', '2026-11-21')).toBe('the pay period Nov 8 to 21')
    expect(windowName('pay_period', '2026-11-22')).toBe('the pay period Nov 22 to Dec 5')
    expect(limitName({ period: 'pay_period', from: '2026-11-08', to: '2026-11-21', limit: H(60), extraHours: 0 })).toBe('60h 00m allowance for the pay period Nov 8 to 21')
    expect(limitAsTyped({ hours: 30, per: 'week' })).toBe('30 h / week')
    expect(limitAsTyped({ hours: 120, per: 'month' })).toBe('120 h / month')
    expect(limitSummary(al(30, 'week'), '2026-11-17')).toBe('30 h / week')
    expect(limitSummary(al(30, 'week', monthly), '2026-11-17')).toBe('30 h / week · 126h 00m in Nov')
    expect(limitSummary(al(30, 'week', biweekly), '2026-11-17')).toBe('30 h / week · 60h 00m a pay period')
    expect(limitSummary(al(120, 'month', monthly), '2026-11-17')).toBe('120 h / month')
  })

  it('the lines under Hours limit in Edit work', () => {
    expect(limitPreview('week', 30, 'biweekly', anchors, '2026-11-17')).toEqual(['Limit each pay period: 60h 00m (2 weeks)'])
    expect(limitPreview('week', 30, 'monthly', anchors, '2026-11-17')).toEqual([
      'November 2026: 21 weekdays → 126h 00m', 'December 2026: 23 weekdays → 138h 00m', 'January 2027: 21 weekdays → 126h 00m',
    ])
    expect(limitPreview('month', 120, 'monthly', anchors, '2026-11-17')).toEqual(['Every month: 120h 00m, however many days it has'])
    expect(limitPreview('week', 30, null, anchors, '2026-11-17')).toEqual(['Limit each week: 30h 00m'])
    expect(limitPreview('week', null, 'monthly', anchors, '2026-11-17')).toEqual([])
  })

  it('a number per month reads as its weekly equivalent elsewhere', () => {
    expect(weeklyEquivalent(30, 'week')).toBe(30)
    expect(weeklyEquivalent(130, 'month')).toBe(30)
    expect(weeklyEquivalent(null, 'month')).toBeNull()
  })
})
