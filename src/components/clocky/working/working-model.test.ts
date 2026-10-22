import { describe, expect, it } from 'vitest'
import type { WhosWorkingData, WorkingPerson } from '@/lib/timeclock/clocky-types'
import { currentEntryLine, emptyTitle, endTimeOptions, groupsOf, isOver, rowOf, scopeText, viewerTime } from './working-model'

/** Thu, Oct 15, 2026 in New York (EDT, UTC-4). */
const et = (h: number, m = 0, s = 0) => new Date(Date.UTC(2026, 9, 15, h + 4, m, s)).toISOString()
const ms = (iso: string) => Date.parse(iso)
const NOW = et(10, 59)

const person = (o: Partial<WorkingPerson> & { name: string }): WorkingPerson => ({
  personId: o.name.toLowerCase().replace(/\s+/g, '-'), initials: '', avatarUrl: null, team: null,
  zone: 'America/New_York', zoneAbbr: 'EDT', status: 'off', autoOutToday: null, clockedOutBy: null, current: null,
  lastOut: null, daySeconds: 0, weekSeconds: 0, over: false, allowanceOver: null, keptGoingAt: null, canClockOut: false, ...o,
})
const AFRICA = { id: 'af', name: 'Africa', color: '#F0A35E' }
const WEB = { id: 'web', name: 'Web', color: '#A99BD4' }

const justus = person({
  name: 'Justus Tsofa', team: AFRICA, zone: 'Africa/Nairobi', zoneAbbr: 'EAT', status: 'on',
  current: { entryId: 1, path: '2 - i7 Marketing › Content', activity: 'Content: Writing', timerFrom: et(6, 18, 48), startedAt: et(6, 15), sessionStartedAt: et(6, 18, 48) },
  daySeconds: 7.75 * 3600, weekSeconds: 36.25 * 3600, over: true, keptGoingAt: et(10, 48), canClockOut: true,
})
const wendy = person({
  name: 'Wendy Cacka', team: WEB, zone: 'America/Chicago', zoneAbbr: 'CDT', status: 'on', autoOutToday: { at: et(10) },
  current: { entryId: 2, path: '2 - i7 Marketing › Web Dev', activity: 'WebDev', timerFrom: et(10, 15), startedAt: et(10, 15), sessionStartedAt: et(10, 15) },
  daySeconds: 5.75 * 3600, weekSeconds: 30.25 * 3600,
})
const samuel = person({
  name: 'Samuel Manzi', team: WEB, status: 'on',
  current: { entryId: 3, path: '1 - True North › Web Dev', activity: 'WebDev', timerFrom: et(6, 30, 20), startedAt: et(6, 30), sessionStartedAt: et(6, 30, 20) },
  daySeconds: 4.5 * 3600, weekSeconds: 34.75 * 3600,
})
const olivia = person({ name: 'Olivia Hale', lastOut: 'Wed, 5:10 PM', weekSeconds: 32 * 3600 })

const DATA: WhosWorkingData = {
  viewer: { zone: 'America/New_York', zoneAbbr: 'EDT', scope: 'all', teamNames: [] },
  now: NOW, onTheClock: 3, people: [justus, olivia, samuel, wendy],
}

describe('the header', () => {
  it("writes the viewer's time", () => {
    expect(viewerTime(ms(NOW), 'America/New_York')).toBe('Thu, Oct 15, 10:59 AM (your time)')
    expect(viewerTime(ms(NOW), 'America/Chicago')).toBe('Thu, Oct 15, 9:59 AM (your time)')
  })

  it("tells a Team Leader they see their team only", () => {
    expect(scopeText(['Web'])).toBe('You lead Web, so you see your team only.')
    expect(scopeText(['SEO', 'Web'])).toBe('You lead SEO and Web, so you see your teams only.')
  })
})

