import { describe, it, expect } from 'vitest'
import { boardRows, lastWeeks, weekLabel } from './publishing-weeks'
import { toPublishedItems } from './published-items'
import { publisherTest } from './publishing-rules'
import { toCadence, WEEKLY } from './publishing-cycles'

const at = (iso: string) => new Date(`${iso}T16:00:00Z`)
// The New York day: weeks are cut in New York since 10 October 2026.
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
const nyDay = (d: Date) => new Date(`${ymd(d)}T12:00:00Z`).getUTCDay()
const range = (d: Date) => lastWeeks(d, 5).map(w => `${ymd(w.start)}..${ymd(w.end)}`)

describe('lastWeeks', () => {
  // The whole point of "complete": the week you are standing in is not counted,
  // because it is unfinished and would read as behind every day until Friday.
  it('excludes the week in progress', () => {
    // Wednesday 9 September 2026. The current week began Monday the 7th.
    const weeks = range(at('2026-09-09'))
    expect(weeks).toEqual([
      '2026-08-03..2026-08-09',
      '2026-08-10..2026-08-16',
      '2026-08-17..2026-08-23',
      '2026-08-24..2026-08-30',
      '2026-08-31..2026-09-06',
    ])
  })

  it('gives five weeks, oldest first, each Monday to Sunday', () => {
    const weeks = lastWeeks(at('2026-09-09'), 5)
    expect(weeks).toHaveLength(5)
    for (const w of weeks) {
      expect(nyDay(w.start)).toBe(1)   // Monday
      expect(nyDay(w.end)).toBe(0)     // Sunday
      // end is the last moment of Sunday, so compare the dates, not the span.
      expect(ymd(w.end) > ymd(w.start)).toBe(true)
      const days = Math.floor((+w.end - +w.start) / 86_400_000)
      expect(days).toBe(6)
    }
  })

  // A Monday is the first day of a new incomplete week, so the five behind it
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
    // and the five complete weeks before it start 7, 14, 21, 28 December and 4
    // January. Checked against a calendar, not derived from the code.
    const weeks = range(at('2027-01-13'))
    expect(weeks).toEqual([
      '2026-12-07..2026-12-13',
      '2026-12-14..2026-12-20',
      '2026-12-21..2026-12-27',
      '2026-12-28..2027-01-03',
      '2027-01-04..2027-01-10',
    ])
  })

  // Cut on the UTC day, a page published Sunday 8:30pm in New York fell in the
  // following week (audit, 10 October 2026).
  it('keeps Sunday evening in New York in its own week', () => {
    const last = lastWeeks(at('2026-09-09'), 5)[4]
    const sundayEvening = new Date('2026-09-07T00:30:00Z')   // Sun 6 Sep, 8:30pm EDT
    expect(+sundayEvening >= +last.start && +sundayEvening <= +last.end).toBe(true)
  })

  it('leaves no gap or overlap between consecutive weeks', () => {
    const weeks = lastWeeks(at('2026-09-09'), 5)
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
    for (const { start, end } of lastWeeks(at('2026-01-05'), 5)) {
      expect(weekLabel(start, end).length).toBeLessThanOrEqual(12)
    }
    expect(weekLabel(at('2026-08-31'), at('2026-09-06')).length).toBe(12)
  })
})

