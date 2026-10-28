import { describe, expect, it } from 'vitest'
import { SHORTEN_ONLY } from '@/lib/timeclock/scope'
import {
  axisOf, buildGrid, calendarWeeks, checkLine, createSpan, dragSpan, exactDuration, gridChanges, gridEditKey, gridRowKey, gridTemplate,
  groupByDay, hhmmOf, hourTicks, minWidth, periodRange, rangeText, secondsAt, shiftAnchor, snapQuarter, totalsLabel, totalsOf,
  visibleColumns, offeredColumns, hasTsheetsRows, weekStartOf, xOf, zoneCity, DEFAULT_COLUMNS, type GridSource,
} from './model'
import type { EntryView } from '@/lib/timeclock/clocky-types'

const ANCHORS = [{ anchor: '2026-10-04', effectiveFrom: null }]

describe('periods', () => {
  it('runs weeks Sunday to Saturday, as the prototype does', () => {
    expect(weekStartOf('2026-10-15')).toBe('2026-10-11')
    expect(periodRange('week', '2026-10-15', ANCHORS)).toEqual({ from: '2026-10-11', to: '2026-10-17' })
  })
  it('takes pay periods from the anchor, and months whole', () => {
    expect(periodRange('pp', '2026-10-15', ANCHORS)).toEqual({ from: '2026-10-04', to: '2026-10-17' })
    expect(periodRange('month', '2026-10-15', ANCHORS)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('day', '2026-10-15', ANCHORS)).toEqual({ from: '2026-10-15', to: '2026-10-15' })
  })
  it('steps to the period before and after', () => {
    expect(shiftAnchor('week', '2026-10-15', 1, ANCHORS)).toBe('2026-10-18')
    expect(shiftAnchor('pp', '2026-10-15', -1, ANCHORS)).toBe('2026-10-03')
    expect(periodRange('pp', shiftAnchor('pp', '2026-10-15', -1, ANCHORS), ANCHORS)).toEqual({ from: '2026-09-20', to: '2026-10-03' })
    expect(shiftAnchor('month', '2026-10-15', 1, ANCHORS)).toBe('2026-11-01')
    expect(shiftAnchor('day', '2026-10-15', -1, ANCHORS)).toBe('2026-10-14')
  })
  it('writes the range and the totals label as designed', () => {
    expect(rangeText('week', '2026-10-11', '2026-10-17')).toBe('Oct 11 to 17, 2026')
    expect(rangeText('day', '2026-10-15', '2026-10-15')).toBe('Thu, Oct 15, 2026')
    expect(rangeText('month', '2026-10-01', '2026-10-31')).toBe('October 2026')
    expect(rangeText('week', '2026-10-25', '2026-10-31')).toBe('Oct 25 to 31, 2026')
    expect(totalsLabel('week', '2026-10-15', '2026-10-11', '2026-10-17', '2026-10-15')).toBe('This week')
    expect(totalsLabel('week', '2026-10-22', '2026-10-18', '2026-10-24', '2026-10-15')).toBe('Week')
    expect(totalsLabel('pp', '2026-10-15', '2026-10-04', '2026-10-17', '2026-10-15')).toBe('This pay period')
    expect(totalsLabel('month', '2026-10-15', '2026-10-01', '2026-10-31', '2026-10-15')).toBe('October')
    expect(totalsLabel('day', '2026-10-15', '2026-10-15', '2026-10-15', '2026-10-15')).toBe('Thu, Oct 15')
  })
  it('offers four weeks back, this one marked, and the next', () => {
    const w = calendarWeeks('2026-10-15')
    expect(w.map(x => x.label)).toEqual(['Sep 13 to 19', 'Sep 20 to 26', 'Sep 27 to Oct 3', 'Oct 4 to 10', 'Oct 11 to 17', 'Oct 18 to 24'])
    expect(w.find(x => x.current)?.anchor).toBe('2026-10-15')
  })
  it('names the zone by its city', () => {
    expect(zoneCity('America/New_York')).toBe('New York')
    expect(zoneCity('Africa/Nairobi')).toBe('Nairobi')
  })
})

