import { describe, it, expect } from 'vitest'
import {
  formatClock, formatDuration, formatTimer, onQuarter, parseDuration, recordedSeconds, roundInstant, roundIso,
  roundSeconds, runningSeconds,
} from './rounding'

// The 15-minute rule of the Clocky handoff (README "Rules" 1, SPEC 13).

const at = (hhmmss: string) => `2026-10-15T${hhmmss}.000Z`

describe('roundInstant: every recorded time on the nearest quarter hour', () => {
  it('rounds 8:07 down and 8:08 up', () => {
    expect(roundIso(at('08:07:00'))).toBe(at('08:00:00'))
    expect(roundIso(at('08:08:00'))).toBe(at('08:15:00'))
  })

  it('rounds up from 7 minutes 30 seconds', () => {
    expect(roundIso(at('08:07:29'))).toBe(at('08:00:00'))
    expect(roundIso(at('08:07:30'))).toBe(at('08:15:00'))
    expect(roundIso(at('08:52:30'))).toBe(at('09:00:00'))
  })

  it('leaves a quarter hour where it is, and crosses midnight when it must', () => {
    expect(roundIso(at('10:45:00'))).toBe(at('10:45:00'))
    expect(roundIso('2026-10-15T23:53:00.000Z')).toBe('2026-10-16T00:00:00.000Z')
  })

  it('is the same in every zone: a half-hour zone still meets the quarter hours', () => {
    // 8:07 in India (UTC+5:30) is 02:37 UTC, which rounds to 02:30 UTC, 8:00 in India.
    expect(roundIso('2026-10-15T02:37:00.000Z')).toBe('2026-10-15T02:30:00.000Z')
    expect(onQuarter(roundInstant('2026-10-15T02:44:10.000Z'))).toBe(true)
  })
})

describe('roundSeconds: typed durations round the same way', () => {
  it('records 2h 20m as 2h 15m and 2h 23m as 2h 30m', () => {
    expect(roundSeconds(2 * 3600 + 20 * 60)).toBe(2 * 3600 + 15 * 60)
    expect(roundSeconds(2 * 3600 + 23 * 60)).toBe(2 * 3600 + 30 * 60)
  })

  it('rounds 7m 30s up and 7m 29s down, and never goes below zero', () => {
    expect(roundSeconds(450)).toBe(900)
    expect(roundSeconds(449)).toBe(0)
    expect(roundSeconds(-60)).toBe(0)
    expect(roundSeconds(Number.NaN)).toBe(0)
  })
})

describe('what is shown: every duration and total a multiple of 15 minutes', () => {
  it('writes durations as "7h 45m" and totals as "7:45"', () => {
    expect(formatDuration(7 * 3600 + 45 * 60)).toBe('7h 45m')
    expect(formatClock(7 * 3600 + 45 * 60)).toBe('7:45')
    expect(formatDuration(0)).toBe('0h 00m')
  })

  it('never shows a minute off the quarter hour', () => {
    expect(formatDuration(7 * 3600 + 40 * 60)).toBe('7h 45m')
    expect(formatDuration(7 * 3600 + 37 * 60)).toBe('7h 30m')
    expect(formatClock(31 * 3600 + 20 * 60)).toBe('31:15')
    for (let s = 0; s < 4 * 3600; s += 37) expect(Number(formatDuration(s).match(/(\d+)m$/)![1]) % 15).toBe(0)
  })

  it('keeps the live timer real: h:mm:ss', () => {
    expect(formatTimer(1 * 3600 + 58 * 60 + 34)).toBe('1:58:34')
    expect(formatTimer(-5)).toBe('0:00:00')
  })
})

describe('recorded and running seconds', () => {
  it('counts between two recorded instants', () => {
    expect(recordedSeconds(at('08:00:00'), at('12:45:00'))).toBe(4 * 3600 + 45 * 60)
    expect(recordedSeconds(at('12:45:00'), at('08:00:00'))).toBe(0)
  })

  it('counts a running entry to now rounded, so a list shows quarters too', () => {
    // Recorded from 8:00; at 9:52:10 now rounds to 9:45: counted as 1h 45m.
    expect(runningSeconds(at('08:00:00'), new Date(at('09:52:10')))).toBe(1 * 3600 + 45 * 60)
    expect(runningSeconds(at('08:00:00'), new Date(at('09:52:30')))).toBe(2 * 3600)
    expect(runningSeconds(at('08:00:00'), new Date(at('09:52:31')))).toBe(2 * 3600)
    expect(runningSeconds(at('08:00:00'), new Date(at('10:07:30')))).toBe(2 * 3600 + 15 * 60)
  })
})

describe('parseDuration: what people type in the week grid and the duration field', () => {
  it('reads "2:30", "2.5", "2h 30m", "2h" and "45m"', () => {
    expect(parseDuration('2:30')).toBe(9000)
    expect(parseDuration('2.5')).toBe(9000)
    expect(parseDuration('2h 30m')).toBe(9000)
    expect(parseDuration('2h')).toBe(7200)
    expect(parseDuration('45m')).toBe(2700)
  })

  it('reads empty as nothing and anything else as not a duration', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration('  ')).toBe(0)
    expect(parseDuration('two hours')).toBeNaN()
    expect(parseDuration('2:3:4')).toBeNaN()
  })
})
