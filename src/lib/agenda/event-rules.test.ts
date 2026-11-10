import { describe, it, expect } from 'vitest'
import { GROUPS, TYPES, audiencesFor, checkDrawer, invitees, legacyType, mayManage, seesEvent, teamsFor, typesFor, type DrawerInput, type Person } from './event-rules'

const base: DrawerInput = { type: 'meeting', when: 'time', title: 'Kickoff with Hope Clinic', date: '2026-11-04', from: 600, to: 660, how: 'online', audience: 'guests', teams: [], guests: [{ email: 'maria.santos@hopeclinic.org' }], accountId: 7 }
const admin = { level: 'admin' as const, led: new Set<string>(), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }
const lead = { level: 'team_leader' as const, led: new Set(['mk']), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }
const member = { level: 'user' as const, led: new Set<string>(), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }

describe('who may create what', () => {
  it('gives everyone Meeting, Reminder and Block time; Team Leaders four more; Admins all but Absence', () => {
    expect(typesFor('user')).toEqual(['meeting', 'reminder', 'block'])
    expect(typesFor('team_leader')).toEqual(['meeting', 'training', 'deadline', 'milestone', 'reminder', 'block'])
    expect(typesFor('admin')).toEqual(['meeting', 'training', 'company', 'deadline', 'milestone', 'celebration', 'reminder', 'block'])
    expect(typesFor('super_admin')).toEqual(typesFor('admin'))
  })
  it('offers Absence to contractors only, at any level, in the picker order', () => {
    expect(typesFor('user', true)).toEqual(['meeting', 'reminder', 'block', 'absence'])
    expect(typesFor('team_leader', true)).toContain('absence')
    expect(typesFor('admin', true)).toEqual(TYPES.map(t => t.id))
  })
  it('lays the nine types out in three groups of three', () => {
    expect(GROUPS.map(g => TYPES.filter(t => t.group === g.id).map(t => t.id))).toEqual([
      ['meeting', 'training', 'company'], ['deadline', 'milestone', 'celebration'], ['reminder', 'block', 'absence'],
    ])
  })
  it('opens True North to the levels the Super Admin chose, and Teams to whoever has teams', () => {
    expect(audiencesFor('user', 0, ['super_admin', 'admin'])).toEqual(['guests'])
    expect(audiencesFor('user', 0, ['super_admin', 'admin', 'user'])).toEqual(['guests', 'all'])
    expect(audiencesFor('team_leader', 1, ['super_admin'])).toEqual(['guests', 'teams'])
    expect(audiencesFor('team_leader', 0, ['super_admin'])).toEqual(['guests'])
    expect(teamsFor('team_leader', new Set(['mk']), ['mk', 'gr'])).toEqual(['mk'])
  })
})

describe('checkDrawer', () => {
  it('sets the time in Washington and keeps the guests', () => {
    const r = checkDrawer(base, member)
    expect(r.ok && r.row).toMatchObject({ kind: 'event', type: 'meeting', audience: 'guests', starts_at: '2026-11-04T15:00:00.000Z', ends_at: '2026-11-04T16:00:00.000Z', time_zone: 'America/New_York', how: 'online', place: null, sent_from_account_id: 7 })
    expect(r.ok && r.guests).toEqual([{ personId: null, email: 'maria.santos@hopeclinic.org' }])
  })
  it('refuses without an account to send from, a guest, or a right', () => {
    expect(checkDrawer({ ...base, accountId: null }, member)).toEqual({ ok: false, error: 'Select the account to send from.' })
    expect(checkDrawer({ ...base, type: 'training' }, member)).toEqual({ ok: false, error: 'That type is not open to your access.' })
    expect(checkDrawer({ ...base, audience: 'all' }, member)).toEqual({ ok: false, error: 'Inviting all of True North is not open to your access.' })
    expect(checkDrawer({ ...base, audience: 'teams', teams: ['gr'] }, lead)).toEqual({ ok: false, error: 'You can only send to teams you lead.' })
    expect(checkDrawer({ ...base, to: 600 }, member)).toEqual({ ok: false, error: 'The end time has to be after the start.' })
  })
  it('keeps no Meet and no place on a deadline, and the place only in person', () => {
    const d = checkDrawer({ ...base, type: 'deadline', when: 'day', guests: [], client: 'i7 Marketing', place: 'x' }, lead)
    expect(d.ok && d.row).toMatchObject({ kind: 'event', how: null, place: null, starts_at: null, client: 'i7 Marketing' })
    const p = checkDrawer({ ...base, how: 'in_person', place: 'Room 2' }, admin)
    expect(p.ok && p.row).toMatchObject({ how: 'in_person', place: 'Room 2' })
  })
})