const row = (o: Partial<EntryView>): EntryView => ({
  key: 'e1', rowType: 'entry', id: 1, personId: 'p1', personName: 'Clarise Nixon', initials: 'CN', team: null, zone: 'America/New_York', zoneAbbr: '',
  date: '2026-10-15', start: '2026-10-15T11:00:00.000Z', end: '2026-10-15T13:45:00.000Z', running: false, timeText: '7:00 AM to 9:45 AM',
  seconds: 9900, jobcodeId: 3, path: '1 - True North › Management', short: 'TN › Management', client: 'True North', isI7: false, fields: {},
  company: 'True North', project: 'In-House', activity: 'Management', billable: 'no', code: '', notes: '', kind: 'clock', imported: false,
  pills: [], autoOut: null, edited: null, clockedOutBy: null, locked: false, lockWhy: null, canEdit: true, shortenOnly: false,
  canDelete: true, canContinue: true, continuesPrevious: false, attention: null, correction: null, timeOff: null, ...o,
})

describe('rows and totals', () => {
  const now = Date.parse('2026-10-15T17:20:00Z')
  it('counts a running entry to now, rounded to the quarter hour', () => {
    const t = totalsOf([
      row({ key: 'a' }),
      row({ key: 'b', start: '2026-10-15T14:45:00.000Z', end: null, running: true, seconds: 0, billable: 'yes', client: 'i7 Marketing' }),
    ], now)
    // 2h 45m + 2h 30m (10:45 AM to 1:20 PM rounds to 1:15 PM)
    expect(t.seconds).toBe(9900 + 9000)
    expect(t.billable).toBe(9000)
    expect(t.byClient.map(c => c.client)).toEqual(['True North', 'i7 Marketing'])
  })
  it('counts no correction, time off request or approved time off', () => {
    const t = totalsOf([row({}), row({ key: 'c1', rowType: 'correction', kind: 'correction' }), row({ key: 'o1', rowType: 'time_off', kind: 'time_off' }), row({ key: 'e9', kind: 'absence' })], now)
    expect(t.entries).toBe(1)
    expect(t.seconds).toBe(9900)
  })
  it('groups by day, newest first, by person in All', () => {
    const g = groupByDay([
      row({ key: 'a', date: '2026-10-14' }),
      row({ key: 'b', personName: 'Wendy Cacka', personId: 'p2' }),
      row({ key: 'c', personName: 'Arnaldo Oliveira', personId: 'p3' }),
    ], true, now)
    expect(g.map(x => x.date)).toEqual(['2026-10-15', '2026-10-14'])
    expect(g[0].rows.map(r => r.key)).toEqual(['c', 'b'])
    expect(g[0].people).toBe(2)
  })
})

describe('columns', () => {
  it('shows the defaults, Person only in All', () => {
    expect(visibleColumns(DEFAULT_COLUMNS, false).map(c => c.key)).toEqual(['time', 'duration', 'client', 'division', 'place', 'activity', 'billable', 'notes', 'status'])
    expect(visibleColumns(DEFAULT_COLUMNS, true)[0].key).toBe('person')
  })
  it('lets Client, Division, Project and Notes grow and keeps the actions column', () => {
    const vis = visibleColumns(DEFAULT_COLUMNS, false)
    expect(gridTemplate(vis)).toBe('164px 86px minmax(150px,.8fr) minmax(130px,.8fr) minmax(140px,1.2fr) 150px 80px minmax(110px,1fr) 128px 140px')
    // The 1278 px inside the list's border, beside the summary column.
    expect(minWidth(vis)).toBe(1278)
  })
  it('offers the TSheets fields only when a TSheets entry is on screen', () => {
    const keys = (tsheets: boolean) => offeredColumns(false, tsheets).map(c => c.key)
    expect(keys(false)).not.toContain('company')
    expect(keys(false)).not.toContain('project')
    expect(keys(false)).not.toContain('code')
    expect(keys(true)).toEqual(expect.arrayContaining(['company', 'project', 'code']))
    // Checked but not offered: not drawn either.
    const all = Object.fromEntries(Object.keys(DEFAULT_COLUMNS).map(k => [k, true])) as typeof DEFAULT_COLUMNS
    expect(visibleColumns(all, false, false).map(c => c.key)).not.toContain('code')
    expect(hasTsheetsRows([{ rowType: 'entry', structure: 2 }, { rowType: 'time_off', structure: undefined }])).toBe(false)
    expect(hasTsheetsRows([{ rowType: 'entry', structure: 2 }, { rowType: 'entry', structure: 1 }])).toBe(true)
  })
  it('still lets the whole Job path grow when it is chosen', () => {
    const vis = visibleColumns({ ...DEFAULT_COLUMNS, job: true, client: false, division: false, place: false }, false)
    expect(gridTemplate(vis)).toBe('164px 86px minmax(230px,1.4fr) 150px 80px minmax(110px,1fr) 128px 140px')
  })
})

