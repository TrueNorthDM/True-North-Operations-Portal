import { describe, expect, it } from 'vitest'
import { fieldsOf, originalDay, seriesOf } from './google-sync'

describe('a Google event in the portal', () => {
  it('a timed meeting, with its Meet link and its days in its own zone', () => {
    const f = fieldsOf({ id: 'g1', summary: ' Kick-off ', hangoutLink: 'https://meet.google.com/abc', start: { dateTime: '2026-11-03T22:30:00-05:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-11-04T00:30:00-05:00' } })!
    expect(f.title).toBe('Kick-off')
    expect(f.starts_at).toBe('2026-11-04T03:30:00.000Z')
    expect([f.start_date, f.end_date]).toEqual(['2026-11-03', '2026-11-04'])
    expect(f.how).toBe('online')
  })

  it('an all-day event ends on its last day, not the day after as Google writes it', () => {
    const f = fieldsOf({ id: 'g2', summary: 'Retreat', location: 'Lodge', start: { date: '2026-11-11' }, end: { date: '2026-11-14' } })!
    expect([f.start_date, f.end_date, f.starts_at]).toEqual(['2026-11-11', '2026-11-13', null])
    expect(f.how).toBe('in_person')
  })

  it('names an untitled event and skips one with no start', () => {
    expect(fieldsOf({ id: 'g3', start: { date: '2026-11-11' }, end: { date: '2026-11-12' } })!.title).toBe('(No title)')
    expect(fieldsOf({ id: 'g4' })).toBeNull()
  })
})

describe('a series from Google', () => {
  it('reads the rule and the days taken out, in the series zone', () => {
    const s = seriesOf(['RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=4', 'EXDATE;TZID=America/New_York:20261110T100000', 'EXDATE:20261118T020000Z'], '2026-11-03', 'America/New_York')!
    expect(s.recurrence).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=4')
    expect(s.recur_until).toBe('2026-11-24')
    expect(s.skip_days).toEqual(['2026-11-10', '2026-11-17'])
  })
  it('leaves out a rule the portal cannot draw', () => {
    expect(seriesOf(['RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1'], '2026-11-02', 'America/New_York')).toBeNull()
  })
  it('knows the day an occurrence had before it changed', () => {
    expect(originalDay({ dateTime: '2026-11-11T02:00:00Z' }, 'America/New_York')).toBe('2026-11-10')
    expect(originalDay({ date: '2026-11-10' }, 'America/New_York')).toBe('2026-11-10')
  })
})
