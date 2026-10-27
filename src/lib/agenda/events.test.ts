import { describe, expect, it } from 'vitest'
import { calendarPayload, calendarPlan, checkEvent, editOf, mayManageEvent, type EventInput, type EventRights, type EventRow } from './events'

const ADMIN: EventRights = { company: true, team: true, led: new Set() }
const LEAD: EventRights = { company: false, team: true, led: new Set(['web']) }
const NOBODY: EventRights = { company: false, team: false, led: new Set() }
const TEAMS = new Set(['web', 'seo', 'writers'])

const input = (x: Partial<EventInput> = {}): EventInput => ({
  kind: 'event', when: 'time', title: 'All-hands', date: '2026-11-05', from: '11:00', to: '12:00', zone: 'America/New_York',
  teams: [], google: true, ...x,
})

const row = (x: Partial<EventRow> = {}): EventRow => ({
  kind: 'event', team_id: null, title: 'All-hands', start_date: '2026-11-05', end_date: '2026-11-05',
  starts_at: '2026-11-05T16:00:00.000Z', ends_at: '2026-11-05T17:00:00.000Z', time_zone: 'America/New_York',
  place: null, audience_team_ids: null, client: null, description: null, add_to_google: true, ...x,
})

describe('mayManageEvent: the same people who may create it', () => {
  it('lets Super Admins and Admins manage every event and milestone', () => {
    expect(mayManageEvent(ADMIN, { kind: 'event', team_id: null })).toBe(true)
    expect(mayManageEvent(ADMIN, { kind: 'milestone', team_id: null })).toBe(true)
    expect(mayManageEvent(ADMIN, { kind: 'event', team_id: 'seo' })).toBe(true)
  })
  it('lets a Team Leader manage only the events of a team they lead', () => {
    expect(mayManageEvent(LEAD, { kind: 'event', team_id: 'web' })).toBe(true)
    expect(mayManageEvent(LEAD, { kind: 'event', team_id: 'seo' })).toBe(false)
    expect(mayManageEvent(LEAD, { kind: 'event', team_id: null })).toBe(false)
    expect(mayManageEvent(LEAD, { kind: 'milestone', team_id: 'web' })).toBe(false)
  })
  it('refuses someone with neither right, even on their old team', () => {
    expect(mayManageEvent({ ...NOBODY, led: new Set(['web']) }, { kind: 'event', team_id: 'web' })).toBe(false)
  })
})

describe('checkEvent', () => {
  it('turns a timed event into instants in its zone', () => {
    const r = checkEvent(input(), { rights: ADMIN, teams: TEAMS })
    expect(r.ok && r.row).toMatchObject({ kind: 'event', team_id: null, starts_at: '2026-11-05T16:00:00.000Z', ends_at: '2026-11-05T17:00:00.000Z', time_zone: 'America/New_York', audience_team_ids: null, add_to_google: true })
  })
  it('refuses what the add form refuses', () => {
    const no = (x: Partial<EventInput>, rights = ADMIN) => { const r = checkEvent(input(x), { rights, teams: TEAMS }); return r.ok ? null : r.error }
    expect(no({ title: '  ' })).toBe('Give it a title.')
    expect(no({ title: 'x'.repeat(161) })).toBe('The title is too long.')
    expect(no({ date: '5/11/2026' })).toBe('Pick the date.')
    expect(no({ from: '12:00', to: '11:00' })).toBe('It must end after it starts.')
    expect(no({ when: 'range', end: '2026-11-01' })).toBe('Pick the last day, on or after the first.')
    expect(no({ when: 'range', end: '2027-02-01' })).toBe('A few days is up to two months.')
    expect(no({ kind: 'milestone' }, LEAD)).toBe('Super Admins and Admins create milestones.')
    expect(no({}, NOBODY)).toBe('Creating events is not open to your access.')
  })
  it('holds a Team Leader to one team they lead', () => {
    expect(checkEvent(input({ teams: ['seo'] }), { rights: LEAD, teams: TEAMS }).ok).toBe(false)
    expect(checkEvent(input({ teams: ['web', 'seo'] }), { rights: LEAD, teams: TEAMS }).ok).toBe(false)
    const r = checkEvent(input({ teams: ['web'] }), { rights: LEAD, teams: TEAMS })
    expect(r.ok && r.row.team_id).toBe('web')
  })
  it('lets a Team Leader save their event with a team an Admin added, but not add one', () => {
    const kept = checkEvent(input({ teams: ['web', 'seo'] }), { rights: LEAD, teams: TEAMS, keepTeam: 'web', keepAudience: ['web', 'seo'] })
    expect(kept.ok && kept.row).toMatchObject({ team_id: 'web', audience_team_ids: ['web', 'seo'] })
    expect(checkEvent(input({ teams: ['web', 'seo'] }), { rights: LEAD, teams: TEAMS, keepTeam: 'web', keepAudience: ['web'] }).ok).toBe(false)
  })
  it('drops unknown teams, and keeps a team event its team when an Admin edits it', () => {
    const r = checkEvent(input({ teams: ['web', 'ghost'] }), { rights: ADMIN, teams: TEAMS, keepTeam: 'web' })
    expect(r.ok && r.row).toMatchObject({ team_id: 'web', audience_team_ids: ['web'] })
    const moved = checkEvent(input({ teams: ['seo'] }), { rights: ADMIN, teams: TEAMS, keepTeam: 'web' })
    expect(moved.ok && moved.row.team_id).toBe(null)
  })
  it('keeps a client only on a milestone, and all-day and a few days without times', () => {
    const ev = checkEvent(input({ client: 'GNA', when: 'day' }), { rights: ADMIN, teams: TEAMS })
    expect(ev.ok && ev.row).toMatchObject({ client: null, starts_at: null, ends_at: null, time_zone: null, end_date: '2026-11-05' })
    const ms = checkEvent(input({ kind: 'milestone', client: 'GNA', when: 'range', end: '2026-11-07' }), { rights: ADMIN, teams: TEAMS })
    expect(ms.ok && ms.row).toMatchObject({ kind: 'milestone', client: 'GNA', end_date: '2026-11-07' })
  })
})

