import { describe, it, expect } from 'vitest'
import {
  workingDays, requestHours, validateAbsence, absenceOverlaps, absenceStatus,
  type AbsenceDraft,
} from './absence'

describe('workingDays', () => {
  it('leaves the weekend out', () => {
    // Friday 2026-08-07 to Monday 2026-08-10 is two days off, not four.
    expect(workingDays('2026-08-07', '2026-08-10')).toEqual(['2026-08-07', '2026-08-10'])
  })

  it('counts a single weekday as one day', () => {
    expect(workingDays('2026-08-05', '2026-08-05')).toEqual(['2026-08-05'])
  })

  it('returns nothing for a range that is only a weekend', () => {
    expect(workingDays('2026-08-08', '2026-08-09')).toEqual([])
  })

  it('gives five days for a full week', () => {
    expect(workingDays('2026-08-03', '2026-08-09')).toHaveLength(5)
  })

  it('crosses a month and a year without losing days', () => {
    expect(workingDays('2026-12-30', '2027-01-04')).toEqual(
      ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-04'],
    )
  })

  it('refuses a backwards range instead of looping forever', () => {
    expect(workingDays('2026-08-10', '2026-08-01')).toEqual([])
  })

  it('refuses anything that is not a date', () => {
    expect(workingDays('next friday', '2026-08-10')).toEqual([])
  })

  it('stops rather than walking a decade', () => {
    expect(workingDays('2026-01-01', '2036-01-01').length).toBeLessThanOrEqual(367)
  })
})

describe('requestHours', () => {
  const base: AbsenceDraft = {
    jobcodeId: 9, startDate: '2026-08-03', endDate: '2026-08-07', hoursPerDay: 8, reason: '',
  }

  it('multiplies working days by the hours asked for', () => {
    expect(requestHours(base)).toBe(40)
  })

  it('honours a half day', () => {
    expect(requestHours({ ...base, hoursPerDay: 4 })).toBe(20)
  })

  it('is zero when the range holds no working day', () => {
    expect(requestHours({ ...base, startDate: '2026-08-08', endDate: '2026-08-09' })).toBe(0)
  })
})

function draft(over: Partial<AbsenceDraft> = {}): AbsenceDraft {
  return {
    jobcodeId: 9,
    startDate: '2026-08-10',
    endDate: '2026-08-14',
    hoursPerDay: 8,
    reason: '',
    ...over,
  }
}

describe('validateAbsence', () => {
  it('accepts an ordinary week off', () => {
    expect(validateAbsence(draft())).toBeNull()
  })

  it('asks for the kind of time off first', () => {
    expect(validateAbsence(draft({ jobcodeId: null }))).toBe('Pick a kind of time off.')
  })

  it('refuses a range that ends before it starts', () => {
    expect(validateAbsence(draft({ startDate: '2026-08-14', endDate: '2026-08-10' })))
      .toBe('The last day cannot be before the first.')
  })

  it('refuses a weekend-only booking, rather than approving nothing', () => {
    expect(validateAbsence(draft({ startDate: '2026-08-08', endDate: '2026-08-09' })))
      .toBe('That range is only weekends, so there is nothing to book.')
  })

  it('refuses zero and negative hours', () => {
    expect(validateAbsence(draft({ hoursPerDay: 0 }))).toBe('Hours per day has to be more than zero.')
    expect(validateAbsence(draft({ hoursPerDay: -4 }))).toBe('Hours per day has to be more than zero.')
  })

  it('refuses more hours than a day holds', () => {
    expect(validateAbsence(draft({ hoursPerDay: 25 }))).toBe('That is more hours than a day has.')
  })

  it('refuses a range longer than three months', () => {
    expect(validateAbsence(draft({ startDate: '2026-01-01', endDate: '2026-12-31' })))
      .toBe('That is longer than three months. Split it up.')
  })

  it('says nothing about balances, because nobody keeps them', () => {
    // All 26 active people carry a balance of zero in the account, so a check
    // against one would refuse every request ever made.
    expect(validateAbsence(draft({ hoursPerDay: 8 }))).toBeNull()
  })
})

describe('absenceOverlaps', () => {
  const a = { startDate: '2026-08-10', endDate: '2026-08-14' }

  it('sees a real overlap', () => {
    expect(absenceOverlaps(a, { startDate: '2026-08-12', endDate: '2026-08-18' })).toBe(true)
  })

  it('counts a shared single day as an overlap, unlike two clock entries', () => {
    // Days are whole here: sharing the 14th means booking it twice.
    expect(absenceOverlaps(a, { startDate: '2026-08-14', endDate: '2026-08-20' })).toBe(true)
  })

  it('sees one range swallowing another', () => {
    expect(absenceOverlaps(a, { startDate: '2026-08-11', endDate: '2026-08-12' })).toBe(true)
  })

  it('says no when they are apart', () => {
    expect(absenceOverlaps(a, { startDate: '2026-08-17', endDate: '2026-08-21' })).toBe(false)
  })
})

describe('absenceStatus', () => {
  it('lets a waiting or approved request be cancelled', () => {
    expect(absenceStatus('pending').canCancel).toBe(true)
    expect(absenceStatus('approved').canCancel).toBe(true)
  })

  it('does not offer to cancel what is already settled the other way', () => {
    expect(absenceStatus('denied').canCancel).toBe(false)
    expect(absenceStatus('cancelled').canCancel).toBe(false)
  })
})
