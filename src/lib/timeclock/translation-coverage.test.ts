import { describe, expect, it } from 'vitest'
import { coverage, coverageText, type Used } from './translation-coverage'

const u = (field: Used['field'], value: string, hours = 10): Used => ({ field, value, hours, entries: hours > 0 ? 3 : 0, lastDay: '2026-10-09' })

describe('translation table coverage', () => {
  it('finds a value the table does not know, ignoring case and spacing', () => {
    const r = coverage([u('2 Project', ' aaaf '), u('2 Project', 'New Client', 40), u('3 Activity', 'Brand new activity', 5)])
    expect(r.missing.map(l => l.value)).toEqual(['New Client', 'Brand new activity'])
    expect(r.covered).toBe(1)
  })
  it('reads a name with a doubled space, as TSheets has "2 -  i7 Marketing"', () => {
    expect(coverage([u('Job', '2 -  i7 Marketing')]).missing).toEqual([])
  })
  it('knows an i7 code by its prefix, and flags one that is not an i7 code', () => {
    const r = coverage([u('1 - i7 Code', 'WMFL-MKTG'), u('1 - i7 Code', 'XYZ-MKTG'), u('1 - i7 Code', '1 None')])
    expect(r.missing.map(l => l.value)).toEqual(['XYZ-MKTG'])
  })
  it('counts the values decided on Oct 29 as covered, and skips values never used', () => {
    const r = coverage([u('3 Activity', 'Training', 524), u('3 Activity', 'Fundraising', 632), u('Job', '1 - True North', 21000), u('Tasks', 'Translation: Review/Edit', 999), u('2 Project', 'Ghost', 0)])
    expect(r.toConfirm).toEqual([])
    expect(r.missing).toEqual([])
    expect(r.covered).toBe(4)
  })
  it('says so when nothing is missing', () => {
    expect(coverageText(coverage([u('2 Project', 'AAAF')]), '2026-01-01')).toContain('Nothing is missing')
  })
})