// The Home card's rows for a board counted in two-week cycles (approved
// 15 October 2026). Bessemeters' first cycle runs 12 to 25 October 2026.
describe('boardRows, two-week cycles', () => {
  const BM = '1764094550'
  const AAAF = '462251934'
  const rules = {
    periods: [
      { boardId: BM, language: 'English', target: 1, from: '2026-10-12', to: null },
      { boardId: AAAF, language: 'English', target: 2, from: '2020-01-06', to: null },
      { boardId: AAAF, language: 'Spanish', target: 3, from: '2020-01-06', to: null },
    ],
    paused: {},
    cadence: { [BM]: toCadence(2, '2026-10-12'), [AAAF]: WEEKLY },
  }
  const isPublisher = publisherTest(['Wendy Cacka'])
  const page = (id: string, publishedDate: string, language = 'English') => ({ id, language, publishers: ['Wendy Cacka'], publishedDate })
  const items = [
    ...toPublishedItems(BM, 'BM-P', [
      page('before-start', '2026-10-05T15:00:00Z'),
      page('a', '2026-10-14T15:00:00Z'),
      page('b', '2026-10-30T15:00:00Z'),
      // Sunday 8 November, 9:30 PM in New York: still the second cycle.
      page('c', '2026-11-09T02:30:00Z'),
      page('d', '2026-11-10T15:00:00Z'),
    ]),
    ...toPublishedItems(AAAF, 'AAAF-P', [page('x', '2026-11-03T15:00:00Z', 'Spanish')]),
  ]
  const rows = (now: string, boardId = BM, mode?: 'complete' | 'current') =>
    boardRows({ boardId, name: 'Bessemeters', items, rules, isPublisher, now: new Date(now), mode })

  it('shows every complete cycle, one row each, while there are fewer than five', () => {
    const b = rows('2026-11-11T16:00:00Z')   // Wednesday, third cycle running
    expect(b.cycleWeeks).toBe(2)
    expect(b.weeks.map(w => [w.start, w.label, w.done, w.target])).toEqual([
      ['2026-10-12', 'Oct 12 to Oct 25', 1, 1],
      ['2026-10-26', 'Oct 26 to Nov 8', 2, 1],
    ])
    expect(b.perPeriod).toBe(1)
    expect(b.hits).toBe(2)
    // English is the whole target, carried as such.
    expect(b.weeks[1].en).toEqual({ done: 2, target: 1 })
    expect(b.weeks[1].langs).toEqual([{ lang: 'English', done: 2, target: 1 }])
    expect(b.langHits).toEqual({ English: 2 })
    expect(b.firstCycleEnds).toBeNull()
    expect(b.firstCycle).toBeNull()
  })

  // The Home redesign (owner, 25 October 2026): five cycles, like five weeks.
  it('keeps the last five complete cycles once there are more', () => {
    const b = rows('2027-01-20T16:00:00Z')   // Wednesday, the cycle of 18 January running
    expect(b.weeks.map(w => w.start)).toEqual(['2026-11-09', '2026-11-23', '2026-12-07', '2026-12-21', '2027-01-04'])
    expect(b.weeks.map(w => w.done)).toEqual([1, 0, 0, 0, 0])
    expect(b.hits).toBe(1)
  })

  it('shows one cycle when only one has ended', () => {
    expect(rows('2026-10-27T16:00:00Z').weeks.map(w => w.label)).toEqual(['Oct 12 to Oct 25'])
  })

  it('says when the first cycle ends while none has', () => {
    const b = rows('2026-10-15T16:00:00Z')
    expect(b.weeks).toEqual([])
    expect(b.firstCycleEnds).toBe('2026-10-25')
    // Before the start too.
    expect(rows('2026-10-08T16:00:00Z').firstCycleEnds).toBe('2026-10-25')
  })

  // "0 of 1 so far" on the card: the first cycle counted up to now.
  it('counts the first cycle so far while none has ended', () => {
    const b = rows('2026-10-15T16:00:00Z')
    expect(b.firstCycle).toMatchObject({ start: '2026-10-12', label: 'Oct 12 to Oct 25', done: 1, target: 1 })
    // Before the start, nothing counts yet, not even the page from 5 October.
    expect(rows('2026-10-08T16:00:00Z').firstCycle).toMatchObject({ start: '2026-10-12', done: 0, target: 1 })
    expect(rows('2026-10-15T16:00:00Z', BM, 'current').firstCycle).toBeNull()
  })

  it('counts the cycle still running for the notification', () => {
    const b = rows('2026-10-15T16:00:00Z', BM, 'current')
    expect(b.weeks.map(w => [w.start, w.done, w.target])).toEqual([['2026-10-12', 1, 1]])
    expect(b.firstCycleEnds).toBeNull()
    expect(rows('2026-10-08T16:00:00Z', BM, 'current').weeks).toEqual([])
  })

  it('leaves a weekly board on its last five weeks', () => {
    const b = rows('2026-11-11T16:00:00Z', AAAF)
    expect(b.cycleWeeks).toBe(1)
    expect(b.weeks.map(w => w.label)).toEqual(['Oct 5-11', 'Oct 12-18', 'Oct 19-25', 'Oct 26-Nov 1', 'Nov 2-8'])
    expect(b.weeks.map(w => w.done)).toEqual([0, 0, 0, 0, 1])
    expect(b.perPeriod).toBe(5)
    expect(b.firstCycle).toBeNull()
  })
})

