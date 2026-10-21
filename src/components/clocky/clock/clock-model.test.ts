import { describe, expect, it } from 'vitest'
import type { ClockChoice, ClockPanelData, PanelField, PanelFolder, PanelJob, RunningEntry } from '@/lib/timeclock/clocky-types'
import {
  breakdown, browseJobs, choiceRow, clockSkew, draftFor, liveTotals, missingOf, overWarn, panelHeader, resumeCard, roundNoteText,
  saveDraftFrom, searchJobs, suggestName, switchChoices, tabTitle, topBarState, zoneCity,
} from './clock-model'

/** Thu, Oct 15, 2026 in New York (EDT, UTC-4). */
const et = (h: number, m = 0, s = 0) => new Date(Date.UTC(2026, 9, 15, h + 4, m, s)).toISOString()
const ms = (iso: string) => Date.parse(iso)

const FIELDS: PanelField[] = [
  { key: 'company', id: '1', label: '1 Company', options: ['True North', 'COE'], required: 'always' },
  { key: 'project', id: '2', label: '2 Project', options: ['In-House', 'NAD'], required: 'always' },
  { key: 'activity', id: '3', label: '3 Activity', options: ['WebDev', 'Translation', 'Other (indicate in Notes)'], required: 'always' },
  { key: 'billable', id: '4', label: '4 Billable', options: ['yes', 'no'], required: 'always' },
  { key: 'code', id: '5', label: '1 - i7 Code', options: ['i7-WEBDVT'], required: 'i7' },
]
const FOLDERS: PanelFolder[] = [{ id: 1, name: '1 - True North', jobIds: [11, 12] }, { id: 2, name: '2 - i7 Marketing', jobIds: [21, 22] }]
const JOBS: PanelJob[] = [
  { id: 11, name: 'Administrative', path: '1 - True North › Administrative', short: 'TN › Administrative', folderId: 1, isI7: false },
  { id: 12, name: 'Web Dev', path: '1 - True North › Web Dev', short: 'TN › Web Dev', folderId: 1, isI7: false },
  { id: 21, name: 'Content', path: '2 - i7 Marketing › Content', short: 'i7 › Content', folderId: 2, isI7: true },
  { id: 22, name: 'Web Dev', path: '2 - i7 Marketing › Web Dev', short: 'i7 › Web Dev', folderId: 2, isI7: true },
  { id: 30, name: 'Adventist Messengers/HFA', path: 'Adventist Messengers/HFA', short: 'HFA', folderId: null, isI7: false },
  { id: 31, name: 'A.org Job', path: 'A.org Job', short: 'A.org Job', folderId: null, isI7: false },
]

const choice = (o: Partial<ClockChoice> & { jobcodeId: number }): ClockChoice => {
  const j = JOBS.find(x => x.id === o.jobcodeId)!
  return { combinationId: null, name: null, path: j.path, short: j.short, isI7: j.isI7, fields: {}, notes: '', label: o.name ?? j.short, activity: '', billable: '', ...o }
}
const WEB = choice({ jobcodeId: 22, combinationId: 1, name: 'i7 Web Dev', activity: 'WebDev', billable: 'yes', fields: { 1: 'True North', 2: 'In-House', 3: 'WebDev', 4: 'yes', 5: 'i7-WEBDVT' } })
const HFA = choice({ jobcodeId: 30, combinationId: 2, name: 'HFA Translation', activity: 'Translation', billable: 'yes', fields: { 3: 'Translation' } })
const RECENT = choice({ jobcodeId: 11, activity: '', billable: 'no' })

const running = (o: Partial<RunningEntry> = {}): RunningEntry => ({
  id: 9, jobcodeId: 22, path: WEB.path, short: WEB.short, label: 'i7 Web Dev', isI7: true, fields: WEB.fields, notes: '',
  startedAt: et(9, 45), startedAtReal: et(9, 52), sessionStartedAt: et(8, 7), windowStartedAt: et(8, 7),
  recordedSeconds: 2 * 3600, roundNote: { recorded: '9:45 AM', real: '9:52 AM' }, missing: [], imported: false, ...o,
})

const data = (o: Partial<ClockPanelData> = {}): ClockPanelData => ({
  me: { personId: 'p', name: 'Arnaldo Oliveira', zone: 'America/New_York', zoneAbbr: 'EDT', level: 'super_admin', leader: true },
  now: et(11, 50, 34), today: '2026-10-15', todayLabel: 'Thu, Oct 15', todaySeconds: 0, weekSeconds: 31.25 * 3600, allowance: null,
  running: null, safety: null, toConfirm: [], resume: WEB, combinations: [WEB, HFA], recents: [RECENT], todayByCombination: [],
  jobs: JOBS, folders: FOLDERS, fields: FIELDS, defaults: { 22: { 1: 'True North', 2: 'In-House', 4: 'yes', 5: 'i7-WEBDVT' } },
  locked: null, period: { start: '2026-10-01', end: '2026-10-31', kind: 'month', label: 'October', full: 'October 2026' },
  firstTime: false, correctionGoesTo: '', ...o,
})

