import { describe, it, expect } from 'vitest'
import { DEFAULT_HOURS, checkHours, copyDay, readHours, tidy, workingIntervals, type WorkingHours } from './working-hours'
import { DC, instantOf, localOf } from './time'

describe('tidy and readHours', () => {
  it('sorts, rounds to the half hour and joins blocks that touch', () => {
    expect(tidy([[780, 1080], [420, 660], [650, 700]])).toEqual([[420, 690], [780, 1080]])
    expect(tidy([[600, 600], [-30, 60], [1400, 1500]])).toEqual([[0, 60], [1410, 1440]])
  })
  it('falls back to Monday to Friday 9 to 6 when nothing usable is stored', () => {
    expect(readHours(null)).toBe(DEFAULT_HOURS)
    expect(readHours({ 1: [[420, 660], [780, 1080]], 9: [[0, 60]], 2: 'x' })).toEqual({ 1: [[420, 660], [780, 1080]] })
  })
})

describe('checkHours', () => {
  it('accepts several blocks a day and days off', () => {
    expect(checkHours({ 1: [[780, 1080], [420, 660]], 6: [] })).toEqual({ ok: true, hours: { 1: [[420, 660], [780, 1080]] } })
  })
  it('refuses overlapping, reversed or odd times instead of changing them', () => {
    expect(checkHours({ 1: [[420, 720], [660, 900]] })).toEqual({ ok: false, error: 'Monday: two blocks overlap.' })
    expect(checkHours({ 2: [[600, 540]] })).toEqual({ ok: false, error: 'Tuesday: each block has to end after it starts.' })
    expect(checkHours({ 3: [[545, 600]] })).toEqual({ ok: false, error: 'Wednesday: pick times on the hour or half hour.' })
  })
})

describe('copyDay', () => {
  it('copies Monday to the weekdays and switches them on', () => {
    const h = copyDay({ 1: [[420, 660], [780, 1080]], 2: [[540, 1080]] }, '1', ['2', '3', '4', '5'])
    expect(h[3]).toEqual([[420, 660], [780, 1080]])
    expect(h[2]).toEqual([[420, 660], [780, 1080]])
    expect(h[6]).toBeUndefined()
  })
})

describe('workingIntervals', () => {
  it('turns Nairobi 8 to 5 into Washington time, before and after the US clock change', () => {
    const nai: WorkingHours = { 3: [[480, 1020]] }
    const day = (d: string) => workingIntervals(nai, 'Africa/Nairobi', instantOf(d, 0, DC), instantOf(d, 1440, DC))
    // Wed Oct 28: Washington is 7 hours behind Nairobi, so 1 AM to 10 AM.
    expect(day('2026-10-28').map(([a, b]) => [localOf(a, DC).minutes, localOf(b, DC).minutes])).toEqual([[60, 600]])
    // Wed Nov 4: 8 hours behind, so midnight to 9 AM.
    expect(day('2026-11-04').map(([a, b]) => [localOf(a, DC).minutes, localOf(b, DC).minutes])).toEqual([[0, 540]])
  })
  it('keeps both blocks of a split day', () => {
    const r = workingIntervals({ 1: [[420, 660], [780, 1080]] }, 'America/Fortaleza', instantOf('2026-11-02', 0, DC), instantOf('2026-11-02', 1440, DC))
    expect(r.map(([a, b]) => [localOf(a, 'America/Fortaleza').minutes, localOf(b, 'America/Fortaleza').minutes])).toEqual([[420, 660], [780, 1080]])
  })
})