describe('invitees', () => {
  const people: Person[] = [
    { id: 'me', teamIds: ['mk'], active: true, inviteEmail: 'me@tn.com' },
    { id: 'a', teamIds: ['mk'], active: true, inviteEmail: 'a@tn.com' },
    { id: 'b', teamIds: ['gr'], active: true, inviteEmail: 'b@tn.com' },
    { id: 'c', teamIds: ['gr'], active: false, inviteEmail: 'c@tn.com' },
  ]
  it('writes out the teams, adds guests once each, and leaves the creator out', () => {
    expect(invitees('teams', ['mk'], [{ personId: 'b', email: 'B@tn.com' }, { personId: 'a', email: 'a@tn.com' }], people, 'me'))
      .toEqual([{ person_id: 'a', email: 'a@tn.com', via: 'team' }, { person_id: 'b', email: 'b@tn.com', via: 'guest' }])
    expect(invitees('all', [], [{ email: 'x@ext.org' }], people, 'me').map(i => i.email)).toEqual(['a@tn.com', 'b@tn.com', 'x@ext.org'])

  })
  it('lets the creator invite themselves at another address, never through a team', () => {
    expect(invitees('guests', [], [{ personId: 'me', email: 'me@work.com' }], people, 'me')).toEqual([{ person_id: 'me', email: 'me@work.com', via: 'guest' }])
  })
})

describe('who sees and who changes an event', () => {
  const v = (level: 'user' | 'team_leader' | 'admin' | 'super_admin', id = 'v') => ({ id, level, teamIds: ['mk'], led: new Set(level === 'team_leader' ? ['mk'] : []) })
  const meeting = { audience: 'guests' as const, audience_team_ids: null, created_by: 'x', team_id: null }
  it('keeps a guests-only meeting to its guests and creator, Admins included', () => {
    expect(seesEvent(meeting, v('super_admin'), new Set())).toBe(false)
    expect(seesEvent(meeting, v('user'), new Set(['v']))).toBe(true)
    expect(seesEvent({ ...meeting, audience: 'teams', audience_team_ids: ['mk'] }, v('user'), new Set())).toBe(true)
    expect(seesEvent({ ...meeting, audience: 'all' }, v('user'), new Set())).toBe(true)
  })
  it('lets the creator, a Team Leader of the teams, and Admins on True North events change it', () => {
    expect(mayManage(meeting, v('user', 'x'))).toBe(true)
    expect(mayManage(meeting, v('admin'))).toBe(false)
    expect(mayManage({ ...meeting, audience: 'all' }, v('admin'))).toBe(true)
    expect(mayManage({ ...meeting, audience: 'teams', audience_team_ids: ['mk'] }, v('team_leader'))).toBe(true)
    expect(mayManage({ ...meeting, audience: 'teams', audience_team_ids: ['mk', 'gr'] }, v('team_leader'))).toBe(false)
  })
  it('reads old events as a type', () => {
    expect(legacyType('milestone', null)).toBe('milestone')
    expect(legacyType('event', 't')).toBe('meeting')
    expect(legacyType('event', null)).toBe('company')
  })
})

