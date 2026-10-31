import { describe, expect, it } from 'vitest'
import { expandSeries } from './series'

const row = { start_date: '2026-10-27', end_date: '2026-10-27', starts_at: '2026-10-27T14:00:00.000Z', ends_at: '2026-10-27T15:00:00.000Z', time_zone: 'America/New_York', recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=TU;WKST=SU', skip_days: ['2026-11-10'] }

describe('a series as its occurrences', () => {
  it('keeps 10:00 AM in Washington across the clock change, and skips the days taken out', () => {
    const out = expandSeries(row, '2026-10-27', '2026-11-17')
    expect(out.map(o => o.day)).toEqual(['2026-10-27', '2026-11-03', '2026-11-17'])
    expect(out[1].row.starts_at).toBe('2026-11-03T15:00:00.000Z')
    expect(out[1].row.ends_at).toBe('2026-11-03T16:00:00.000Z')
  })
  it('an all-day series keeps its length in days', () => {
    const out = expandSeries({ ...row, starts_at: null, ends_at: null, end_date: '2026-10-28', recurrence: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=27', skip_days: [] }, '2026-11-01', '2026-11-30')
    expect(out.map(o => [o.row.start_date, o.row.end_date])).toEqual([['2026-11-27', '2026-11-28']])
  })
  it('a single event is itself', () => {
    expect(expandSeries({ ...row, recurrence: null }, '2026-10-01', '2026-12-31')).toEqual([{ row: { ...row, recurrence: null }, day: null }])
  })
})
