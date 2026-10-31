import { describe, it, expect } from 'vitest'
import { audiencesFor, checkDrawer, invitees, legacyType, mayManage, seesEvent, teamsFor, typesFor, type DrawerInput, type Person } from './event-rules'

const base: DrawerInput = { type: 'meeting', when: 'time', title: 'Kickoff with Hope Clinic', date: '2026-11-04', from: 600, to: 660, how: 'online', audience: 'guests', teams: [], guests: [{ email: 'maria.santos@hopeclinic.org' }], accountId: 7 }
const admin = { level: 'admin' as const, led: new Set<string>(), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }
const lead = { level: 'team_leader' as const, led: new Set(['mk']), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }
const member = { level: 'user' as const, led: new Set<string>(), allLevels: ['super_admin', 'admin'], teamIds: ['mk', 'gr'] }

describe('who may create what', () => {
  it('gives members meetings, Team Leaders four types, Admins all six', () => {
    expect(typesFor('user')).toEqual(['meeting'])
    expect(typesFor('team_leader')).toEqual(['meeting', 'training', 'deadline', 'milestone'])
    expect(typesFor('admin')).toHaveLength(6)
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
    expect(checkDrawer({ ...base, guests: [] }, member)).toEqual({ ok: false, error: 'Add at least one guest.' })
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
