import { describe, expect, it } from 'vitest'
import { eyebrow, greeting, hourIn, summaryLine, trackAt, trackRange, trackSegments, trackTicks } from './day-banner'

const NY = 'America/New_York'
const NBO = 'Africa/Nairobi'
// Monday, October 26 2026, 10:46 AM in New York (EDT, UTC-4).
const NOW = new Date('2026-10-26T14:46:00Z')

describe('day banner', () => {
  it('reads the hour in the person\'s own zone', () => {
    expect(hourIn(NOW, NY)).toBeCloseTo(10.767, 2)
    expect(hourIn(NOW, NBO)).toBeCloseTo(17.767, 2)
  })

  it('writes the eyebrow as the prototype does', () => {
    expect(eyebrow(NOW, NY)).toBe('MONDAY, OCTOBER 26 · 10:46 AM')
  })

  it('greets by the hour', () => {
    expect(greeting(10.77)).toBe('Good morning')
    expect(greeting(12)).toBe('Good afternoon')
    expect(greeting(18)).toBe('Good evening')
  })

  it('sums up the day', () => {
    expect(summaryLine({ late: 2, today: 3, week: 1 })).toBe('5 things need you today, 2 of them late.')
    expect(summaryLine({ late: 0, today: 1, week: 0 })).toBe('1 thing needs you today.')
    expect(summaryLine({ late: 0, today: 0, week: 4 })).toBe('Today is clear. 4 more this week.')
    expect(summaryLine({ late: 0, today: 0, week: 0 })).toBe('Nothing is waiting on you.')
  })

  it('runs 7 AM to 7 PM, widened to the person\'s day', () => {
    expect(trackRange(10.77, 8.08)).toEqual({ from: 7, to: 19 })
    expect(trackRange(10.77, 6.5)).toEqual({ from: 6, to: 19 })
    expect(trackRange(20.2, null)).toEqual({ from: 7, to: 21 })
  })

  it('labels every 2 hours, the ends at the ends', () => {
    const t = trackTicks({ from: 7, to: 19 })
    expect(t.map(x => x.label)).toEqual(['7 AM', '9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM'])
    expect(t[0].at).toBe(0)
    expect(t[6].at).toBe(1)
  })

  it('draws a running stretch to now', () => {
    const r = { from: 7, to: 19 }
    const [s] = trackSegments([{ start: '2026-10-26T12:05:00Z', end: null }], NOW, NY, r)
    expect(s.left).toBeCloseTo(trackAt(8.083, r), 3)
    expect(s.left + s.width).toBeCloseTo(trackAt(10.767, r), 3)
  })
})
