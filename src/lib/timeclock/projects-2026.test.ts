import { describe, expect, it } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { projects2026For } from './projects'

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
