import { describe, it, expect } from 'vitest'
import { parseTime } from './parse-time'

describe('a time typed by hand', () => {
  it('reads the usual ways people type it', () => {
    expect(parseTime('1:15 pm')).toBe(13 * 60 + 15)
    expect(parseTime('1:15PM')).toBe(13 * 60 + 15)
    expect(parseTime('13:15')).toBe(13 * 60 + 15)
    expect(parseTime('1315')).toBe(13 * 60 + 15)
    expect(parseTime('9a')).toBe(9 * 60)
    expect(parseTime('9 a.m.')).toBe(9 * 60)
    expect(parseTime('12:00 AM')).toBe(0)
    expect(parseTime('12 pm')).toBe(720)
    expect(parseTime('noon')).toBe(720)
    expect(parseTime('10:05')).toBe(10 * 60 + 5)
  })
  it('reads a bare hour as a working-day hour', () => {
    expect(parseTime('3')).toBe(15 * 60)
    expect(parseTime('9')).toBe(9 * 60)
    expect(parseTime('12')).toBe(720)
  })
  it('gives midnight as the end of the day when asked', () => {
    expect(parseTime('midnight', { allowMidnightEnd: true })).toBe(1440)
    expect(parseTime('12:00 AM', { allowMidnightEnd: true })).toBe(1440)
    expect(parseTime('24:00', { allowMidnightEnd: true })).toBe(1440)
  })
  it('refuses what is not a time', () => {
    for (const t of ['', 'abc', '13pm', '9:75', '25:00', '1:5']) expect(parseTime(t)).toBeNull()
  })
})
