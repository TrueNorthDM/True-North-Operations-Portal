import { describe, it, expect } from 'vitest'
import {
  dateInZone, timeInZone, durationSeconds, formatHM, decimalHours,
  weekBounds, daysOfWeek, shiftWeek, roundSeconds, validateDraft, overlaps,
  wallToInstant, type Draft,
} from './clock'

const NY = 'America/New_York'

describe('dateInZone', () => {
  it('gives the company day, not the UTC day', () => {
    // 8pm in New York on the 5th is already the 6th in UTC. The timesheet
    // belongs to the 5th, and getting this wrong moves somebody's hours a day.
    expect(dateInZone(new Date('2026-08-06T00:30:00Z'), NY)).toBe('2026-08-05')
    expect(dateInZone(new Date('2026-08-06T00:30:00Z'), 'UTC')).toBe('2026-08-06')
  })

  it('handles the other side of midnight too', () => {
    expect(dateInZone(new Date('2026-08-05T13:00:00Z'), NY)).toBe('2026-08-05')
  })

  it('follows daylight saving instead of assuming a fixed offset', () => {
    // 03:30 UTC is 23:30 the previous day in EDT (-4) but 22:30 in EST (-5),
    // and both land on the previous calendar day.
    expect(dateInZone(new Date('2026-07-15T03:30:00Z'), NY)).toBe('2026-07-14')
    expect(dateInZone(new Date('2026-01-15T03:30:00Z'), NY)).toBe('2026-01-14')
    // But 04:30 UTC in January is 23:30 EST, still the previous day, while in
    // July it is already 00:30 EDT, the new one.
    expect(dateInZone(new Date('2026-01-15T04:30:00Z'), NY)).toBe('2026-01-14')
    expect(dateInZone(new Date('2026-07-15T04:30:00Z'), NY)).toBe('2026-07-15')
  })
})

describe('timeInZone', () => {
  it('reads the wall clock in the company timezone, on 24 hours', () => {
    expect(timeInZone(new Date('2026-08-05T13:05:00Z'), NY)).toBe('09:05')
  })

  it('does not turn midnight into 24:00', () => {
    expect(timeInZone(new Date('2026-08-05T04:00:00Z'), NY)).toBe('00:00')
  })
})

describe('durationSeconds', () => {
  it('counts the seconds between two instants', () => {
    expect(durationSeconds('2026-08-05T09:00:00Z', '2026-08-05T11:30:00Z')).toBe(9000)
  })

  it('floors a partial second instead of rounding it up', () => {
    expect(durationSeconds('2026-08-05T09:00:00.000Z', '2026-08-05T09:00:00.999Z')).toBe(0)
  })

  it('returns zero, not a credit, when the clock runs backwards', () => {
    expect(durationSeconds('2026-08-05T11:00:00Z', '2026-08-05T09:00:00Z')).toBe(0)
  })

  it('returns zero for anything unparseable', () => {
    expect(durationSeconds('not a date', '2026-08-05T09:00:00Z')).toBe(0)
  })

  it('spans a daylight saving change by real elapsed time, not by the clock face', () => {
    // 01:30 to 03:30 wall time on the spring-forward night is two hours on the
    // wall and one hour in the world. Instants know that; wall clocks do not.
    expect(durationSeconds('2026-03-08T06:30:00Z', '2026-03-08T07:30:00Z')).toBe(3600)
  })
})

describe('formatHM and decimalHours', () => {
  it('reads 9015 seconds as 2:30 and as 2.50', () => {
    expect(formatHM(9015)).toBe('2:30')
    expect(decimalHours(9015)).toBe('2.50')
  })

  it('pads the minutes', () => {
    expect(formatHM(3660)).toBe('1:01')
  })

  it('shows zero rather than a negative', () => {
    expect(formatHM(-500)).toBe('0:00')
  })

  it('does not roll past 24 hours into a day count', () => {
    expect(formatHM(90000)).toBe('25:00')
  })
})