describe('rows and cards', () => {
  it('names a saved combination by its name over its job, a recent by its job over its Activity', () => {
    expect(choiceRow(WEB, true)).toEqual({ title: 'i7 Web Dev', sub: '2 - i7 Marketing › Web Dev · WebDev' })
    expect(choiceRow(RECENT, false)).toEqual({ title: '1 - True North › Administrative', sub: 'No activity' })
  })

  it('writes the Resume card as the prototype does', () => {
    expect(resumeCard(WEB)).toEqual({ title: 'i7 Web Dev', line: '2 - i7 Marketing › Web Dev · WebDev · Billable' })
    expect(resumeCard(RECENT).line).toBe('1 - True North › Administrative · No activity · Not billable')
  })

  it('offers every combination and recent to switch to, but not the one running', () => {
    const rows = switchChoices(data(), running())
    expect(rows.map(r => r.choice.label)).toEqual(['HFA Translation', 'TN › Administrative'])
    expect(rows.map(r => r.saved)).toEqual([true, false])
  })

  it('suggests a combination name from the job', () => {
    expect(suggestName('i7 › Web Dev', true, 'WebDev')).toBe('i7 Web Dev')
    expect(suggestName('HFA', false, 'Translation')).toBe('HFA Translation')
    expect(suggestName('DDI', false, 'Content: Review/Edit')).toBe('DDI Content')
  })

  it('writes the rounding note', () => {
    expect(roundNoteText({ recorded: '9:45 AM', real: '9:52 AM' })).toBe('Counted from 9:45 AM. It started at 9:52 AM; times round to the nearest 15 minutes.')
  })
})

describe('choosing a job', () => {
  it('finds "i7 web" in the path, best match first, under its folder header', () => {
    const rows = searchJobs(JOBS, FOLDERS, 'i7 web')
    expect(rows.map(r => (r.type === 'header' ? `# ${r.label}` : r.label))).toEqual(['# 2 - i7 Marketing', 'Web Dev'])
    expect(rows[1].type === 'job' && rows[1].sub).toBe('2 - i7 Marketing › Web Dev')
  })

  it('puts a leaf that starts with the last word first', () => {
    const rows = searchJobs(JOBS, FOLDERS, 'web').filter(r => r.type === 'job').map(r => r.type === 'job' && r.job.id)
    expect(rows).toEqual([12, 22])
  })

  it('finds nothing for nothing, and nothing for a miss', () => {
    expect(searchJobs(JOBS, FOLDERS, '  ')).toEqual([])
    expect(searchJobs(JOBS, FOLDERS, 'zzz')).toEqual([])
  })

  it('browses the folders and top-level jobs by name, then one folder', () => {
    expect(browseJobs(JOBS, FOLDERS, null).map(r => `${r.type}:${r.label}`)).toEqual([
      'folder:1 - True North', 'folder:2 - i7 Marketing', 'job:A.org Job', 'job:Adventist Messengers/HFA',
    ])
    const first = browseJobs(JOBS, FOLDERS, null)[0]
    expect(first.type === 'folder' && first.sub).toBe('2 jobs')
    expect(browseJobs(JOBS, FOLDERS, 2).map(r => r.label)).toEqual(['Content', 'Web Dev'])
  })
})

describe('drafts', () => {
  it('fills Company, Project, Billable and the i7 Code from the job, marked auto, and leaves Activity', () => {
    const d = draftFor(data(), JOBS[3])
    expect(d.values).toEqual({ 1: 'True North', 2: 'In-House', 3: '', 4: 'yes', 5: 'i7-WEBDVT' })
    expect(d.auto).toEqual({ company: true, project: true, billable: true, code: true })
  })

  it('asks no i7 Code on a job outside i7, and marks nothing auto it could not fill', () => {
    const d = draftFor(data(), JOBS[4], { activity: 'Translation' })
    expect(d.values).toEqual({ 1: '', 2: '', 3: 'Translation', 4: '' })
    expect(d.auto).toEqual({ company: false, project: false, billable: false })
  })

  it('offers the saved name, else a suggestion, when saving a combination', () => {
    expect(saveDraftFrom(data(), { jobId: 22, values: { 3: 'WebDev' }, notes: '' }).name).toBe('i7 Web Dev')
    expect(saveDraftFrom(data(), { jobId: 22, values: {}, notes: '', name: 'Mine', editing: 4 })).toMatchObject({ name: 'Mine', editing: 4 })
  })

  it('knows what is missing, notes included when the Activity asks for them', () => {
    expect(missingOf({ 1: 'True North', 2: 'In-House', 4: 'yes' }, '', FIELDS, true)).toEqual(['activity', 'code'])
    expect(missingOf({ 1: 'a', 2: 'b', 3: 'Other (indicate in Notes)', 4: 'no' }, '', FIELDS, false)).toEqual(['notes'])
  })
})

