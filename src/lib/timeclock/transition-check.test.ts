import { describe, it, expect } from 'vitest'
import { buildTransition, periodOf, personProblems, readEntry, reminderText, sortRows, summarize, type CheckContext, type CheckEntry, type CheckJob } from './transition-check'

// The transition report (27 October 2026): TSheets entries from the switch
// date, as recorded and as the portal reads them in the 2026 structure. TSheets
// keeps its old jobs and fields (owner, 29 October 2026): they are translated.

const job = (j: Partial<CheckJob> & Pick<CheckJob, 'id' | 'name'>): CheckJob => ({
  path: j.name, parentId: null, kind: 'regular', billable: false, isFolder: false, structure: 2, level: 'project', ...j,
})
const JOBS: CheckJob[] = [
  job({ id: 1, name: 'COE Group', level: 'client', isFolder: true, billable: true }),
  job({ id: 2, name: 'Africa', parentId: 1, level: 'division', isFolder: true, billable: true, path: 'COE Group › Africa' }),
  job({ id: 3, name: 'HopeFor.Africa', parentId: 2, billable: true, path: 'COE Group › Africa › HopeFor.Africa' }),
  job({ id: 4, name: 'True North Internal', level: 'client', isFolder: true }),
  job({ id: 5, name: 'TN General', parentId: 4, path: 'True North Internal › TN General' }),
  job({ id: 10, name: 'Content', parentId: 11, structure: 1, level: null, billable: true, path: '2 - i7 Marketing › Content', client2026: 'i7 Marketing', topName: '2 - i7 Marketing' }),
  job({ id: 11, name: '2 - i7 Marketing', structure: 1, level: null, isFolder: true, client2026: 'i7 Marketing', topName: '2 - i7 Marketing' }),
  job({ id: 13, name: 'SEO', parentId: 12, structure: 1, level: null, path: '1 - True North › SEO', client2026: 'True North Internal', topName: '1 - True North' }),
  job({ id: 15, name: 'Translation', parentId: 14, structure: 1, level: null, path: 'Adventist Messengers/HFA › Translation', client2026: 'COE Group', topName: 'Adventist Messengers/HFA' }),
  job({ id: 17, name: 'Odd job', parentId: 16, structure: 1, level: null, path: 'Mystery › Odd job', client2026: null, topName: 'Mystery' }),
  job({ id: 20, name: 'Vacation', kind: 'pto', structure: 1, level: null }),
]
const ctx: CheckContext = {
  jobs: new Map(JOBS.map(j => [j.id, j])),
  fieldLabels: new Map([['7', '1 Company'], ['8', '3 Activity'], ['9', '2 Project'], ['6', '1 - i7 Code'], ['4', '4 Billable'], ['5', 'Tasks'], ['50', 'Activity']]),
  activityFieldId: '50',
  oldKeys: { company: '7', activity: '8', project: '9', code: '6', billable: '4', tasks: '5' },
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

  it('translates an old TSheets job: the client by its Project, the Activity, Billable as recorded', () => {
    const r = readEntry(entry({ jobcodeId: 13, fields: { '9': 'AAAF', '7': 'True North', '8': 'SEO Research', '4': 'yes' } }), ctx)
    expect(r.portal).toEqual({ timeOff: false, client: 'COE Group', division: 'Seeker Outreach', project: 'AAAF', activity: 'SEO: Research', billable: true })
    expect(r.problems).toEqual([])
    expect(r.tsheets.fields).toContainEqual({ label: '3 Activity', value: 'SEO Research' })
  })

  it('translates an i7 job by its code, and flags one without a code', () => {
    const r = readEntry(entry({ jobcodeId: 10, fields: { '6': 'WM-MKTG', '8': 'WebDev', '4': 'no' } }), ctx)
    expect(r.portal).toMatchObject({ client: 'i7 Marketing', division: 'Wagner Meters', project: 'WM-MKTG', activity: 'Web Dev & Systems', billable: false })
    expect(r.problems).toEqual([])
    expect(readEntry(entry({ jobcodeId: 10, fields: { '8': 'WebDev' } }), ctx).problems).toEqual(['no-code'])
    expect(readEntry(entry({ jobcodeId: 10, fields: { '6': '1 None', '8': 'WebDev' } }), ctx).problems).toEqual(['no-code'])
  })

  it('reads the HFA folder as Africa › HopeFor.Africa, and the Activity from Tasks when Activity is empty', () => {
    const r = readEntry(entry({ jobcodeId: 15, fields: { '5': 'Translation: Review/Edit' } }), ctx)
    expect(r.portal).toMatchObject({ client: 'COE Group', division: 'Africa', project: 'HopeFor.Africa', activity: 'Content: Translation' })
    expect(r.problems).toEqual([])
  })

  it('flags the gaps: no 2026 client, an Activity the table does not know, none at all, Notes', () => {
    expect(readEntry(entry({ jobcodeId: 17, fields: { '8': 'WebDev' } }), ctx).problems).toEqual(['no-client'])
    expect(readEntry(entry({ jobcodeId: 13, fields: { '9': 'In-House', '7': 'COE', '8': 'Basket weaving' } }), ctx).problems).toEqual(['activity-unknown'])
    expect(readEntry(entry({ jobcodeId: 13, fields: { '9': 'In-House', '7': 'COE' } }), ctx).problems).toEqual(['no-activity'])
    expect(readEntry(entry({ jobcodeId: 13, fields: { '9': 'In-House', '7': 'COE', '8': 'Other (indicate in Notes)' } }), ctx).problems).toEqual(['no-notes'])
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
    expect(v.summary.byKind).toMatchObject({ 'no-job': 1, 'no-notes': 1, 'no-client': 0 })
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

describe('the reminder (Remind)', () => {
  const noActivity = (date: string) => readEntry(entry({ date, jobcodeId: 13, fields: { '9': 'In-House', '7': 'COE' } }), ctx)

  it('lists what the person can fix, with what to change, oldest first, and leaves out the fine ones and the admin\'s gaps', () => {
    const rows = [
      readEntry(entry({ date: '2026-11-03', jobcodeId: 5, fields: { '50': 'Meeting: Other' }, seconds: 1800 }), ctx),
      readEntry(entry({ date: '2026-11-02', jobcodeId: 10, fields: { '8': 'WebDev' } }), ctx),
      readEntry(entry({ date: '2026-11-02', jobcodeId: 17, fields: { '8': 'WebDev' } }), ctx),
      readEntry(entry({ date: '2026-11-02', jobcodeId: null }), ctx),
      readEntry(entry({ date: '2026-11-02', notes: 'Clip' }), ctx),
    ]
    expect(reminderText(rows)).toEqual({
      title: '2 of your TSheets entries need fixing in QuickBooks Time',
      body: 'Mon, Nov 2, 1h 00m, 2 - i7 Marketing › Content: pick the "1 - i7 Code". '
        + 'Tue, Nov 3, 0h 30m, True North Internal › TN General: add Notes (Meeting: Other asks for them). '
        + 'Fix them in QuickBooks Time; the portal reads the change on its next import.',
    })
  })

  it('keeps an admin\'s gap out of what the person is told', () => {
    expect(personProblems(readEntry(entry({ jobcodeId: null }), ctx))).toEqual([])
    expect(personProblems(readEntry(entry({ jobcodeId: 17, fields: { '8': 'Basket weaving' } }), ctx))).toEqual([])
  })

  it('lists the oldest 15 and says how many more', () => {
    const rows = Array.from({ length: 17 }, (_, i) => noActivity(`2026-11-${String(i + 2).padStart(2, '0')}`))
    const { title, body } = reminderText(rows)
    expect(title).toBe('17 of your TSheets entries need fixing in QuickBooks Time')
    expect(body.match(/pick the "3 Activity"/g)).toHaveLength(15)
    expect(body).toContain('Mon, Nov 16, 1h 00m, 1 - True North › SEO: pick the "3 Activity". And 2 more. Fix them in QuickBooks Time')
  })

  it('says one entry in the singular', () => {
    expect(reminderText([noActivity('2026-11-02')])).toEqual({
      title: 'One of your TSheets entries needs fixing in QuickBooks Time',
      body: 'Mon, Nov 2, 1h 00m, 1 - True North › SEO: pick the "3 Activity". Fix it in QuickBooks Time; the portal reads the change on its next import.',
    })
  })
})
