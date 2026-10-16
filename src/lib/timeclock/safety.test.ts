import { describe, it, expect } from 'vitest'
import {
  STOP_AFTER_SECONDS, WARN_AFTER_SECONDS, endOptions, keptGoingNote, safetyState, sessionStart, stillWorkingPanelText,
  stillWorkingText, stopPoint, stopWhen, stoppedText, windowStart,
} from './safety'

// The safety net (README "Rules" 4 and 5): the window counts across every
// switch, "Keep going" restarts it, and a clock open from QuickBooks Time
// counts from its start.

const NY = 'America/New_York'
const t = (hhmmss: string) => `2026-10-15T${hhmmss}.000Z` // 12:00Z is 8:00 AM in New York
const at = (hhmmss: string) => new Date(t(hhmmss))

describe('the window, across switches', () => {
  // Clocked in at 8:07 AM (12:07Z), switched at 9:45 and at 11:15: every
  // entry a switch made carries the clock in, so the window is the same.
  const clockIn = t('12:07:00')
  const afterSwitch = { started_at: t('15:15:00'), started_at_real: t('15:14:40'), session_started_at: clockIn, window_started_at: clockIn }

  it('counts from the clock in, not from the switch', () => {
    expect(windowStart(afterSwitch)).toBe(clockIn)
    expect(sessionStart(afterSwitch)).toBe(clockIn)
  })

  it('warns at 4h 30m and stops at 5h 00m since the clock in', () => {
    expect(safetyState(clockIn, at('16:36:59')).warn).toBe(false)
    expect(safetyState(clockIn, at('16:37:00')).warn).toBe(true)
    expect(safetyState(clockIn, at('17:06:59')).due).toBe(false)
    expect(safetyState(clockIn, at('17:07:00')).due).toBe(true)
    expect(Date.parse(safetyState(clockIn, at('13:00:00')).stopAt) - Date.parse(clockIn)).toBe(STOP_AFTER_SECONDS * 1000)
    expect(Date.parse(safetyState(clockIn, at('13:00:00')).warnAt) - Date.parse(clockIn)).toBe(WARN_AFTER_SECONDS * 1000)
  })

  it('restarts with "Keep going": a new 5 hours from that moment', () => {
    const kept = { ...afterSwitch, window_started_at: t('16:40:00') }
    expect(windowStart(kept)).toBe(t('16:40:00'))
    expect(sessionStart(kept)).toBe(clockIn)
    expect(safetyState(windowStart(kept)!, at('17:10:00')).due).toBe(false)
    expect(safetyState(windowStart(kept)!, at('21:10:00')).warn).toBe(true)
    expect(safetyState(windowStart(kept)!, at('21:40:00')).due).toBe(true)
  })

  it('counts a clock open from QuickBooks Time from its start', () => {
    const imported = { started_at: '2026-10-12T12:00:00.000Z' }
    expect(windowStart(imported)).toBe('2026-10-12T12:00:00.000Z')
    expect(safetyState(windowStart(imported)!, at('12:00:00')).due).toBe(true)
  })
})

describe('where the clock stops', () => {
  it('at the 5-hour mark: the real mark kept, the quarter hour recorded', () => {
    expect(stopPoint(t('12:07:00'), t('12:00:00'))).toEqual({ real: t('17:07:00'), recorded: t('17:00:00') })
    expect(stopPoint(t('12:08:00'), t('12:15:00'))).toEqual({ real: t('17:08:00'), recorded: t('17:15:00') })
  })

  it('never before the entry began (a switch after a late job)', () => {
    expect(stopPoint(t('12:00:00'), t('17:30:00')).recorded).toBe(t('17:30:00'))
  })

  it('names the day when it was not today (1L)', () => {
    expect(stopWhen(t('17:00:00'), NY, '2026-10-15')).toBe('1:00 PM')
    expect(stopWhen('2026-10-12T17:00:00.000Z', NY, '2026-10-15')).toBe('1:00 PM on Mon, Oct 12')
  })
})

describe('what the person reads (Clock Safety.dc.html, Clock Panel.dc.html)', () => {
  it('N1, the bell at 4h 30m', () => {
    expect(stillWorkingText(t('12:07:00'), NY))
      .toBe('Still working? Your clock has been running 4h 30m since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going.')
  })

  it('1I, the panel', () => {
    expect(stillWorkingPanelText(t('12:00:00'), NY, 'i7 Web Dev'))
      .toBe('Your clock has been running for 4h 30m since you clocked in at 8:00 AM, now on i7 Web Dev. It will stop by itself at 5h 00m unless you tell us you are still on it.')
  })

  it('N2, the clock stopped', () => {
    expect(stoppedText('1:00 PM')).toBe('Your clock stopped by itself at 1:00 PM. Confirm when you really stopped.')
  })

  it('the done line after "Keep going"', () => {
    expect(keptGoingNote(at('16:31:00'), NY)).toBe('You kept going at 12:31 PM. Clocky asks again in 4h 30m.')
  })
})

describe('1L: the real end time picker', () => {
  it('offers quarter hours from just after the start up to the stop, newest first', () => {
    const o = endOptions(t('12:00:00'), t('13:00:00'), at('19:20:00'), false)
    expect(o).toEqual([t('13:00:00'), t('12:45:00'), t('12:30:00'), t('12:15:00')])
  })

  it('with "I was still working until...", from after the stop up to now', () => {
    const o = endOptions(t('12:00:00'), t('13:00:00'), at('13:50:00'), true)
    expect(o).toEqual([t('13:45:00'), t('13:30:00'), t('13:15:00')])
  })
})
