import { describe, it, expect } from 'vitest'
import { monthsToImport, toEntry, type Maps } from './import'
import { endOfMonth } from './runner'
import type { SourceTimesheet } from './source'

const maps: Maps = {
  personByTsheetsUser: new Map([[125360, 'person-amy'], [1239615, 'person-joy']]),
  jobcodeByExternal: new Map([[21152466, 7], [1606200, 9], [26226744, 11]]),
  fieldByExternal: new Map([[129628, 3], [19156, 5]]),
}
// 7 = a regular client code, 9 = Vacation (pto), 11 = Jury duty (unpaid)
const kinds = new Map<number, string>([[7, 'regular'], [9, 'pto'], [11, 'unpaid']])

function sheet(over: Partial<SourceTimesheet> = {}): SourceTimesheet {
  return {
    id: 1, user_id: 125360, jobcode_id: 21152466,
    start: '2026-03-02T09:00:00-05:00', end: '2026-03-02T11:30:00-05:00',
    duration: 9000, date: '2026-03-02', type: 'regular', state: 'APPROVED',
    locked: 0, on_the_clock: false, ...over,
  }
}

describe('monthsToImport', () => {
  it('walks from the first month to the cutoff inclusive', () => {
    expect(monthsToImport('2017-01', '2017-04')).toEqual(['2017-01', '2017-02', '2017-03', '2017-04'])
  })

  it('rolls the year over', () => {
    expect(monthsToImport('2017-11', '2018-02')).toEqual(['2017-11', '2017-12', '2018-01', '2018-02'])
  })

  it('returns the single month when first and cutoff are the same', () => {
    expect(monthsToImport('2026-08', '2026-08')).toEqual(['2026-08'])
  })

  it('returns nothing when the cutoff is before the first month', () => {
    expect(monthsToImport('2026-08', '2026-07')).toEqual([])
  })

  it('covers the whole real range without gaps or repeats', () => {
    const all = monthsToImport('2017-01', '2026-08')
    expect(all.length).toBe(9 * 12 + 8)
    expect(new Set(all).size).toBe(all.length)
    expect(all[0]).toBe('2017-01')
    expect(all[all.length - 1]).toBe('2026-08')
  })
})

describe('endOfMonth', () => {
  it('knows the short months', () => {
    expect(endOfMonth('2026-04')).toBe('2026-04-30')
    expect(endOfMonth('2026-02')).toBe('2026-02-28')
  })

  it('knows leap years', () => {
    expect(endOfMonth('2024-02')).toBe('2024-02-29')
  })

  it('knows December, where a naive +1 month rolls the year', () => {
    expect(endOfMonth('2025-12')).toBe('2025-12-31')
  })
})

describe('toEntry', () => {
  it('maps a normal clocked entry', () => {
    const e = toEntry(sheet(), maps, kinds)!
    expect(e.person_id).toBe('person-amy')
    expect(e.jobcode_id).toBe(7)
    expect(e.kind).toBe('clock')
    expect(e.state).toBe('approved')
    expect(e.duration_seconds).toBe(9000)
    expect(e.entry_date).toBe('2026-03-02')
    expect(e.source).toBe('tsheets')
    expect(e.external_id).toBe(1)
  })

  it('drops an entry whose person cannot be resolved, rather than orphaning it', () => {
    expect(toEntry(sheet({ user_id: 999999 }), maps, kinds)).toBeNull()
  })

  it('keeps an entry whose job code is unknown, since the hours are still real', () => {
    const e = toEntry(sheet({ jobcode_id: 88888 }), maps, kinds)!
    expect(e.jobcode_id).toBeNull()
    expect(e.duration_seconds).toBe(9000)
  })

  it('turns empty start and end into null, not empty strings', () => {
    const e = toEntry(sheet({ start: '', end: '', type: 'manual' }), maps, kinds)!
    expect(e.started_at).toBeNull()
    expect(e.ended_at).toBeNull()
    expect(e.kind).toBe('manual')
  })

  it('calls a PTO job code absence even when it was entered manually', () => {
    const e = toEntry(sheet({ jobcode_id: 1606200, type: 'manual', duration: 28800 }), maps, kinds)!
    expect(e.kind).toBe('absence')
  })

  it('calls unpaid time off absence too', () => {
    expect(toEntry(sheet({ jobcode_id: 26226744 }), maps, kinds)!.kind).toBe('absence')
  })

  it('lets locked win over approved, because locked is the stronger claim', () => {
    expect(toEntry(sheet({ locked: 1, state: 'APPROVED' }), maps, kinds)!.state).toBe('locked')
  })

  it('maps the states we know and leaves the rest open', () => {
    expect(toEntry(sheet({ state: 'SUBMITTED' }), maps, kinds)!.state).toBe('submitted')
    expect(toEntry(sheet({ state: 'UNAPPROVED' }), maps, kinds)!.state).toBe('open')
    expect(toEntry(sheet({ state: undefined }), maps, kinds)!.state).toBe('open')
  })

  it('rekeys custom fields to our own ids and drops the empty ones', () => {
    const e = toEntry(sheet({
      customfields: { '129628': 'WM-MKTG', '19156': 'SEO: Routine', '129636': '', '999': 'ignored' },
    }), maps, kinds)!
    expect(e.fields).toEqual({ '3': 'WM-MKTG', '5': 'SEO: Routine' })
  })

  it('never stores a negative duration', () => {
    expect(toEntry(sheet({ duration: -60 }), maps, kinds)!.duration_seconds).toBe(0)
  })

  it('resolves created_by when it is somebody we know, and null when it is not', () => {
    expect(toEntry(sheet({ created_by_user_id: 1239615 }), maps, kinds)!.created_by).toBe('person-joy')
    expect(toEntry(sheet({ created_by_user_id: 42 }), maps, kinds)!.created_by).toBeNull()
  })
})
