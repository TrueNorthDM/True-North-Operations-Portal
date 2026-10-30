import { describe, expect, it } from 'vitest'
import { bookingSlots, checkBooking, checkLink, hostLine, slugFor, stepOf, whenLine } from './booking'
import { instantOf } from './time'
import { workingIntervals } from './working-hours'

const MIN = 60_000
const rules = { gap: 10, noticeMin: 1440, windowDays: 30 }

describe('slugFor', () => {
  it('writes the name plainly, accents and all', () => {
    expect(slugFor('Arnaldo Oliveira', new Set())).toBe('arnaldo-oliveira')
    expect(slugFor('  João  da Silva! ', new Set())).toBe('joao-da-silva')
  })
  it('adds a number when the name is taken', () => {
    expect(slugFor('Ana Lima', new Set(['ana-lima', 'ana-lima-2']))).toBe('ana-lima-3')
  })
  it('never comes back empty', () => {
    expect(slugFor('李', new Set())).toBe('meet')
  })
})

describe('checkLink', () => {
  const ok = { on: true, lengths: [60, 30, 30], gap: 10, noticeMin: 1440, windowDays: 30, accountId: 7 }
  it('keeps the lengths once each, shortest first', () => {
    const r = checkLink(ok, [7])
    expect(r.ok && r.link.lengths).toEqual([30, 60])
  })
  it('needs a length and an account when the link is on', () => {
    expect(checkLink({ ...ok, lengths: [20] }, [7]).ok).toBe(false)
    expect(checkLink({ ...ok, accountId: 9 }, [7])).toEqual({ ok: false, error: 'Choose the account the meetings are made on.' })
    expect(checkLink({ ...ok, on: false, accountId: null }, [7]).ok).toBe(true)
  })
  it('refuses a gap, notice or window that is not offered', () => {
    expect(checkLink({ ...ok, gap: 5 }, [7]).ok).toBe(false)
    expect(checkLink({ ...ok, noticeMin: 60 }, [7]).ok).toBe(false)
    expect(checkLink({ ...ok, windowDays: 7 }, [7]).ok).toBe(false)
  })
})

describe('bookingSlots', () => {
  // Monday 2 November 2026, the first day of standard time in the US. The
  // host is in Fortaleza (no daylight saving), working 9:00 to 18:00.
  const zone = 'America/Fortaleza'
  const day = '2026-11-02'
  const work = workingIntervals({ 1: [[540, 1080]] }, zone, instantOf(day, 0, zone), instantOf(day, 1440, zone))
  const now = instantOf('2026-10-30', 600, zone)

  it('starts on the half hour for 30 and 60 minutes, the quarter hour for 15 and 45', () => {
    expect(stepOf(30)).toBe(30); expect(stepOf(60)).toBe(30); expect(stepOf(15)).toBe(15); expect(stepOf(45)).toBe(15)
    expect(bookingSlots(work, [], 30, rules, now)).toHaveLength(18)
    expect(bookingSlots(work, [], 15, rules, now)).toHaveLength(36)
  })

  it('lines up with Washington: 12:30 in Fortaleza is 10:30 ET after the US clocks go back', () => {
    const at = instantOf(day, 750, zone)
    expect(bookingSlots(work, [], 30, rules, now)).toContain(at)
    expect(at).toBe(instantOf(day, 630, 'America/New_York'))
  })

  it('keeps the gap on both sides of a busy time', () => {
    const busy: [number, number][] = [[instantOf(day, 660, zone), instantOf(day, 720, zone)]] // 11:00 to 12:00
    const s = bookingSlots(work, busy, 30, rules, now).map(ms => (ms - instantOf(day, 0, zone)) / MIN)
    expect(s).toContain(600) // 10:00 to 10:30, 30 minutes clear
    expect(s).not.toContain(630) // 10:30 to 11:00 ends inside the gap
    expect(s).not.toContain(720) // 12:00 starts inside the gap
    expect(s).toContain(750)
  })

  it('leaves out what is sooner than the notice or past the window', () => {
    const close = instantOf(day, 540, zone) - 1440 * MIN + 90 * MIN // 1 day before 10:30
    const s = bookingSlots(work, [], 30, rules, close)
    expect(s[0]).toBe(instantOf(day, 630, zone))
    expect(bookingSlots(work, [], 30, { ...rules, windowDays: 14 }, instantOf('2026-10-10', 0, zone))).toEqual([])
  })
})

describe('checkBooking', () => {
  const base = { len: 30, start: 1, name: ' Maria Santos ', email: 'Maria@HopeClinic.org', guests: [], zone: 'America/Sao_Paulo' }
  it('cleans the details', () => {
    const r = checkBooking({ ...base, guests: ['joao@hopeclinic.org', 'JOAO@hopeclinic.org', 'maria@hopeclinic.org', ''] }, [30, 60])
    expect(r).toEqual({ ok: true, booking: { len: 30, start: 1, name: 'Maria Santos', email: 'maria@hopeclinic.org', guests: ['joao@hopeclinic.org'], note: null, zone: 'America/Sao_Paulo' } })
  })
  it('says what to fix', () => {
    expect(checkBooking({ ...base, len: 45 }, [30])).toEqual({ ok: false, error: 'Pick a meeting length.' })
    expect(checkBooking({ ...base, email: 'maria' }, [30])).toEqual({ ok: false, error: 'Type your email address.' })
    expect(checkBooking({ ...base, guests: ['nope'] }, [30])).toEqual({ ok: false, error: 'nope does not look like an email address.' })
    expect(checkBooking({ ...base, guests: Array.from({ length: 11 }, (_, i) => `g${i}@x.org`) }, [30])).toEqual({ ok: false, error: 'Up to 10 guests.' })
  })
  it('falls back to Washington for a zone it does not know', () => {
    const r = checkBooking({ ...base, zone: 'Mars/Olympus' }, [30])
    expect(r.ok && r.booking.zone).toBe('America/New_York')
  })
})

describe('the lines people read', () => {
  const at = instantOf('2026-11-02', 630, 'America/New_York')
  it('tells the host in their own time', () => {
    expect(hostLine(at, 30, 2, 'America/Fortaleza')).toBe('Mon, Nov 2, 12:30 PM your time · 30 min · 2 people')
    expect(hostLine(at, 60, 1, 'America/New_York')).toBe('Mon, Nov 2, 10:30 AM your time · 60 min · 1 person')
  })
  it('tells the booker in theirs', () => {
    expect(whenLine(at, 30, 'Europe/London')).toBe('Monday, November 2, 3:30 PM to 4:00 PM')
  })
})
