import { describe, it, expect } from 'vitest'
import { lastFourWeeks } from './publishing-weeks'

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const range = (d: Date) => lastFourWeeks(d).map(w => `${ymd(w.start)}..${ymd(w.end)}`)

describe('lastFourWeeks', () => {
  // The whole point of "complete": the week you are standing in is not counted,
  // because it is unfinished and would read as behind every day until Friday.
  it('excludes the week in progress', () => {
    // Wednesday 9 September 2026. The current week began Monday the 7th.
    const weeks = range(at('2026-09-09'))
    expect(weeks).toEqual([
      '2026-08-10..2026-08-16',
      '2026-08-17..2026-08-23',
      '2026-08-24..2026-08-30',
      '2026-08-31..2026-09-06',
    ])
  })

  it('gives four weeks, oldest first, each Monday to Sunday', () => {
    const weeks = lastFourWeeks(at('2026-09-09'))
    expect(weeks).toHaveLength(4)
    for (const w of weeks) {
      expect(w.start.getUTCDay()).toBe(1)   // Monday
      expect(w.end.getUTCDay()).toBe(0)     // Sunday
      // end is the last moment of Sunday, so compare the dates, not the span.
      expect(ymd(w.end) > ymd(w.start)).toBe(true)
      const days = Math.floor((+w.end - +w.start) / 86_400_000)
      expect(days).toBe(6)
    }
  })

  // A Monday is the first day of a new incomplete week, so the four behind it
  // must all still be the four that just finished.
  it('does not count the week that starts today', () => {
    expect(range(at('2026-09-07'))).toEqual(range(at('2026-09-09')))
  })

  // A Sunday is the last day of a week that has not finished until midnight.
  it('does not count the week ending today', () => {
    expect(range(at('2026-09-06'))).toEqual(range(at('2026-09-02')))
  })

  it('walks back across a year end without a gap', () => {
    // Wednesday 13 January 2027, so the week in progress began Monday the 11th
    // and the four complete weeks before it start 14, 21, 28 December and 4
    // January. Checked against a calendar, not derived from the code.
    const weeks = range(at('2027-01-13'))
    expect(weeks).toEqual([
      '2026-12-14..2026-12-20',
      '2026-12-21..2026-12-27',
      '2026-12-28..2027-01-03',
      '2027-01-04..2027-01-10',
    ])
  })

  it('leaves no gap or overlap between consecutive weeks', () => {
    const weeks = lastFourWeeks(at('2026-09-09'))
    for (let i = 1; i < weeks.length; i++) {
      const gap = (+weeks[i].start - +weeks[i - 1].start) / 86_400_000
      expect(gap).toBe(7)
    }
  })
})
