import { describe, expect, it } from 'vitest'
import { catalogueRows, groupsOf } from './job-catalogue'
import type { Job } from './clocky-context'

const job = (j: Partial<Job> & { id: number; name: string }): Job => ({
  path: j.name, short: j.name, parentId: null, folderId: null, kind: 'regular', active: true, isI7: false, isFolder: false, selectable: true,
  whenToUse: null, billable: false, defaultCompany: null, defaultProject: null, sortOrder: null, imported: true, editedInPortal: false, ...j,
})
const jobs = new Map([
  job({ id: 1, name: '2 - i7 Marketing', isFolder: true, sortOrder: 1 }),
  job({ id: 2, name: 'Content', parentId: 1, sortOrder: 2 }),
  job({ id: 3, name: 'Administrative', parentId: 1, sortOrder: 1 }),
  job({ id: 4, name: 'Retired', parentId: 1, active: false }),
  job({ id: 5, name: 'Switched off here', parentId: 1, active: false, editedInPortal: true }),
  job({ id: 6, name: 'Deep', parentId: 2 }),
  job({ id: 7, name: 'A.org Job', whenToUse: 'Adventist.org work.' }),
  job({ id: 8, name: 'Vacation', kind: 'pto' }),
].map(j => [j.id, j]))

describe('the job catalogue tree (11A)', () => {
  it('lists folders and their jobs in the order set, top level by order then name', () => {
    expect(catalogueRows({ jobs }).map(r => `${r.depth}:${r.name}`)).toEqual([
      '0:2 - i7 Marketing', '1:Administrative', '1:Content', '1:Switched off here', '0:A.org Job',
    ])
  })
  it('leaves out retired QuickBooks Time codes, time off and deeper levels', () => {
    const names = catalogueRows({ jobs }).map(r => r.name)
    expect(names).not.toContain('Retired')
    expect(names).not.toContain('Vacation')
    expect(names).not.toContain('Deep')
  })
})

describe('"Which job?" (11D)', () => {
  it('groups active jobs by folder, top-level jobs under Other jobs', () => {
    const g = groupsOf(catalogueRows({ jobs }))
    expect(g.map(x => [x.folder, x.rows.map(r => r.name)])).toEqual([
      ['2 - i7 Marketing', ['Administrative', 'Content']],
      ['Other jobs', ['A.org Job']],
    ])
    expect(g[1].rows[0].use).toBe('Adventist.org work.')
  })
})
