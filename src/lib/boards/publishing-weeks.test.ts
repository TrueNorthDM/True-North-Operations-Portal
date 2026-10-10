import { describe, it, expect } from 'vitest'
import { lastFourWeeks, weekLabel } from './publishing-weeks'

const at = (iso: string) => new Date(`${iso}T16:00:00Z`)
// The New York day: weeks are cut in New York since 10 October 2026.
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
const nyDay = (d: Date) => new Date(`${ymd(d)}T12:00:00Z`).getUTCDay()
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
      expect(nyDay(w.start)).toBe(1)   // Monday
      expect(nyDay(w.end)).toBe(0)     // Sunday
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

  // Cut on the UTC day, a page published Sunday 8:30pm in New York fell in the
  // following week (audit, 10 October 2026).
  it('keeps Sunday evening in New York in its own week', () => {
    const [, , , last] = lastFourWeeks(at('2026-09-09'))
    const sundayEvening = new Date('2026-09-07T00:30:00Z')   // Sun 6 Sep, 8:30pm EDT
    expect(+sundayEvening >= +last.start && +sundayEvening <= +last.end).toBe(true)
  })

  it('leaves no gap or overlap between consecutive weeks', () => {
    const weeks = lastFourWeeks(at('2026-09-09'))
    for (let i = 1; i < weeks.length; i++) {
      const gap = (+weeks[i].start - +weeks[i - 1].start) / 86_400_000
      expect(gap).toBe(7)
    }
  })
})

describe('weekLabel', () => {
  // A single date does not say whether it is the week's first day or its last,
  // and readers guessed wrong, so both ends are printed.
  it('gives both ends of the week', () => {
    expect(weekLabel(at('2026-08-10'), at('2026-08-16'))).toBe('Aug 10-16')
  })

  // Repeating the month when it has not changed wastes the column, and the
  // column has to fit the longest label without pushing into the bar.
  it('names the month once when the week does not cross one', () => {
    expect(weekLabel(at('2026-09-07'), at('2026-09-13'))).toBe('Sep 7-13')
  })

  it('names both months when the week crosses one', () => {
    expect(weekLabel(at('2026-08-31'), at('2026-09-06'))).toBe('Aug 31-Sep 6')
  })

  it('names both months when the week crosses a year', () => {
    expect(weekLabel(at('2026-12-28'), at('2027-01-03'))).toBe('Dec 28-Jan 3')
  })

  // The loader passes the end of Sunday, not its start, so the label has to
  // read the date rather than round the timestamp into Monday.
  it('reads the last moment of Sunday as Sunday', () => {
    const end = new Date('2026-08-16T23:59:59.999Z')
    expect(weekLabel(at('2026-08-10'), end)).toBe('Aug 10-16')
  })

  // Every label the loader can produce, against the column's width budget.
  it('never exceeds twelve characters', () => {
    for (const { start, end } of lastFourWeeks(at('2026-01-05'))) {
      expect(weekLabel(start, end).length).toBeLessThanOrEqual(12)
    }
    expect(weekLabel(at('2026-08-31'), at('2026-09-06')).length).toBe(12)
  })
})
