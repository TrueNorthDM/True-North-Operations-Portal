import { describe, expect, it } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { oldSideFor, projects2026For } from './projects'

const tc_jobcodes = [
  { id: 1, parent_id: null, name: 'COE Group', level: 'client', structure: 2 },
  { id: 2, parent_id: 1, name: 'Africa', level: 'division', structure: 2 },
  { id: 3, parent_id: 2, name: 'HopeFor.Africa', level: 'project', structure: 2 },
  { id: 4, parent_id: 2, name: 'Africa General', level: 'project', structure: 2 },
  { id: 5, parent_id: 1, name: 'Seeker Outreach', level: 'division', structure: 2 },
  { id: 6, parent_id: 5, name: 'AAAF', level: 'project', structure: 2 },
  { id: 7, parent_id: 1, name: 'Client: Grants Pass', level: 'division', structure: 2 },
  { id: 8, parent_id: 7, name: 'GP Church', level: 'project', structure: 2 },
  { id: 9, parent_id: null, name: 'Africa', level: null, structure: 1 },
]

describe('Project hours from the switch date (owner, 26 October 2026)', () => {
  it('reads each tracked row from its 2026 projects', async () => {
    const m = await projects2026For(fakeDb({ tc_jobcodes }).db, ['AAAF', 'Africa', 'GP church', 'GP School', 'In-House'])
    expect(m.get('AAAF')).toEqual([6])
    expect(m.get('Africa')).toEqual([3, 4])
    expect(m.get('GP church')).toEqual([8])
    expect(m.get('GP School')).toEqual([])
    expect(m.get('In-House')).toEqual([])
  })
  it('a failed read stops the report', async () => {
    await expect(projects2026For(fakeDb({ tc_jobcodes }, { fail: ['tc_jobcodes'] }).db, ['AAAF'])).rejects.toThrow(/could not read/)
  })
})

describe('the TSheets side of Project hours (owner, 29 October 2026)', () => {
  const jobs = [
    ...tc_jobcodes,
    { id: 20, parent_id: null, name: 'Adventist Messengers/HFA', level: null, structure: 1 },
    { id: 21, parent_id: 20, name: 'Translation', level: null, structure: 1 },
    { id: 22, parent_id: null, name: '1 - True North', level: null, structure: 1 },
  ]
  const tc_field_options = [
    { field_id: 9, label: 'AAAF' }, { field_id: 9, label: 'Africa' }, { field_id: 9, label: 'Rwanda' },
    { field_id: 9, label: 'GP church' }, { field_id: 9, label: 'In-House' }, { field_id: 4, label: 'Rwanda' },
  ]
  it('reads every "2 Project" value the table places inside a row, and the HFA jobs under Africa', async () => {
    const { values, jobIds } = await oldSideFor(fakeDb({ tc_jobcodes: jobs, tc_field_options }).db, 9, ['AAAF', 'Africa', 'GP Church', 'In-House'])
    expect(values.get('AAAF')).toEqual(['AAAF'])
    expect(values.get('Africa')).toEqual(['Africa', 'Rwanda'])
    expect(values.get('GP Church')).toEqual(['GP Church', 'GP church'])
    expect(values.get('In-House')).toEqual(['In-House'])
    expect(jobIds.get('Africa')).toEqual([20, 21])
    expect(jobIds.get('AAAF')).toEqual([])
  })
  it('a failed read stops the report', async () => {
    await expect(oldSideFor(fakeDb({ tc_jobcodes: jobs, tc_field_options }, { fail: ['tc_field_options'] }).db, 9, ['AAAF'])).rejects.toThrow(/could not read/)
  })
})
