import { describe, expect, it } from 'vitest'
import { MAX_HOURS_PER_ENTRY, manualAdds, toSeconds, validateManualEntry } from './manual-entry'

const TODAY = '2026-08-26'
const good = { personId: 'p1', entryDate: '2026-08-01', jobcodeId: 7, hours: 4, i7Code: 'WM-SEO', activity: 'SEO: Routine' }

describe('validateManualEntry', () => {
  it('accepts a complete entry', () => {
    expect(validateManualEntry(good, TODAY)).toBeNull()
  })

  it('needs somebody for the hours to belong to', () => {
    expect(validateManualEntry({ ...good, personId: '' }, TODAY)).toBe('no-person')
  })

  it('needs a job code, since that is what puts it in the report', () => {
    expect(validateManualEntry({ ...good, jobcodeId: undefined }, TODAY)).toBe('no-jobcode')
  })

  it('refuses a date that is not one', () => {
    expect(validateManualEntry({ ...good, entryDate: '08/01/2026' }, TODAY)).toBe('bad-date')
  })

  // A future day is a typo in the year or the month, every time.
  it('refuses work that has not happened yet', () => {
    expect(validateManualEntry({ ...good, entryDate: '2026-09-01' }, TODAY)).toBe('future-date')
  })

  it('accepts today itself', () => {
    expect(validateManualEntry({ ...good, entryDate: TODAY }, TODAY)).toBeNull()
  })

  // This gets multiplied by an hourly rate and printed on a client invoice.
  it('refuses zero, negative and impossible hours', () => {
    expect(validateManualEntry({ ...good, hours: 0 }, TODAY)).toBe('bad-hours')
    expect(validateManualEntry({ ...good, hours: -3 }, TODAY)).toBe('bad-hours')
    expect(validateManualEntry({ ...good, hours: MAX_HOURS_PER_ENTRY + 1 }, TODAY)).toBe('bad-hours')
  })

  it('allows a full day', () => {
    expect(validateManualEntry({ ...good, hours: MAX_HOURS_PER_ENTRY }, TODAY)).toBeNull()
  })
})

describe('toSeconds', () => {
  it('converts the units people read off an invoice', () => {
    expect(toSeconds(1.5)).toBe(5400)
  })

  // Rounded once, at the boundary, so a quarter hour does not drift.
  it('rounds a repeating fraction rather than truncating it', () => {
    expect(toSeconds(1 / 3)).toBe(1200)
  })
})

describe('manualAdds (the allowance limit, owner 25 October 2026)', () => {
  it('groups a batch by person, each line on its own day, in seconds', () => {
    const adds = manualAdds([
      { personId: 'p1', entryDate: '2026-09-30', hours: 2.5 },
      { personId: 'p2', entryDate: '2026-10-01', hours: 1 },
      { personId: 'p1', entryDate: '2026-10-01', hours: 0.25 },
    ])
    expect([...adds.keys()]).toEqual(['p1', 'p2'])
    expect(adds.get('p1')).toEqual([{ day: '2026-09-30', seconds: 9000 }, { day: '2026-10-01', seconds: 900 }])
    expect(adds.get('p2')).toEqual([{ day: '2026-10-01', seconds: 3600 }])
  })

  it('is empty for an empty batch', () => {
    expect(manualAdds([]).size).toBe(0)
  })
})
