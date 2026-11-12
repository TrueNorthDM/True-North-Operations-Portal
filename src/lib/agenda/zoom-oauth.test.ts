import { describe, expect, it } from 'vitest'
import { isZoomLink, readZoomStateCookie, withZoomLine, withoutZoomLine, zoomAuthUrl, zoomMeetingBody, zoomMeetingOf, zoomNotice, zoomStateCookie } from './zoom-oauth'
import { eventBody, type EventForGoogle } from './google-events'
import { fieldsOf } from './google-sync'

const LINK = 'https://us02web.zoom.us/j/84522319902?pwd=abc'

describe('Zoom links', () => {
  it('knows a Zoom join link from any other', () => {
    expect(isZoomLink(LINK)).toBe(true)
    expect(isZoomLink('https://zoom.us/j/123')).toBe(true)
    expect(isZoomLink('https://truenorth.zoom.us/my/room')).toBe(true)
    expect(isZoomLink('https://meet.google.com/abc-defg-hij')).toBe(false)
    expect(isZoomLink('https://notzoom.us/j/1')).toBe(false)
    expect(isZoomLink(null)).toBe(false)
  })
  it('adds its line to a description and takes it off again', () => {
    expect(withZoomLine('Agenda for the week', LINK)).toBe(`Agenda for the week\n\nJoin Zoom meeting: ${LINK}`)
    expect(withZoomLine(null, LINK)).toBe(`Join Zoom meeting: ${LINK}`)
    expect(withoutZoomLine(`Agenda for the week\n\nJoin Zoom meeting: ${LINK}`)).toBe('Agenda for the week')
    expect(withoutZoomLine(`Join Zoom meeting: ${LINK}`)).toBeNull()
  })
})

describe('Zoom sign-in', () => {
  it('builds the sign-in address', () => {
    const u = new URL(zoomAuthUrl({ clientId: 'abc' }, 'https://portal.example/api/agenda/zoom/callback', 'state123'))
    expect(u.origin + u.pathname).toBe('https://zoom.us/oauth/authorize')
    expect(Object.fromEntries(u.searchParams)).toEqual({ response_type: 'code', client_id: 'abc', redirect_uri: 'https://portal.example/api/agenda/zoom/callback', state: 'state123' })
  })
  it('reads its own state cookie and nothing else', () => {
    const person = '11111111-2222-3333-4444-555555555555', state = 'a'.repeat(32)
    expect(readZoomStateCookie(zoomStateCookie(state, person, 'agenda'))).toEqual({ state, personId: person, from: 'agenda' })
    expect(readZoomStateCookie(zoomStateCookie(state, person, 'settings'))?.from).toBe('settings')
    expect(readZoomStateCookie(`${state}.${person}`)).toBeNull()
    expect(readZoomStateCookie(undefined)).toBeNull()
  })
  it('words what came back', () => {
    expect(zoomNotice('connected', 'a@b.co')).toEqual({ text: 'a@b.co is connected to Zoom.', error: false })
    expect(zoomNotice('cancelled')?.error).toBe(true)
    expect(zoomNotice('nonsense')).toBeNull()
  })
})

describe('Zoom meetings', () => {
  const e = { title: 'SEO weekly sync', starts_at: '2026-11-16T15:00:00+00:00', ends_at: '2026-11-16T15:45:00+00:00', time_zone: 'America/New_York', description: 'Notes' }
  it('schedules one event at its time and length', () => {
    expect(zoomMeetingBody(e)).toEqual({ topic: 'SEO weekly sync', type: 2, start_time: '2026-11-16T15:00:00Z', duration: 45, timezone: 'America/New_York', agenda: 'Notes' })
  })
  it('gives a series one link with no fixed time', () => {
    expect(zoomMeetingBody({ ...e, recurrence: 'RRULE:FREQ=WEEKLY' })).toEqual({ topic: 'SEO weekly sync', type: 3, agenda: 'Notes' })
  })
  it('reads the id and link Zoom answers with', () => {
    expect(zoomMeetingOf({ id: 84522319902, join_url: LINK })).toEqual({ id: '84522319902', link: LINK })
    expect(zoomMeetingOf({ id: 1 })).toBeNull()
  })
})

describe('Zoom in the Google invitation', () => {
  const ev: EventForGoogle = { id: 7, title: 'Sync', start_date: '2026-11-16', end_date: '2026-11-16', starts_at: '2026-11-16T15:00:00Z', ends_at: '2026-11-16T15:45:00Z', time_zone: 'America/New_York', how: 'online', place: null, description: 'Notes', client: null }
  it('carries the link as the place and the last line, and asks for no Meet', () => {
    const b = eventBody(ev, ['a@b.co'], 'me@b.co', { meet: false, dropMeet: true, zoomLink: LINK })
    expect(b.location).toBe(LINK)
    expect(b.description).toBe(`Notes\n\nJoin Zoom meeting: ${LINK}`)
    expect(b.conferenceData).toBeNull()
  })
  it('leaves a Meet event as it was', () => {
    const b = eventBody(ev, [], 'me@b.co', { meet: true, dropMeet: false })
    expect(b.location).toBeUndefined()
    expect(b.description).toBe('Notes')
    expect(b.conferenceData).toBeTruthy()
  })
  it('reads it back from Google as an online event on that link', () => {
    const f = fieldsOf({ id: 'g1', summary: 'Sync', location: LINK, description: `Notes\n\nJoin Zoom meeting: ${LINK}`, start: { dateTime: '2026-11-16T10:00:00-05:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-11-16T10:45:00-05:00', timeZone: 'America/New_York' } } as Parameters<typeof fieldsOf>[0])
    expect(f).toMatchObject({ how: 'online', meet_link: LINK, place: null, description: 'Notes' })
  })
})
