import { describe, expect, it } from 'vitest'
import { cleanRepeat, describe as say, endBefore, fromRRule, instanceId, lastDay, occurrences, restFrom, toRRule, type Repeat } from './recurrence'

const weekly = (days: number[], extra: Partial<Repeat> = {}): Repeat => ({ freq: 'weekly', interval: 1, days, monthBy: 'day', ends: 'never', ...extra })

describe('the days a series happens on', () => {
  it('every Tuesday and Thursday, from a Tuesday', () => {
    expect(occurrences(weekly([2, 4]), '2026-11-03', '2026-11-01', '2026-11-14')).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12'])
  })
  it('every 2 weeks, ending on a day', () => {
    expect(occurrences(weekly([2], { interval: 2, ends: 'until', until: '2026-12-01' }), '2026-11-03', '2026-11-01', '2026-12-31')).toEqual(['2026-11-03', '2026-11-17', '2026-12-01'])
  })
  it('a count includes the days before the range asked for', () => {
    const r: Repeat = { freq: 'daily', interval: 1, days: [], monthBy: 'day', ends: 'count', count: 5 }
    expect(occurrences(r, '2026-11-01', '2026-11-04', '2026-11-30')).toEqual(['2026-11-04', '2026-11-05'])
  })
  it('monthly on the 31st skips the shorter months, as Google does', () => {
    const r: Repeat = { freq: 'monthly', interval: 1, days: [], monthBy: 'day', ends: 'never' }
    expect(occurrences(r, '2026-10-31', '2026-10-01', '2027-01-31')).toEqual(['2026-10-31', '2026-12-31', '2027-01-31'])
  })
  it('monthly on the second Tuesday, and on the last Friday', () => {
    const second: Repeat = { freq: 'monthly', interval: 1, days: [], monthBy: 'nth', ends: 'never' }
    expect(occurrences(second, '2026-11-10', '2026-11-01', '2027-01-31')).toEqual(['2026-11-10', '2026-12-08', '2027-01-12'])
    expect(occurrences(second, '2026-10-30', '2026-10-01', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25'])
  })
  it('yearly, and days taken out of the series', () => {
    const r: Repeat = { freq: 'yearly', interval: 1, days: [], monthBy: 'day', ends: 'never' }
    expect(occurrences(r, '2026-11-03', '2026-01-01', '2028-12-31', new Set(['2027-11-03']))).toEqual(['2026-11-03', '2028-11-03'])
  })
})

describe("Google's words for a rule", () => {
  it('goes there and back', () => {
    const r = weekly([1, 4], { interval: 2, ends: 'until', until: '2026-12-15' })
    const line = toRRule(r, '2026-11-02', false)
    expect(line).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;WKST=SU;UNTIL=20261215T235959Z')
    expect(fromRRule(line)).toEqual(r)
  })
  it('monthly by weekday, all day with a count', () => {
    const r: Repeat = { freq: 'monthly', interval: 1, days: [], monthBy: 'nth', ends: 'count', count: 6 }
    expect(toRRule(r, '2026-11-10', true)).toBe('RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=6')
    expect(toRRule({ ...r, ends: 'until', until: '2027-03-01', count: undefined }, '2026-10-30', true)).toBe('RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20270301')
  })
  it('refuses a rule the portal cannot draw', () => {
    expect(fromRRule('RRULE:FREQ=HOURLY')).toBeNull()
    expect(fromRRule('RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1')).toBeNull()
    expect(fromRRule('EXDATE:20261103')).toBeNull()
  })
})

describe('the sentence on the card', () => {
  it('names the days and the end', () => {
    expect(say(weekly([2], { ends: 'until', until: '2026-12-15' }), '2026-11-03')).toBe('Every Tuesday, until Dec 15')
    expect(say(weekly([1, 2, 3, 4, 5]), '2026-11-02')).toBe('Every weekday')
    expect(say(weekly([1, 4], { interval: 2, ends: 'count', count: 10 }), '2026-11-02')).toBe('Every 2 weeks on Monday and Thursday, 10 times')
    expect(say({ freq: 'monthly', interval: 1, days: [], monthBy: 'nth', ends: 'never' }, '2026-10-30')).toBe('Every month on the last Friday')
    expect(say({ freq: 'yearly', interval: 1, days: [], monthBy: 'day', ends: 'never' }, '2026-11-03')).toBe('Every year on Nov 3')
  })
})

describe('changing part of a series', () => {
  const r = weekly([2], { ends: 'count', count: 6 })
  it('This and following: the old series ends the day before, the new one carries what was left', () => {
    expect(endBefore(r, '2026-11-03', '2026-11-17')).toEqual({ ...r, count: 2 })
    expect(restFrom(r, '2026-11-03', '2026-11-17')).toEqual({ ...r, count: 4 })
    expect(endBefore(weekly([2]), '2026-11-03', '2026-11-17')).toEqual(weekly([2], { ends: 'until', until: '2026-11-16' }))
  })
  it('from the first occurrence, nothing is left before', () => {
    expect(endBefore(r, '2026-11-03', '2026-11-03')).toBeNull()
  })
  it('a count gives a last day', () => {
    expect(lastDay(r, '2026-11-03')).toBe('2026-12-08')
    expect(lastDay(weekly([2]), '2026-11-03')).toBeNull()
  })
})

describe('the rest', () => {
  it("names one occurrence as Google does", () => {
    expect(instanceId('abc', { at: '2026-11-03T15:00:00.000Z' })).toBe('abc_20261103T150000Z')
    expect(instanceId('abc', { date: '2026-11-03' })).toBe('abc_20261103')
  })
  it('cleans what the form sends', () => {
    expect(cleanRepeat({ freq: 'weekly', interval: 0, days: [], monthBy: 'day', ends: 'until', until: '2020-01-01' }, '2026-11-03')).toEqual(weekly([2]))
    expect(cleanRepeat({ freq: 'hourly' as never, interval: 1, days: [], monthBy: 'day', ends: 'never' }, '2026-11-03')).toBeNull()
  })
})