describe('totals and timers', () => {
  it('keeps counting the running entry on the quarter hour after the data was read', () => {
    const d = data({ running: running(), todaySeconds: 3.75 * 3600, weekSeconds: 35.25 * 3600 })
    // Read at 11:50:34 (counted to 11:45); at 12:08 the entry counts to 12:15.
    expect(liveTotals(d, ms(et(12, 8)))).toEqual({ today: 4.25 * 3600, week: 35.75 * 3600 })
    expect(liveTotals(d, ms(et(11, 50, 34)))).toEqual({ today: 3.75 * 3600, week: 35.25 * 3600 })
  })

  it('draws the day by combination, biggest first, the bars following the real time', () => {
    const d = data({
      running: running(),
      todayByCombination: [{ label: 'TN Admin', seconds: 3600, running: false }, { label: 'i7 Web Dev', seconds: 7200, running: true }],
    })
    const bars = breakdown(d, ms(et(11, 50, 34)))
    expect(bars.map(b => [b.label, b.dur, b.color])).toEqual([['i7 Web Dev', '2h 00m', '#1E9E6A'], ['TN Admin', '1h 00m', '#1E7D7F']])
    expect(bars[0].pct).toBe('100%')
    // 1h against the real 2:05:34 since 9:45.
    expect(parseFloat(bars[1].pct)).toBeCloseTo(47.78, 1)
  })

  it('warns from 4h 30m since the window began, across switches', () => {
    const d = data({ running: running({ sessionStartedAt: et(8), windowStartedAt: et(8) }), safety: { windowStartedAt: et(8), sessionStartedAt: et(8), warnAt: et(12, 30), stopAt: et(13), warn: false, panelText: '' } })
    expect(overWarn(d, ms(et(12, 29, 59)))).toBe(false)
    expect(overWarn(d, ms(et(12, 30)))).toBe(true)
  })

  it('keeps the device clock unless it is really off', () => {
    expect(clockSkew(et(10), ms(et(10)) - 1500)).toBe(0)
    expect(clockSkew(et(10), ms(et(9)))).toBe(3600_000)
  })
})

describe('the top-bar button and the tab', () => {
  it('has four states', () => {
    expect(topBarState(data(), ms(et(8)))).toMatchObject({ kind: 'off', text: 'Clock in', aria: 'Off the clock. Clock in' })
    const on = data({ running: running(), safety: { windowStartedAt: et(8, 7), sessionStartedAt: et(8, 7), warnAt: et(12, 37), stopAt: et(13, 7), warn: false, panelText: '' } })
    expect(topBarState(on, ms(et(11, 50, 34)))).toEqual({ kind: 'on', text: '1:58:34', job: 'i7 › Web Dev', aria: 'On the clock' })
    expect(topBarState(on, ms(et(12, 40))).kind).toBe('over')
    const auto = data({ toConfirm: [{ entryId: 1, path: '', label: '', startedAt: et(8), stoppedAt: et(13), stoppedAtReal: null, date: '2026-10-15', stopWhen: '1:00 PM', text: '', options: [], laterOptions: [] }] })
    expect(topBarState(auto, ms(et(15)))).toMatchObject({ kind: 'auto', text: 'Confirm end time' })
  })

  it('writes the tab title on the quarter hour while the clock runs, and nothing otherwise', () => {
    expect(tabTitle(data({ running: running() }), ms(et(11, 50, 34)))).toBe('2:00 · i7 › Web Dev · True North')
    expect(tabTitle(data(), ms(et(11)))).toBeNull()
  })
})

describe('the header', () => {
  it('says each mode as the prototype does', () => {
    const nowMs = ms(et(11, 50, 34))
    expect(panelHeader('off', { data: data(), nowMs, switching: false, first: false }))
      .toEqual({ title: 'Clocky', sub: 'Thu, Oct 15 · Today 0h 00m · Week 31h 15m', dot: null, back: false })
    expect(panelHeader('on', { data: data({ running: running() }), nowMs, switching: false, first: false }))
      .toMatchObject({ title: 'On the clock since 8:00 AM', sub: 'Thu, Oct 15 · New York time', dot: 'green' })
    expect(panelHeader('choose', { data: data(), nowMs, switching: false, first: true })).toMatchObject({ sub: 'Your first clock in', back: false })
    expect(panelHeader('choose', { data: data(), nowMs, switching: true, first: false })).toMatchObject({ sub: 'Switch to something else', back: true })
    expect(panelHeader('details', { data: data(), nowMs, switching: false, first: false }).sub).toBe('Check the details, then clock in')
  })

  it('names the zone by its city', () => {
    expect(zoneCity('America/New_York')).toBe('New York')
    expect(zoneCity('Africa/Nairobi')).toBe('Nairobi')
  })
})
