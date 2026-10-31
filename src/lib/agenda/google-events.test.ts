import { describe, expect, it } from 'vitest'
import { eventBody, meetOf, type EventForGoogle } from './google-events'

const timed: EventForGoogle = {
  id: 7, title: 'Kick-off', start_date: '2026-11-03', end_date: '2026-11-03',
  starts_at: '2026-11-03T15:00:00Z', ends_at: '2026-11-03T16:00:00Z', time_zone: 'America/New_York',
  how: 'online', place: null, description: 'Agenda in the doc', client: 'Acme',
}

describe('what Google is sent', () => {
  it('a timed online event, with a Meet request and the guests', () => {
    const b = eventBody(timed, ['ana@x.com', 'ANA@x.com', 'me@tn.com', ' '], 'me@tn.com', { meet: true, dropMeet: false })
    expect(b.start).toEqual({ dateTime: '2026-11-03T15:00:00Z', timeZone: 'America/New_York' })
    expect(b.attendees).toEqual([{ email: 'ana@x.com' }])
    expect(b.description).toBe('Agenda in the doc\n\nClient: Acme')
    expect((b.conferenceData as { createRequest: { conferenceSolutionKey: { type: string } } }).createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet')
    expect(b.location).toBeUndefined()
  })

  it('an all-day event ends the day after its last day, as Google counts', () => {
    const b = eventBody({ ...timed, starts_at: null, ends_at: null, start_date: '2026-11-03', end_date: '2026-11-05', how: 'in_person', place: 'Office' }, [], 'me@tn.com', { meet: false, dropMeet: false })
    expect(b.start).toEqual({ date: '2026-11-03' })
    expect(b.end).toEqual({ date: '2026-11-06' })
    expect(b.location).toBe('Office')
    expect(b.conferenceData).toBeUndefined()
  })

  it('takes the Meet off an event that is no longer online', () => {
    expect(eventBody({ ...timed, how: 'in_person' }, [], 'me@tn.com', { meet: false, dropMeet: true }).conferenceData).toBeNull()
  })
})

describe("Google's Meet link", () => {
  it('reads it from the answer', () => {
    expect(meetOf({ hangoutLink: 'https://meet.google.com/abc-defg-hij' })).toBe('https://meet.google.com/abc-defg-hij')
    expect(meetOf({ conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:1' }, { entryPointType: 'video', uri: 'https://meet.google.com/x' }] } })).toBe('https://meet.google.com/x')
    expect(meetOf({})).toBeNull()
  })
})
