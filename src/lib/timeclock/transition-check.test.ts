import { describe, it, expect } from 'vitest'
import { buildTransition, periodOf, readEntry, sortRows, summarize, type CheckContext, type CheckEntry, type CheckJob } from './transition-check'

// The transition report (27 October 2026): TSheets entries from the switch
// date, as recorded and as the portal reads them in the 2026 structure.

const job = (j: Partial<CheckJob> & Pick<CheckJob, 'id' | 'name'>): CheckJob => ({
  path: j.name, parentId: null, kind: 'regular', billable: false, isFolder: false, structure: 2, level: 'project', ...j,
})
const JOBS: CheckJob[] = [
  job({ id: 1, name: 'COE Group', level: 'client', isFolder: true, billable: true }),
  job({ id: 2, name: 'Africa', parentId: 1, level: 'division', isFolder: true, billable: true, path: 'COE Group › Africa' }),
  job({ id: 3, name: 'HopeFor.Africa', parentId: 2, billable: true, path: 'COE Group › Africa › HopeFor.Africa' }),
  job({ id: 4, name: 'True North Internal', level: 'client', isFolder: true }),
  job({ id: 5, name: 'TN General', parentId: 4, path: 'True North Internal › TN General' }),
  job({ id: 10, name: 'Content', parentId: 11, structure: 1, level: null, billable: true, path: '2 - i7 Marketing › Content' }),
  job({ id: 11, name: '2 - i7 Marketing', structure: 1, level: null, isFolder: true }),
  job({ id: 20, name: 'Vacation', kind: 'pto', structure: 1, level: null }),
]
const ctx: CheckContext = {
  jobs: new Map(JOBS.map(j => [j.id, j])),
  fieldLabels: new Map([['7', '1 Company'], ['8', '3 Activity'], ['50', 'Activity']]),
  activityFieldId: '50',
  nameOf: id => ({ p1: 'Wendy Cacka', p2: 'Justus Tsofa' } as Record<string, string>)[id] ?? 'Someone',
}
let n = 0
const entry = (e: Partial<CheckEntry>): CheckEntry => ({
  id: ++n, externalId: 9000 + n, personId: 'p1', date: '2026-11-02', seconds: 3600, jobcodeId: 3, fields: { '50': 'Video' }, notes: null, ...e,
})

describe('reading one TSheets entry', () => {
  it('reads a 2026 project as Client, Division, Project, Activity and the project\'s Billable', () => {
    const r = readEntry(entry({ fields: { '50': 'Video', '7': 'COE' }, notes: 'Clip' }), ctx)
    expect(r.portal).toEqual({ timeOff: false, client: 'COE Group', division: 'Africa', project: 'HopeFor.Africa', activity: 'Video', billable: true })
    expect(r.problems).toEqual([])
    expect(r.tsheets).toEqual({ job: 'COE Group › Africa › HopeFor.Africa', fields: [{ label: '1 Company', value: 'COE' }, { label: 'Activity', value: 'Video' }], notes: 'Clip' })
    expect(r.person).toBe('Wendy Cacka')
  })

  it('reads a project right under its client (True North Internal) with no division', () => {
    const r = readEntry(entry({ jobcodeId: 5 }), ctx)
    expect(r.portal).toMatchObject({ client: 'True North Internal', division: null, project: 'TN General', billable: false })
    expect(r.problems).toEqual([])
  })

  it('flags an entry with no job', () => {
    const r = readEntry(entry({ jobcodeId: null }), ctx)
    expect(r.problems).toEqual(['no-job'])
    expect(r.tsheets.job).toBeNull()
  })

  it('flags an entry whose job the catalogue does not know as no job', () => {
    expect(readEntry(entry({ jobcodeId: 999 }), ctx).problems).toEqual(['no-job'])
  })

  it('flags an old TSheets job used after the switch, and reads nothing of the 2026 structure from it', () => {
    const r = readEntry(entry({ jobcodeId: 10, fields: { '8': 'Writing' } }), ctx)
    expect(r.problems).toEqual(['old-job'])
    expect(r.portal).toMatchObject({ client: null, division: null, project: null, activity: null, billable: null })
    expect(r.tsheets.fields).toEqual([{ label: '3 Activity', value: 'Writing' }])
  })

  it('flags a client or a division instead of a project', () => {
    const r = readEntry(entry({ jobcodeId: 2 }), ctx)
    expect(r.problems).toEqual(['folder'])
    expect(r.portal).toMatchObject({ client: 'COE Group', division: 'Africa', project: null, billable: null })
  })

  it('flags a 2026 project with no Activity', () => {
    expect(readEntry(entry({ fields: {} }), ctx).problems).toEqual(['no-activity'])
    expect(readEntry(entry({ fields: { '50': '  ' } }), ctx).problems).toEqual(['no-activity'])
  })

  it('flags Other and Meeting: Other without Notes, and not with them', () => {
    expect(readEntry(entry({ fields: { '50': 'Other' } }), ctx).problems).toEqual(['no-notes'])
    expect(readEntry(entry({ fields: { '50': 'Meeting: Other' }, notes: ' ' }), ctx).problems).toEqual(['no-notes'])
    expect(readEntry(entry({ fields: { '50': 'Meeting: Other' }, notes: 'Board call' }), ctx).problems).toEqual([])
    expect(readEntry(entry({ fields: { '50': 'Meeting: Status' } }), ctx).problems).toEqual([])
  })

  it('leaves time off alone', () => {
    const r = readEntry(entry({ jobcodeId: 20, fields: {} }), ctx)
    expect(r.problems).toEqual([])
    expect(r.portal.timeOff).toBe(true)
  })

  it('labels a field it does not know by its id', () => {
    expect(readEntry(entry({ fields: { '50': 'Video', '99': 'x' } }), ctx).tsheets.fields).toContainEqual({ label: 'Field 99', value: 'x' })
  })

  it('reads no Activity while the 2026 field does not exist', () => {
    expect(readEntry(entry({}), { ...ctx, activityFieldId: null }).problems).toEqual(['no-activity'])
  })
})

