import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Saving a team's order (audit, 10 October 2026): the verified session, the
// database's words kept out of the answer, and two leaders who must not
// overwrite each other.

let fake: Fake
let viewAs: object | null = null
let session: object | null = null
let granted = new Set<string>()
const notified: string[] = []

vi.mock('next/server', () => ({ after: (fn: () => void) => { fn() } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => viewAs }))
vi.mock('@/lib/access/resolve', () => ({
  verifiedSession: async () => session,
  loadRealAccess: async () => ({ isSuperAdmin: false, can: (k: string) => granted.has(k) }),
}))
vi.mock('@/lib/directory/current-person', () => ({ loadCurrentPerson: async () => ({ id: LEADER }) }))
vi.mock('@/lib/notifications/run', () => ({ notifyTeamOrder: async (teamId: string) => { notified.push(teamId) } }))

const { saveTeamPriority } = await import('./actions')
const { PRIORITY_OWN } = await import('@/lib/access/surfaces')

const TEAM = '11111111-1111-4111-8111-111111111111'
const LEADER = 'leader-1'
const LOADED = '2026-10-09T14:00:00.000Z'
const ORDER = ['100|people4|7', '101|people4|7']

const save = (loadedAt: string | null, order = ORDER) => saveTeamPriority(TEAM, order, [order[1]], undefined, loadedAt)

beforeEach(() => {
  fake = fakeDb({
    teams: [{ id: TEAM, name: 'SEO' }],
    team_members: [{ team_id: TEAM, person_id: LEADER, is_primary: true, position: 'team_leader' }],
    monday_priority_grants: [],
    monday_team_priority: [{ team_id: TEAM, step_order: [], pinned: [], updated_by: 'someone', updated_at: LOADED }],
  }, { unique: { monday_team_priority: ['team_id'] } })
  viewAs = null
  session = { supabase: fake.db, user: { id: 'user-1' } }
  granted = new Set([PRIORITY_OWN])
  notified.length = 0
})

describe('who may save', () => {
  it('needs a verified session, not just a signed-in one', async () => {
    session = null
    expect(await save(LOADED)).toEqual({ ok: false, error: 'Sign in again to save.' })
    expect(fake.writes).toEqual([])
  })

  it('is refused in a View Stage preview', async () => {
    viewAs = {}
    expect((await save(LOADED)).ok).toBe(false)
    expect(fake.writes).toEqual([])
  })

  it('needs the right to set this team', async () => {
    granted = new Set()
    expect(await save(LOADED)).toEqual({ ok: false, error: "You do not have access to change this team's order." })
    expect(fake.writes).toEqual([])
  })
})

describe('two leaders on one team', () => {
  it('saves over the order it loaded and returns the new stamp', async () => {
    const r = await save(LOADED)
    expect(r.ok).toBe(true)
    expect(r.savedAt).toBeTruthy()
    expect(r.savedAt).not.toBe(LOADED)
    expect(fake.tables.monday_team_priority[0]).toMatchObject({ step_order: ORDER, pinned: [ORDER[1]], updated_by: LEADER, updated_at: r.savedAt })
    expect(notified).toEqual([TEAM])
  })

  it('keeps saving with the stamp each save returns', async () => {
    const first = await save(LOADED)
    const second = await save(first.savedAt!, [...ORDER].reverse())
    expect(second.ok).toBe(true)
    expect(fake.tables.monday_team_priority[0].step_order).toEqual([...ORDER].reverse())
  })

  it('refuses when someone else saved after it loaded, and changes nothing', async () => {
    fake.tables.monday_team_priority[0].updated_at = '2026-10-09T15:30:00.000Z'
    fake.tables.monday_team_priority[0].step_order = ['999|people4|1']
    const r = await save(LOADED)
    expect(r).toEqual({ ok: false, conflict: true, error: 'Someone else changed this order a moment ago. Reload to see it.' })
    expect(fake.tables.monday_team_priority[0].step_order).toEqual(['999|people4|1'])
    expect(notified).toEqual([])
  })

  it('a first order goes in when the team had none', async () => {
    fake.tables.monday_team_priority = []
    const r = await save(null)
    expect(r.ok).toBe(true)
    expect(fake.tables.monday_team_priority).toHaveLength(1)
    expect(fake.tables.monday_team_priority[0]).toMatchObject({ team_id: TEAM, step_order: ORDER })
  })

  it('a first order is refused when someone else saved one since the page loaded', async () => {
    const r = await save(null)
    expect(r.conflict).toBe(true)
    expect(fake.tables.monday_team_priority).toHaveLength(1)
    expect(fake.tables.monday_team_priority[0].step_order).toEqual([])
  })

  it('refuses a stamp that is not a time', async () => {
    expect((await save('yesterday')).ok).toBe(false)
    expect(fake.writes).toEqual([])
  })
})

describe('a failed write', () => {
  it("says a plain sentence and keeps the database's words for the server log", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake = fakeDb({
      teams: [{ id: TEAM, name: 'SEO' }],
      team_members: [{ team_id: TEAM, person_id: LEADER, is_primary: true, position: 'team_leader' }],
      monday_priority_grants: [],
    }, { rejectRow: t => t === 'monday_team_priority' })
    const r = await save(LOADED)
    expect(r).toEqual({ ok: false, error: 'The order could not be saved. Try again in a moment.' })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
