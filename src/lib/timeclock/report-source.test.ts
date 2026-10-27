import { describe, it, expect } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { i7JobcodeIdsHere, loadI7EntriesHere } from './report-source'
import { I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'

const jobcodes = [
  { id: 1, parent_id: null, external_id: I7_PARENT_JOBCODE_ID, name: 'i7' },
  { id: 2, parent_id: 1, external_id: 99, name: 'Content' },
  { id: 3, parent_id: null, external_id: 5, name: 'True North' },
]

describe('which hours are i7 (audit, 9 October 2026: no read turns into $0)', () => {
  it('walks the i7 tree', async () => {
    expect([...await i7JobcodeIdsHere(fakeDb({ tc_jobcodes: jobcodes }).db)].sort()).toEqual([1, 2])
  })

  it('a missing i7 root is an error, not a month with no hours', async () => {
    await expect(i7JobcodeIdsHere(fakeDb({ tc_jobcodes: jobcodes.slice(2) }).db)).rejects.toThrow(/i7 job code is missing/)
  })

  it('a failed read of the job codes or the code fields is an error too', async () => {
    await expect(i7JobcodeIdsHere(fakeDb({ tc_jobcodes: jobcodes }, { fail: ['tc_jobcodes'] }).db)).rejects.toThrow(/could not be read/)
    await expect(loadI7EntriesHere(fakeDb({ tc_jobcodes: jobcodes }, { fail: ['tc_fields'] }).db, '2026-09-01', '2026-09-30')).rejects.toThrow(/could not be read/)
  })
})

describe('the 2026 structure in the i7 report (owner, 26 October 2026)', () => {
  it('reads an i7 project as its code, beside the old field on old entries', async () => {
    const tc_jobcodes = [
      ...jobcodes.map(j => ({ ...j, structure: 1, level: null })),
      { id: 10, parent_id: null, external_id: null, name: 'i7 Marketing', structure: 2, level: 'client' },
      { id: 11, parent_id: 10, external_id: null, name: 'Moisture Meters', structure: 2, level: 'division' },
      { id: 12, parent_id: 11, external_id: null, name: 'MME-MKTG', structure: 2, level: 'project' },
      { id: 20, parent_id: null, external_id: null, name: 'COE Group', structure: 2, level: 'client' },
      { id: 21, parent_id: 20, external_id: null, name: 'Africa', structure: 2, level: 'division' },
      { id: 22, parent_id: 21, external_id: null, name: 'Africa General', structure: 2, level: 'project' },
    ]
    const tc_fields = [
      { id: 7, external_id: 129628, structure: 1 },
      { id: 8, external_id: 19156, structure: 1 },
      { id: 9, external_id: null, structure: 2 },
    ]
    const tc_entries = [
      { id: 1, person_id: 'p', jobcode_id: 2, duration_seconds: 3600, entry_date: '2026-10-30', fields: { 7: 'BE-MKTG', 8: 'WebDev' } },
      { id: 2, person_id: 'p', jobcode_id: 12, duration_seconds: 1800, entry_date: '2026-11-02', fields: { 9: 'Admin' } },
      { id: 3, person_id: 'p', jobcode_id: 22, duration_seconds: 900, entry_date: '2026-11-02', fields: { 9: 'Admin' } },
    ]
    const out = await loadI7EntriesHere(fakeDb({ tc_jobcodes, tc_fields, tc_entries }).db, '2026-10-01', '2026-11-30')
    expect(out.map(e => [e.i7Code, e.activity, e.duration])).toEqual([['BE-MKTG', 'WebDev', 3600], ['MME-MKTG', 'Admin', 1800]])
  })
})
