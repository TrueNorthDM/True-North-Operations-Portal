import { describe, it, expect } from 'vitest'
import { DC, clockLabel, dcVersus, instantOf, localOf, offsetMin, zoneLabel } from './time'

const iso = (ms: number) => new Date(ms).toISOString()

describe('instantOf and localOf', () => {
  it('reads Washington time before and after the US clock change (the owner\'s example)', () => {
    // Oct 30: Washington is UTC-4, Fortaleza UTC-3, so 10:30 ET is 11:30 there.
    const oct = instantOf('2026-10-30', 630, DC)
    expect(iso(oct)).toBe('2026-10-30T14:30:00.000Z')
    expect(localOf(oct, 'America/Fortaleza')).toEqual({ date: '2026-10-30', minutes: 690 })
    // Nov 2: the US changed on Nov 1, Brazil did not, so 10:30 ET is 12:30 there.
    const nov = instantOf('2026-11-02', 630, DC)
    expect(iso(nov)).toBe('2026-11-02T15:30:00.000Z')
    expect(localOf(nov, 'America/Fortaleza')).toEqual({ date: '2026-11-02', minutes: 750 })
  })
  it('takes the first 1:30 AM on the fall-back day', () => {
    expect(iso(instantOf('2026-11-01', 90, DC))).toBe('2026-11-01T05:30:00.000Z')
  })
  it('moves a time that does not exist past the spring-forward jump', () => {
    // Mar 14 2027: 2:00 AM becomes 3:00 AM, so 2:30 AM is read as 3:30 AM EDT.
    expect(iso(instantOf('2027-03-14', 150, DC))).toBe('2027-03-14T07:30:00.000Z')
    expect(localOf(instantOf('2027-03-14', 150, DC), DC)).toEqual({ date: '2027-03-14', minutes: 210 })
  })
  it('handles Europe\'s own change (Oct 25) and zones without daylight saving', () => {
    expect(iso(instantOf('2026-10-26', 600, 'Europe/London'))).toBe('2026-10-26T10:00:00.000Z')
    expect(iso(instantOf('2026-10-23', 600, 'Europe/London'))).toBe('2026-10-23T09:00:00.000Z')
    expect(iso(instantOf('2026-11-04', 480, 'Africa/Nairobi'))).toBe('2026-11-04T05:00:00.000Z')
    expect(iso(instantOf('2026-11-04', 480, 'Africa/Kigali'))).toBe('2026-11-04T06:00:00.000Z')
  })
  it('crosses midnight into the next day in another zone', () => {
    // 8 PM in Washington on Nov 4 is 4 AM on Nov 5 in Nairobi.
    expect(localOf(instantOf('2026-11-04', 1200, DC), 'Africa/Nairobi')).toEqual({ date: '2026-11-05', minutes: 240 })
  })
})

describe('labels', () => {
  it('names zones and the difference to Washington', () => {
    expect(zoneLabel('America/Fortaleza')).toBe('Brasília time (BRT), Fortaleza')
    expect(zoneLabel('America/Denver')).toBe('Mountain time (MT), Denver')
    expect(zoneLabel('Asia/Kolkata')).toBe('Kolkata')
    expect(dcVersus('America/Fortaleza', Date.parse('2026-10-30T12:00:00Z'))).toBe('1 hour behind you')
    expect(dcVersus('America/Fortaleza', Date.parse('2026-11-02T12:00:00Z'))).toBe('2 hours behind you')
    expect(dcVersus('America/Denver', Date.parse('2026-11-02T12:00:00Z'))).toBe('2 hours ahead of you')
    expect(dcVersus(DC, Date.parse('2026-11-02T12:00:00Z'))).toBe('the same time as you')
    expect(offsetMin(DC, Date.parse('2026-11-02T12:00:00Z'))).toBe(-300)
    expect(clockLabel(0)).toBe('12:00 AM')
    expect(clockLabel(780)).toBe('1:00 PM')
  })
})