describe('weekBounds', () => {
  it('starts the week on Sunday, as the account is configured', () => {
    // 2026-08-05 is a Wednesday.
    expect(weekBounds('2026-08-05', 0)).toEqual({ start: '2026-08-02', end: '2026-08-08' })
  })

  it('can start it on Monday instead', () => {
    expect(weekBounds('2026-08-05', 1)).toEqual({ start: '2026-08-03', end: '2026-08-09' })
  })

  it('leaves a day that is already the start where it is', () => {
    expect(weekBounds('2026-08-02', 0).start).toBe('2026-08-02')
  })

  it('crosses a month boundary without losing days', () => {
    expect(weekBounds('2026-09-01', 0)).toEqual({ start: '2026-08-30', end: '2026-09-05' })
  })

  it('crosses a year boundary', () => {
    expect(weekBounds('2026-01-01', 0)).toEqual({ start: '2025-12-28', end: '2026-01-03' })
  })
})

describe('daysOfWeek and shiftWeek', () => {
  it('lists seven consecutive days', () => {
    const days = daysOfWeek('2026-08-02')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-08-02')
    expect(days[6]).toBe('2026-08-08')
  })

  it('steps a week back and forward', () => {
    expect(shiftWeek('2026-08-02', -1)).toBe('2026-07-26')
    expect(shiftWeek('2026-08-02', 1)).toBe('2026-08-09')
  })

  it('steps across a leap day without drifting', () => {
    expect(shiftWeek('2024-02-25', 1)).toBe('2024-03-03')
  })
})

describe('roundSeconds', () => {
  it('rounds to the nearest quarter hour, which is how the account is set', () => {
    expect(roundSeconds(7 * 60, 15, 'nearest')).toBe(0)
    expect(roundSeconds(8 * 60, 15, 'nearest')).toBe(15 * 60)
  })

  it('rounds up and down when told to', () => {
    expect(roundSeconds(60, 15, 'up')).toBe(15 * 60)
    expect(roundSeconds(14 * 60, 15, 'down')).toBe(0)
  })

  it('leaves an exact multiple alone in every direction', () => {
    for (const d of ['nearest', 'up', 'down'] as const) {
      expect(roundSeconds(30 * 60, 15, d)).toBe(30 * 60)
    }
  })

  it('does nothing when rounding is off', () => {
    expect(roundSeconds(437, 0, 'nearest')).toBe(437)
  })
})

function draft(over: Partial<Draft> = {}): Draft {
  return {
    jobcodeId: 7,
    startedAt: null,
    endedAt: null,
    durationSeconds: 3600,
    entryDate: '2026-08-05',
    notes: '',
    fields: { '3': 'WM-MKTG' },
    ...over,
  }
}
const required = [{ id: 3, name: '1 - i7 Code' }]

describe('validateDraft', () => {
  it('accepts a complete manual entry', () => {
    expect(validateDraft(draft(), required)).toBeNull()
  })

  it('asks for a job code first', () => {
    expect(validateDraft(draft({ jobcodeId: null }), required)).toBe('Pick a job code.')
  })

  it('names the required field that is missing, rather than saying "invalid"', () => {
    expect(validateDraft(draft({ fields: {} }), required)).toBe('1 - i7 Code is required.')
  })

  it('treats an empty string as missing, not as an answer', () => {
    expect(validateDraft(draft({ fields: { '3': '' } }), required)).toBe('1 - i7 Code is required.')
  })

  it('refuses an end that is not after the start', () => {
    const d = draft({ startedAt: '2026-08-05T13:00:00Z', endedAt: '2026-08-05T13:00:00Z' })
    expect(validateDraft(d, required)).toBe('The end has to come after the start.')
  })

  it('refuses a clock somebody forgot to stop', () => {
    const d = draft({ startedAt: '2026-08-05T13:00:00Z', endedAt: '2026-08-06T14:00:00Z' })
    expect(validateDraft(d, required)).toBe('That is longer than a day. Check the times.')
  })

  it('refuses a manual entry longer than a day too', () => {
    expect(validateDraft(draft({ durationSeconds: 25 * 3600 }), required)).toBe('That is longer than a day. Check the hours.')
  })

  it('refuses a manual entry with no duration', () => {
    expect(validateDraft(draft({ durationSeconds: 0 }), required)).toBe('Enter how long it took.')
  })

  it('accepts exactly 24 hours, since the limit is what is longer than a day', () => {
    expect(validateDraft(draft({ durationSeconds: 24 * 3600 }), required)).toBeNull()
  })

  it('refuses a date that is not a date', () => {
    expect(validateDraft(draft({ entryDate: '5 August' }), required)).toBe('Pick a date.')
  })

  it('needs no required fields when none are configured', () => {
    expect(validateDraft(draft({ fields: {} }), [])).toBeNull()
  })
})