describe('the 3E check line', () => {
  const base = { type: 'range' as const, start: 13 * 60, end: 15 * 60, nowMinutes: 13 * 60 + 20, durText: '', overlapText: null, bounds: null }
  it('says the length and that nothing overlaps', () => {
    expect(checkLine(base).text).toBe('2h 00m. No overlap.')
  })
  it('refuses an end before the start, over 24 hours, and an overlap', () => {
    expect(checkLine({ ...base, end: 12 * 60 })).toMatchObject({ text: 'End must be after start.', bad: true })
    expect(checkLine({ ...base, type: 'dur', durText: '25h' })).toMatchObject({ text: 'No entry can be longer than 24 hours.', bad: true })
    expect(checkLine({ ...base, overlapText: '2h 00m. Overlaps 1:00 to 1:45 PM with TN Admin.' }).bad).toBe(true)
  })
  it('says what a typed duration is recorded as', () => {
    expect(checkLine({ ...base, type: 'dur', durText: '2h 20m' }).text).toBe('2h 20m is recorded as 2h 15m, the nearest 15 minutes. No overlap.')
    expect(checkLine({ ...base, type: 'dur', durText: '2.5' }).text).toBe('2h 30m. No overlap.')
    expect(checkLine({ ...base, type: 'dur', durText: 'soon' })).toMatchObject({ text: 'Type a duration like 2h 30m, 2:30 or 2.5.', bad: true })
  })
  it('keeps a User inside what was recorded', () => {
    const bounds = { start: 10 * 60, end: 15 * 60, seconds: null }
    expect(checkLine({ ...base, start: 10 * 60, end: 13 * 60, bounds }).bad).toBe(false)
    expect(checkLine({ ...base, start: 9 * 60 + 45, end: 13 * 60, bounds })).toMatchObject({ text: SHORTEN_ONLY, shortenOnly: true })
    expect(checkLine({ ...base, start: 10 * 60, end: 15 * 60 + 15, bounds }).shortenOnly).toBe(true)
    expect(checkLine({ ...base, type: 'dur', durText: '3h', bounds: { start: null, end: null, seconds: 2.75 * 3600 } }).shortenOnly).toBe(true)
  })
  it('counts a running entry to now', () => {
    expect(checkLine({ ...base, start: 10 * 60 + 45, end: 'now' }).text).toBe('2h 30m. No overlap.')
  })
  it('writes times as the actions take them', () => {
    expect(hhmmOf(13 * 60 + 15)).toBe('13:15')
    expect(hhmmOf(0)).toBe('00:00')
    expect(exactDuration(8400)).toBe('2h 20m')
  })
})