describe('a Reminder (owner, 8 November 2026)', () => {
  const r0: DrawerInput = { ...base, type: 'reminder', when: 'day', title: 'US Employees Timesheets Due', guests: [], accountId: null, repeat: { freq: 'weekly', interval: 2, days: [1], monthBy: 'day', ends: 'never' } }
  it('saves with no account, no guest, no Meet and no time, every 2 weeks', () => {
    const r = checkDrawer(r0, admin)
    expect(r.ok && r.row).toMatchObject({ type: 'reminder', kind: 'event', how: null, place: null, starts_at: null, sent_from_account_id: null, recurrence: 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;WKST=SU' })
    expect(r.ok && r.guests).toEqual([])
  })
  it('invites nobody even when guests or an account are sent', () => {
    const r = checkDrawer({ ...r0, guests: [{ email: 'someone@example.com' }], accountId: 7, audience: 'all' }, admin)
    expect(r.ok && r.guests).toEqual([])
    expect(r.ok && r.row.sent_from_account_id).toBeNull()
  })
  it('is never at a time, and is open to every level (owner, 10 November 2026)', () => {
    expect(checkDrawer({ ...r0, when: 'time' }, admin)).toEqual({ ok: false, error: 'A reminder is all day or a few days, never at a time.' })
    expect(checkDrawer({ ...r0, audience: 'guests' }, lead).ok).toBe(true)
    expect(checkDrawer({ ...r0, audience: 'guests' }, member).ok).toBe(true)
    expect(checkDrawer({ ...r0, audience: 'all' }, member)).toEqual({ ok: false, error: 'Inviting all of True North is not open to your access.' })
  })
  it('"Only me" (Guests with nobody) is seen by the creator alone; Everyone by all', () => {
    const v = (id: string) => ({ id, level: 'user' as const, teamIds: ['mk'], led: new Set<string>() })
    const mine = { audience: 'guests' as const, audience_team_ids: null, created_by: 'arnaldo', team_id: null }
    expect(seesEvent(mine, v('arnaldo'), new Set())).toBe(true)
    expect(seesEvent(mine, v('tina'), new Set())).toBe(false)
    expect(seesEvent({ ...mine, audience: 'all' }, v('tina'), new Set())).toBe(true)
  })
})

describe('nobody invited (owner, 10 November 2026)', () => {
  it('saves any type with no guest, seen by the creator alone', () => {
    for (const type of ['meeting', 'training', 'company', 'celebration'] as const) {
      const r = checkDrawer({ ...base, type, guests: [] }, admin)
      expect(r.ok && r.guests).toEqual([])
    }
    const mine = { audience: 'guests' as const, audience_team_ids: null, created_by: 'me', team_id: null }
    expect(seesEvent(mine, { id: 'me', level: 'user', teamIds: [], led: new Set() }, new Set())).toBe(true)
    expect(seesEvent(mine, { id: 'other', level: 'super_admin', teamIds: [], led: new Set() }, new Set())).toBe(false)
  })
})

describe('Block time (owner, 10 November 2026)', () => {
  const b: DrawerInput = { ...base, type: 'block', title: 'Focus: i7 report', guests: [], accountId: null, audience: 'all', teams: ['mk'] }
  it('is the creator\'s alone whatever Who it\'s for says, at a time or all day, with or without an account', () => {
    for (const rights of [member, lead, admin]) {
      const r = checkDrawer(b, rights)
      expect(r.ok && r.row).toMatchObject({ type: 'block', audience: 'guests', audience_team_ids: null, how: null, sent_from_account_id: null, starts_at: '2026-11-04T15:00:00.000Z' })
      expect(r.ok && r.guests).toEqual([])
    }
    const day = checkDrawer({ ...b, when: 'day', accountId: 7 }, member)
    expect(day.ok && day.row).toMatchObject({ starts_at: null, sent_from_account_id: 7 })
  })
  it('invites nobody even when guests are sent, and is not a few days', () => {
    const r = checkDrawer({ ...b, guests: [{ email: 'x@y.org' }] }, member)
    expect(r.ok && r.guests).toEqual([])
    expect(checkDrawer({ ...b, when: 'range', end: '2026-11-06' }, member)).toEqual({ ok: false, error: 'Block time is at a time or all day.' })
  })
  it('is seen by nobody but its creator, Super Admins included', () => {
    const row = { audience: 'guests' as const, audience_team_ids: null, created_by: 'me', team_id: null }
    expect(seesEvent(row, { id: 'me', level: 'user', teamIds: [], led: new Set() }, new Set())).toBe(true)
    expect(seesEvent(row, { id: 'boss', level: 'super_admin', teamIds: [], led: new Set() }, new Set())).toBe(false)
  })
})

describe('Absence (owner, 10 November 2026)', () => {
  const a: DrawerInput = { ...base, type: 'absence', when: 'range', end: '2026-11-06', title: 'Cy: Away', guests: [], accountId: 7, audience: 'guests' }
  it('is for contractors: refused to anyone else', () => {
    expect(checkDrawer(a, member)).toEqual({ ok: false, error: 'Absence is for contractors.' })
    expect(checkDrawer(a, { ...member, contractor: true }).ok).toBe(true)
  })
  it('is seen by everyone, with no account and nobody invited, whatever the form says', () => {
    const r = checkDrawer(a, { ...member, contractor: true })
    expect(r.ok && r.row).toMatchObject({ type: 'absence', audience: 'all', how: null, sent_from_account_id: null, start_date: '2026-11-04', end_date: '2026-11-06' })
    expect(r.ok && r.guests).toEqual([])
    const row = { audience: 'all' as const, audience_team_ids: null, created_by: 'cy', team_id: null }
    expect(seesEvent(row, { id: 'anyone', level: 'user', teamIds: [], led: new Set() }, new Set())).toBe(true)
  })
  it('is all day or a few days, never at a time', () => {
    expect(checkDrawer({ ...a, when: 'time' }, { ...member, contractor: true })).toEqual({ ok: false, error: 'An absence is all day or a few days, never at a time.' })
  })
})