describe('a person row', () => {
  it('shows the job, the local time with the zone, the timer, the day and week, and the tags', () => {
    const r = rowOf(justus, { nowMs: ms(NOW), dataNowMs: ms(NOW), viewerZone: 'America/New_York' })
    expect(r).toMatchObject({
      status: 'On the clock', line: '2 - i7 Marketing › Content · Content: Writing', local: '5:59 PM EAT',
      timer: '4:40:12', timerFg: '#8a6d1a', warn: true, day: '7:45', week: '36:15',
    })
    expect(r.tags).toEqual([{ text: 'Kept going', bg: '#f1f3f6', fg: '#5b6b82', tip: 'Answered "Still working?" at 10:48 AM' }])
  })

  it('marks an automatic stop today, and someone off the clock with their last clock out', () => {
    const w = rowOf(wendy, { nowMs: ms(NOW), dataNowMs: ms(NOW), viewerZone: 'America/New_York' })
    expect(w.tags[0]).toEqual({ text: 'Auto out', bg: '#fdeeef', fg: '#c8323d', tip: 'North Time stopped this clock at 10:00 AM after 5h 00m' })
    expect(w.local).toBe('9:59 AM CDT')
    const o = rowOf(olivia, { nowMs: ms(NOW), dataNowMs: ms(NOW), viewerZone: 'America/New_York' })
    expect(o).toMatchObject({ status: 'Off', line: 'Off the clock, last: Wed, 5:10 PM', timer: 'Off', timerFg: '#a3aebb', dot: '#cbd2da' })
  })

  it('keeps the day counting on the quarter hour after the data was read', () => {
    const r = rowOf(samuel, { nowMs: ms(et(11, 30)), dataNowMs: ms(NOW), viewerZone: 'America/New_York' })
    // Read at 10:59 (counted to 11:00); at 11:30 the entry adds 30 minutes.
    expect(r.day).toBe('5:00')
  })

  it('turns warn at 4h 30m since the clock in', () => {
    expect(isOver(samuel, ms(et(10, 59)))).toBe(false)
    expect(isOver(samuel, ms(et(11, 0, 20)))).toBe(true)
  })
})

describe('the list', () => {
  it('groups by team (No team last), counts who is on the clock, and hides who is off', () => {
    const g = groupsOf(DATA, { nowMs: ms(NOW), filter: 'on', sort: 'Day total', query: '' })
    expect(g.map(x => [x.name, x.count, x.rows.map(r => r.person.name)])).toEqual([
      ['Africa', '1 on the clock', ['Justus Tsofa']],
      ['Web', '2 on the clock', ['Wendy Cacka', 'Samuel Manzi']],
    ])
  })

  it('shows everyone today with "n of m on the clock", in the team order given', () => {
    const g = groupsOf(DATA, { nowMs: ms(NOW), filter: 'all', sort: 'Name', query: '', teamOrder: ['Web', 'Africa'] })
    expect(g.map(x => [x.name, x.count])).toEqual([['Web', '2 of 2 on the clock'], ['Africa', '1 of 1 on the clock'], ['No team', '0 of 1 on the clock']])
    expect(g[0].rows.map(r => r.person.name)).toEqual(['Samuel Manzi', 'Wendy Cacka'])
  })

  it('sorts by clock-in time and by job, and searches names and jobs', () => {
    const byIn = groupsOf(DATA, { nowMs: ms(NOW), filter: 'on', sort: 'Clock-in time', query: '' })
    expect(byIn[1].rows.map(r => r.person.name)).toEqual(['Samuel Manzi', 'Wendy Cacka'])
    expect(groupsOf(DATA, { nowMs: ms(NOW), filter: 'all', sort: 'Job', query: 'web dev' }).flatMap(x => x.rows.map(r => r.person.name)))
      .toEqual(['Samuel Manzi', 'Wendy Cacka'])
    expect(groupsOf(DATA, { nowMs: ms(NOW), filter: 'on', sort: 'Name', query: 'zz' })).toEqual([])
  })

  it('says why the list is empty', () => {
    expect(emptyTitle('on', '')).toBe('Nobody is on the clock right now.')
    expect(emptyTitle('all', '')).toBe('Nobody has clocked in today.')
    expect(emptyTitle('on', 'zed')).toBe('Nobody matches "zed".')
  })
})

describe('clock out for them', () => {
  it('offers now, then every 5 minutes back to the start, in both times', () => {
    const o = endTimeOptions(justus, ms(NOW), 'America/New_York')
    expect(o[0]).toEqual({ value: 'now', label: 'Now, 10:59 AM (5:59 PM EAT)' })
    expect(o[1]).toEqual({ value: et(10, 55), label: '10:55 AM (5:55 PM EAT)' })
    expect(o[o.length - 1].label).toBe('6:20 AM (1:20 PM EAT)')
  })

  it('describes the running entry', () => {
    expect(currentEntryLine(justus, ms(NOW), 'America/New_York'))
      .toBe('Current entry: 2 - i7 Marketing › Content · Content: Writing, since 6:18 AM your time (1:18 PM EAT), running 4:45.')
  })
})