describe('the week grid', () => {
  const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']
  const meet: GridSource = { key: gridRowKey(5, 'Meeting: Status'), jobcodeId: 5, path: '1 - True North › Meetings', activity: 'Meeting: Status', fields: {} }
  const web: GridSource = { key: gridRowKey(8, 'WebDev'), jobcodeId: 8, path: '2 - i7 Marketing › Web Dev', activity: 'WebDev', fields: {} }
  const entries = [
    { rowKey: web.key, date: '2026-10-14', seconds: 8 * 3600, clocked: true, locked: false },
    { rowKey: meet.key, date: '2026-10-12', seconds: 2.75 * 3600, clocked: false, locked: false },
  ]

  it('reads "2:30" and "2.5" alike and totals the days and the week', () => {
    const g = buildGrid({ days, sources: [web, meet], entries, editable: true, edits: { [gridEditKey(meet.key, '2026-10-13')]: '2:30', [gridEditKey(meet.key, '2026-10-15')]: '2.5' } })
    expect(g.error).toBeNull()
    expect(g.dayTotals).toEqual([0, 2.75 * 3600, 2.5 * 3600, 8 * 3600, 2.5 * 3600, 0, 0])
    expect(g.week).toBe((2.75 + 2.5 + 8 + 2.5) * 3600)
    expect(g.rows[1].cells[1].text).toBe('2:45')
  })
  it('keeps clocked cells read only, with the clock', () => {
    const g = buildGrid({ days, sources: [web], entries, editable: true, edits: {} })
    expect(g.rows[0].cells[3]).toMatchObject({ ro: true, clock: true, text: '8:00' })
    expect(g.rows[0].cells[4]).toMatchObject({ ro: false })
  })
  it('stops Save on more than 24 hours in a day (3B3)', () => {
    const g = buildGrid({ days, sources: [web, meet], entries, editable: true, edits: { [gridEditKey(meet.key, '2026-10-14')]: '20:00' } })
    expect(g.bad[3]).toBe('over')
    expect(g.error).toBe('More than 24 hours on Wed. A day has 24 hours; fix the cells in red.')
  })
  it('stops Save on a cell it cannot read', () => {
    const g = buildGrid({ days, sources: [meet], entries, editable: true, edits: { [gridEditKey(meet.key, '2026-10-16')]: 'two' } })
    expect(g.error).toBe('Use "2:30" or "2.5" in Fri.')
    expect(g.rows[0].cells[5].invalid).toBe(true)
  })
  it('is read only for a User, and sends only typed cells', () => {
    expect(buildGrid({ days, sources: [meet], entries, editable: false, edits: {} }).rows[0].cells.every(c => c.ro)).toBe(true)
    const edits = { [gridEditKey(meet.key, '2026-10-13')]: '1:15' }
    const g = buildGrid({ days, sources: [meet, web], entries, editable: true, edits })
    expect(gridChanges(g, edits)).toEqual([{ source: meet, cells: { '2026-10-13': '1:15' } }])
  })
})

describe('the day timeline', () => {
  it('draws 64 pixels to the hour from 6 AM, or from midnight', () => {
    expect(xOf(7 * 3600, axisOf(false).from)).toBe(64)
    expect(xOf(7 * 3600, axisOf(true).from)).toBe(448)
    expect(secondsAt(96, 6 * 3600)).toBe(7.5 * 3600)
    expect(hourTicks(axisOf(false))[0]).toEqual({ x: 0, label: '6 AM' })
    expect(hourTicks(axisOf(false))[6].label).toBe('12 PM')
    expect(hourTicks(axisOf(true))).toHaveLength(24)
  })
  it('snaps every drag to 15 minutes', () => {
    expect(snapQuarter(14 * 3600 + 7 * 60)).toBe(14 * 3600)
    expect(snapQuarter(14 * 3600 + 8 * 60)).toBe(14 * 3600 + 900)
    expect(snapQuarter(secondsAt(64 * 8 + 7, 6 * 3600))).toBe(14 * 3600)
    expect(snapQuarter(secondsAt(64 * 8 + 9, 6 * 3600))).toBe(14 * 3600 + 900)
  })
  it('makes a quarter hour at least, whichever way the drag goes', () => {
    expect(createSpan(14 * 3600, 14 * 3600)).toEqual({ s: 14 * 3600, e: 14 * 3600 + 900 })
    expect(createSpan(14 * 3600, 15.25 * 3600)).toEqual({ s: 14 * 3600, e: 15.25 * 3600 })
    expect(createSpan(14 * 3600, 13 * 3600)).toEqual({ s: 13 * 3600, e: 14 * 3600 + 900 })
  })
  it('moves a block, or one edge, never past the other', () => {
    const orig = { s: 9 * 3600, e: 9.75 * 3600 }
    expect(dragSpan('move', orig, -1800)).toEqual({ s: 8.5 * 3600, e: 9.25 * 3600 })
    expect(dragSpan('l', orig, 3 * 3600)).toEqual({ s: 9.5 * 3600, e: 9.75 * 3600 })
    expect(dragSpan('r', orig, -3 * 3600)).toEqual({ s: 9 * 3600, e: 9.25 * 3600 })
  })
})