describe('the period', () => {
  it('starts on the switch date by default and never before it', () => {
    expect(periodOf('2026-11-01')).toEqual({ from: '2026-11-01', to: null })
    expect(periodOf('2026-11-01', '2026-10-01', '2026-11-30')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodOf('2026-11-01', '2026-11-10', null)).toEqual({ from: '2026-11-10', to: null })
  })

  it('drops a day that is not one, and an end before the start', () => {
    expect(periodOf('2026-11-01', 'soon', '2026-13-45')).toEqual({ from: '2026-11-01', to: null })
    expect(periodOf('2026-11-01', '2026-11-10', '2026-11-05')).toEqual({ from: '2026-11-10', to: null })
  })
})

describe('the list', () => {
  const entries = [
    entry({ id: 101, date: '2026-11-03', personId: 'p1' }),
    entry({ id: 102, date: '2026-11-02', personId: 'p2', jobcodeId: null, seconds: 1800 }),
    entry({ id: 103, date: '2026-11-04', personId: 'p2', fields: { '50': 'Other' }, seconds: 7200 }),
    entry({ id: 104, date: '2026-10-30', personId: 'p1' }),
  ]

  it('lists problems first, then the newest day', () => {
    const v = buildTransition(entries, ctx, { from: '2026-11-01', to: null, personId: null, onlyProblems: false })
    expect(v.rows.map(r => r.id)).toEqual([103, 102, 101])
  })

  it('counts entries, hours and problems in the period', () => {
    const v = buildTransition(entries, ctx, { from: '2026-11-01', to: null, personId: null, onlyProblems: true })
    expect(v.rows.map(r => r.id)).toEqual([103, 102])
    expect(v.summary).toMatchObject({ entries: 3, seconds: 3600 + 1800 + 7200, problems: 2 })
    expect(v.summary.byKind).toMatchObject({ 'no-job': 1, 'no-notes': 1, 'old-job': 0 })
  })

  it('filters by person and the end of the period, and offers the people of the period', () => {
    const v = buildTransition(entries, ctx, { from: '2026-11-01', to: '2026-11-03', personId: 'p2', onlyProblems: false })
    expect(v.rows.map(r => r.id)).toEqual([102])
    expect(v.people).toEqual([{ id: 'p2', name: 'Justus Tsofa' }, { id: 'p1', name: 'Wendy Cacka' }])
  })

  it('sorts and sums on their own', () => {
    const rows = entries.map(e => readEntry(e, ctx))
    expect(sortRows(rows)[0].problems.length).toBeGreaterThan(0)
    expect(summarize([]).entries).toBe(0)
  })
})
