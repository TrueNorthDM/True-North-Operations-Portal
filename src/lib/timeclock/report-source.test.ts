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
