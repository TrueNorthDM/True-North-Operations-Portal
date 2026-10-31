import { describe, expect, it } from 'vitest'
import { FRESH_MS, pieces, readAnswer, stretchToRead } from './google-busy'

const DAY = 864e5
const now = Date.parse('2026-11-02T15:00:00Z')

describe('when Google is asked again', () => {
  const read = { busyFrom: new Date(now - DAY).toISOString(), busyTo: new Date(now + 62 * DAY).toISOString(), busyReadAt: new Date(now - 60_000).toISOString() }

  it('uses a fresh copy that covers the days asked for', () => {
    expect(stretchToRead(read, now, now + 14 * DAY, now)).toBeNull()
  })

  it('reads again once the copy is older than five minutes', () => {
    expect(stretchToRead(read, now, now + 14 * DAY, now + FRESH_MS + 60_000)).not.toBeNull()
  })

  it('reads again, wider, when the days asked for go past the copy', () => {
    const s = stretchToRead(read, now, now + 90 * DAY, now)!
    expect(s[0]).toBe(now - DAY)
    expect(s[1]).toBe(now + 90 * DAY)
  })

  it('reads a never-read account from a day back to two months ahead', () => {
    expect(stretchToRead({ busyFrom: null, busyTo: null, busyReadAt: null }, now, now + 7 * DAY, now)).toEqual([now - DAY, now + 62 * DAY])
  })
})

describe('long stretches', () => {
  it('go to Google in pieces of at most 60 days, end to end', () => {
    const p = pieces(0, 130 * DAY)
    expect(p).toEqual([[0, 60 * DAY], [60 * DAY, 120 * DAY], [120 * DAY, 130 * DAY]])
  })
})

describe("Google's answer", () => {
  it('keeps the busy stretches of the primary calendar', () => {
    const a = readAnswer({ calendars: { primary: { busy: [{ start: '2026-11-02T15:00:00Z', end: '2026-11-02T16:00:00Z' }, { start: 'x', end: 'x' }] } } })
    expect(a).toEqual({ busy: [['2026-11-02T15:00:00Z', '2026-11-02T16:00:00Z']] })
  })

  it('says why when Google gives no times', () => {
    expect(readAnswer({ calendars: { primary: { errors: [{ reason: 'notFound' }] } } })).toEqual({ error: 'notFound' })
    expect(readAnswer({})).toEqual({ error: 'no answer for the calendar' })
  })
})