// Every targeted language per row, for the Home card's language rows (owner,
// 25 October 2026). AAAF's targets change on 19 October: Hindi starts at 2.
describe('boardRows, every language', () => {
  const AAAF = '462251934'
  const rules = {
    periods: [
      { boardId: AAAF, language: 'Spanish', target: 3, from: '2020-01-06', to: null },
      { boardId: AAAF, language: 'English', target: 2, from: '2020-01-06', to: null },
      { boardId: AAAF, language: 'Portuguese', target: 2, from: '2020-01-06', to: null },
      { boardId: AAAF, language: 'Hindi', target: 2, from: '2026-10-19', to: null },
      // A target of 0 is no target: no cell for it.
      { boardId: AAAF, language: 'French', target: 0, from: '2020-01-06', to: null },
    ],
    paused: {},
    cadence: { [AAAF]: WEEKLY },
  }
  const isPublisher = publisherTest(['Wendy Cacka'])
  let n = 0
  const pages = (day: string, language: string, count: number) =>
    Array.from({ length: count }, () => ({ id: `p${n++}`, language, publishers: ['Wendy Cacka'], publishedDate: `${day}T15:00:00Z` }))
  const items = toPublishedItems(AAAF, 'AAAF-P', [
    ...pages('2026-10-06', 'English', 2), ...pages('2026-10-07', 'Spanish', 3),
    ...pages('2026-10-13', 'English', 1), ...pages('2026-10-14', 'Spanish', 3), ...pages('2026-10-14', 'Portuguese', 2),
    ...pages('2026-10-20', 'Hindi', 2), ...pages('2026-10-21', 'Portuguese', 1),
    ...pages('2026-10-28', 'English', 2), ...pages('2026-10-28', 'Spanish', 1),
    ...pages('2026-11-03', 'English', 3), ...pages('2026-11-03', 'Spanish', 3), ...pages('2026-11-04', 'Portuguese', 2), ...pages('2026-11-04', 'Hindi', 2),
  ])
  const b = boardRows({ boardId: AAAF, name: 'AskAnAdventistFriend', items, rules, isPublisher, now: new Date('2026-11-11T16:00:00Z') })

  it('carries every targeted language per row, English first, then the larger targets, then by name', () => {
    expect(b.weeks[0].langs).toEqual([
      { lang: 'English', done: 2, target: 2 },
      { lang: 'Spanish', done: 3, target: 3 },
      { lang: 'Portuguese', done: 0, target: 2 },
    ])
    // Hindi joins on the week its target starts, in its place by size and name.
    expect(b.weeks[2].langs.map(l => [l.lang, l.done, l.target])).toEqual([
      ['English', 0, 2], ['Spanish', 0, 3], ['Hindi', 2, 2], ['Portuguese', 1, 2],
    ])
    // English stays beside it, as before.
    expect(b.weeks[0].en).toEqual({ done: 2, target: 2 })
  })

  it('counts the weeks each language met its own target', () => {
    expect(b.langHits).toEqual({ English: 3, Spanish: 3, Portuguese: 2, Hindi: 2 })
    expect(b.enHits).toBe(3)
    // All languages together: only the last week lands every one.
    expect(b.weeks.map(w => `${w.done}/${w.target}`)).toEqual(['5/7', '6/7', '3/9', '3/9', '10/9'])
    expect(b.hits).toBe(1)
  })
})