describe('the team Google Calendar on an edit', () => {
  const stored = (x: Partial<EventRow> & { google_event_id?: string | null; calendar_state?: string | null } = {}) =>
    ({ ...row(x), google_event_id: 'g1', calendar_state: 'done', ...x })

  it('does nothing when what the calendar shows did not change', () => {
    expect(calendarPlan(stored(), row({ audience_team_ids: ['web'] }))).toEqual({ remove: null, drop: false, send: false })
  })
  it('takes the old copy off and sends the new one when it changed', () => {
    expect(calendarPlan(stored(), row({ title: 'All-hands, moved' }))).toEqual({ remove: 'g1', drop: true, send: true })
  })
  it('only takes it off when the switch is turned off', () => {
    expect(calendarPlan(stored(), row({ add_to_google: false }))).toEqual({ remove: 'g1', drop: true, send: false })
  })
  it('sends it when the switch is turned on, and sends again after a refusal', () => {
    expect(calendarPlan(stored({ add_to_google: false, google_event_id: null, calendar_state: null }), row())).toEqual({ remove: null, drop: true, send: true })
    expect(calendarPlan(stored({ google_event_id: null, calendar_state: 'failed' }), row())).toEqual({ remove: null, drop: true, send: true })
  })
  it('sends a timed event with its zone and an all-day one by days', () => {
    expect(calendarPayload(row())).toEqual({ summary: 'All-hands', startAt: '2026-11-05T16:00:00.000Z', endAt: '2026-11-05T17:00:00.000Z', timeZone: 'America/New_York', location: null, description: null })
    expect(calendarPayload(row({ starts_at: null, ends_at: null, time_zone: null, end_date: '2026-11-06' }))).toEqual({ summary: 'All-hands', start: '2026-11-05', end: '2026-11-06', location: null, description: null })
  })
})

describe('editOf: the form Edit opens with', () => {
  it('shows a timed event at its own wall times, whatever the viewer zone', () => {
    expect(editOf(7, row(), 'Africa/Nairobi')).toMatchObject({ id: 7, when: 'time', date: '2026-11-05', from: '11:00', to: '12:00', zone: 'America/New_York', end: '' })
  })
  it('reads all day and a few days back', () => {
    expect(editOf(7, row({ starts_at: null, ends_at: null, time_zone: null }), 'Africa/Nairobi')).toMatchObject({ when: 'day', zone: 'Africa/Nairobi', end: '' })
    expect(editOf(7, row({ starts_at: null, ends_at: null, time_zone: null, end_date: '2026-11-07' }), 'Europe/Paris')).toMatchObject({ when: 'range', end: '2026-11-07', zone: 'America/New_York' })
  })
  it('round-trips through checkEvent unchanged', () => {
    const e = editOf(7, row({ audience_team_ids: ['web'], place: 'Room 2', description: 'Notes' }), 'America/New_York')
    const r = checkEvent({ ...e, description: e.desc }, { rights: ADMIN, teams: TEAMS })
    expect(r.ok && r.row).toEqual(row({ audience_team_ids: ['web'], place: 'Room 2', description: 'Notes' }))
  })
})