describe('overlaps', () => {
  const a = { startedAt: '2026-08-05T13:00:00Z', endedAt: '2026-08-05T15:00:00Z' }

  it('sees a real overlap', () => {
    expect(overlaps(a, { startedAt: '2026-08-05T14:00:00Z', endedAt: '2026-08-05T16:00:00Z' })).toBe(true)
  })

  it('does not call touching ends an overlap', () => {
    expect(overlaps(a, { startedAt: '2026-08-05T15:00:00Z', endedAt: '2026-08-05T16:00:00Z' })).toBe(false)
  })

  it('sees one entry swallowing another', () => {
    expect(overlaps(a, { startedAt: '2026-08-05T13:30:00Z', endedAt: '2026-08-05T14:00:00Z' })).toBe(true)
  })

  it('says no when either side is a manual entry with no times', () => {
    expect(overlaps(a, { startedAt: null, endedAt: null })).toBe(false)
  })

  it('says no when the other entry is still running', () => {
    expect(overlaps(a, { startedAt: '2026-08-05T14:00:00Z', endedAt: null })).toBe(false)
  })
})

describe('wallToInstant', () => {
  it('reads a summer time as EDT, four hours behind UTC', () => {
    expect(wallToInstant('2026-08-05', '09:00', NY)).toBe('2026-08-05T13:00:00.000Z')
  })

  it('reads a winter time as EST, five hours behind', () => {
    expect(wallToInstant('2026-01-15', '09:00', NY)).toBe('2026-01-15T14:00:00.000Z')
  })

  it('gets the hour either side of the spring change right', () => {
    // 2026-03-08 is when the US springs forward at 02:00 local.
    expect(wallToInstant('2026-03-08', '01:00', NY)).toBe('2026-03-08T06:00:00.000Z')
    expect(wallToInstant('2026-03-08', '03:00', NY)).toBe('2026-03-08T07:00:00.000Z')
  })

  it('gets the hour either side of the autumn change right', () => {
    // 2026-11-01, falls back at 02:00 local.
    expect(wallToInstant('2026-11-01', '00:30', NY)).toBe('2026-11-01T04:30:00.000Z')
    expect(wallToInstant('2026-11-01', '03:00', NY)).toBe('2026-11-01T08:00:00.000Z')
  })

  it('round-trips back to the day and time it was given', () => {
    const iso = wallToInstant('2026-08-05', '17:45', NY)!
    expect(dateInZone(new Date(iso), NY)).toBe('2026-08-05')
    expect(timeInZone(new Date(iso), NY)).toBe('17:45')
  })

  it('round-trips on a winter date too', () => {
    const iso = wallToInstant('2026-12-24', '23:15', NY)!
    expect(dateInZone(new Date(iso), NY)).toBe('2026-12-24')
    expect(timeInZone(new Date(iso), NY)).toBe('23:15')
  })

  it('handles midnight without rolling to the next day', () => {
    const iso = wallToInstant('2026-08-05', '00:00', NY)!
    expect(dateInZone(new Date(iso), NY)).toBe('2026-08-05')
    expect(timeInZone(new Date(iso), NY)).toBe('00:00')
  })

  it('refuses malformed input instead of guessing', () => {
    expect(wallToInstant('5 August', '09:00', NY)).toBeNull()
    expect(wallToInstant('2026-08-05', '9am', NY)).toBeNull()
  })
})
