import { describe, it, expect } from 'vitest'
import { sampleBusy, sampleHours, seeded } from './sample-plan'
import { workingIntervals } from './working-hours'
import { instantOf } from './time'

describe('sample data for staging', () => {
  it('is the same every time for the same key', () => {
    expect(seeded('a')()).toBe(seeded('a')())
    expect(sampleHours('devon')).toEqual(sampleHours('devon'))
    expect(sampleBusy('devon@x', sampleHours('devon'), 'America/Denver', '2026-11-02', 10))
      .toEqual(sampleBusy('devon@x', sampleHours('devon'), 'America/Denver', '2026-11-02', 10))
  })
  it('keeps busy times inside working hours, apart from each other, and off the weekend', () => {
    const hours = sampleHours('grace'), zone = 'Africa/Nairobi'
    const busy = sampleBusy('grace@x', hours, zone, '2026-11-02', 14)
    expect(busy.length).toBeGreaterThan(8)
    const work = workingIntervals(hours, zone, instantOf('2026-11-01', 0, zone), instantOf('2026-11-17', 0, zone))
    for (const [a, b] of busy) {
      expect(work.some(([s, e]) => a >= s && b <= e)).toBe(true)
      expect((b - a) % 1800000).toBe(0)
    }
    for (let i = 1; i < busy.length; i++) expect(busy[i][0]).toBeGreaterThanOrEqual(busy[i - 1][1])
  })
})
