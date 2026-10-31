import { describe, expect, it } from 'vitest'
import { fieldsOf } from './google-sync'

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
