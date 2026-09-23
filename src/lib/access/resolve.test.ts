import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * loadAccess() is where the two permission layers meet, and every permission
 * bug this project has had was a bug in how they combine rather than in either
 * one alone:
 *
 *   - a Home widget kept showing after its tool was revoked, because the widget
 *     checked the surface and the tool separately and one of them was stale
 *   - "My Work" became grantable per team while never being a card, because a
 *     grant row survived its key leaving the catalogue
 *   - an admin on no team would have lost the screens needed to fix that
 *
 * None of it is visible from surfaces.ts or tools.ts on their own, which is why
 * those two test files did not catch any of it. This one drives the resolver
 * with a fake Supabase so the combinations can be asserted directly.
 *
 * The mocks stop at the database boundary: surfaceAllowed and the tool
 * catalogue are the real ones, so a change to the SURFACES table or to TOOLS
 * shows up here.
 */

// React's cache() memoises per request; outside one it is just an identity
// wrapper, which is what a test wants anyway.
vi.mock('react', async orig => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))

const redirected = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { redirected(to); throw new Error(`REDIRECT:${to}`) },
}))

const tier = vi.fn()
vi.mock('@/lib/auth/role', () => ({ getCurrentTier: () => tier() }))

const currentPerson = vi.fn()
vi.mock('@/lib/directory/current-person', () => ({
  loadCurrentPerson: () => currentPerson(),
}))

const dbRows = {
  access_level_pages: [] as { role_type: string; surface_key: string; allowed: boolean }[],
  team_members: [] as { team_id: string; position: string }[],
  team_tool_grants: [] as { team_id: string; tool_key: string; audience: string }[],
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    // getClaims is how a render learns who is signed in (lib/auth/session.ts);
    // getUser stays for anything that still verifies with the Auth server.
    auth: {
      getClaims: async () => ({ data: { claims: { sub: 'user-1' } } }),
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: keyof typeof dbRows) {
      // Every call in the resolver ends in an await, so one thenable that
      // ignores the filters is enough: the filters only ever narrow to the
      // single person and their own teams, which is what these rows already are.
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (resolve: (v: { data: unknown }) => void) => resolve({ data: dbRows[table] ?? [] }),
      }
      return q
    },
  }),
}))

import { loadAccess, requireSurface } from './resolve'
import { TOOLS } from './tools'

// Two real catalogue keys, so the test breaks loudly if the catalogue is
// renamed rather than passing on invented strings.
const TOOL_A = TOOLS[0].key
const TOOL_B = TOOLS[1].key

type Role = 'user' | 'team_leader' | 'admin_assistant' | 'admin'

function setup(opts: {
  role: Role
  isLead?: boolean
  onTeams?: string[]
  /** Teams this person leads. Defaults to the 'team_leader' position. */
  leads?: string[]
  /** Position used for the led teams, to cover the whole leading vocabulary. */
  leadPosition?: 'founder' | 'manager' | 'team_leader' | string
  grants?: { team: string; tool: string; audience?: 'all' | 'lead' }[]
  surfaces?: { role: Role; key: string; allowed: boolean }[]
  noPersonRecord?: boolean
}) {
  tier.mockResolvedValue({
    roleType: opts.role,
    isPrivileged: opts.role === 'admin' || opts.role === 'admin_assistant',
    isLead: opts.isLead ?? false,
  })
  currentPerson.mockResolvedValue(opts.noPersonRecord ? null : { id: 'person-1' })

  dbRows.access_level_pages = (opts.surfaces ?? []).map(s => ({
    role_type: s.role, surface_key: s.key, allowed: s.allowed,
  }))
  dbRows.team_members = (opts.onTeams ?? []).map(t => ({
    team_id: t,
    position: (opts.leads ?? []).includes(t) ? (opts.leadPosition ?? 'team_leader') : 'collaborator',
  }))
  dbRows.team_tool_grants = (opts.grants ?? []).map(g => ({
    team_id: g.team, tool_key: g.tool, audience: g.audience ?? 'all',
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  dbRows.access_level_pages = []
  dbRows.team_members = []
  dbRows.team_tool_grants = []
})

describe('loadAccess: tools need the surface AND a team grant', () => {
  it('opens a tool when the level allows the area and a team grants it', async () => {
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      grants: [{ team: 'team-1', tool: TOOL_A }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_A)).toBe(true)
  })

  it('closes the tool when the level loses the area, even with the grant intact', async () => {
    // The Home budget widget bug: the grant is still there, the area is not,
    // and anything reading only the grant kept rendering.
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      grants: [{ team: 'team-1', tool: TOOL_A }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: false }],
    })
    const access = await loadAccess()
    expect(access.can('tools')).toBe(false)
    expect(access.canTool(TOOL_A)).toBe(false)
    expect(access.toolKeys.size).toBe(0)
  })

  it('denies a tool nobody granted, even with the area open', async () => {
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      grants: [{ team: 'team-1', tool: TOOL_A }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_B)).toBe(false)
  })

  it('gives no tools to someone on no team', async () => {
    // The configured rollout rule: absent team = nothing, not everything.
    setup({
      role: 'user',
      onTeams: [],
      grants: [{ team: 'team-1', tool: TOOL_A }],
      surfaces: [{ role: 'user', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.toolKeys.size).toBe(0)
    expect(access.canTool(TOOL_A)).toBe(false)
  })

  it('gives no tools when the signed-in user has no directory record', async () => {
    setup({
      role: 'user',
      noPersonRecord: true,
      surfaces: [{ role: 'user', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.toolKeys.size).toBe(0)
  })

  it('unions grants across several teams', async () => {
    setup({
      role: 'user',
      onTeams: ['team-1', 'team-2'],
      grants: [
        { team: 'team-1', tool: TOOL_A },
        { team: 'team-2', tool: TOOL_B },
      ],
      surfaces: [{ role: 'user', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_A)).toBe(true)
    expect(access.canTool(TOOL_B)).toBe(true)
  })
})

describe('loadAccess: audience', () => {
  it("ignores a 'lead' grant for someone who does not lead that team", async () => {
    setup({
      role: 'user',
      onTeams: ['team-1'],
      grants: [{ team: 'team-1', tool: TOOL_A, audience: 'lead' }],
      surfaces: [{ role: 'user', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_A)).toBe(false)
  })

  it("honours a 'lead' grant for the lead of that team", async () => {
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      leads: ['team-1'],
      grants: [{ team: 'team-1', tool: TOOL_A, audience: 'lead' }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_A)).toBe(true)
  })

  it.each(['founder', 'manager', 'team_leader'])("treats %s as leading the team", async position => {
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      leads: ['team-1'],
      leadPosition: position,
      grants: [{ team: 'team-1', tool: TOOL_A, audience: 'lead' }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    expect((await loadAccess()).canTool(TOOL_A)).toBe(true)
  })

  it('does not treat an unrecognised position as leading', async () => {
    // Found by this test failing on a guessed value: the vocabulary is
    // founder / manager / team_leader, and anything else is a collaborator.
    // Fail-closed is the right behaviour, so it is pinned here.
    setup({
      role: 'team_leader',
      onTeams: ['team-1'],
      leads: ['team-1'],
      leadPosition: 'lead',
      grants: [{ team: 'team-1', tool: TOOL_A, audience: 'lead' }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    expect((await loadAccess()).canTool(TOOL_A)).toBe(false)
  })

  it("scopes 'lead' to the team led, not to being a lead somewhere", async () => {
    setup({
      role: 'team_leader',
      onTeams: ['team-1', 'team-2'],
      leads: ['team-1'],
      grants: [{ team: 'team-2', tool: TOOL_A, audience: 'lead' }],
      surfaces: [{ role: 'team_leader', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.canTool(TOOL_A)).toBe(false)
  })
})

describe('loadAccess: a grant for a key the catalogue dropped', () => {
  it('grants nothing', async () => {
    // Removing a tool from the catalogue has to close its route too, not
    // just hide its card. The stale row stays in the table harmlessly.
    setup({
      role: 'user',
      onTeams: ['team-1'],
      grants: [{ team: 'team-1', tool: 'a-tool-that-no-longer-exists' }],
      surfaces: [{ role: 'user', key: 'tools', allowed: true }],
    })
    const access = await loadAccess()
    expect(access.toolKeys.size).toBe(0)
    expect(access.canTool('a-tool-that-no-longer-exists')).toBe(false)
  })
})

describe('loadAccess: admin', () => {
  it('opens every tool with no team and no grants at all', async () => {
    // An admin who belongs to no team must not lose the screens they would need
    // to fix that, so admin is exempt from the team layer entirely.
    setup({ role: 'admin', onTeams: [], grants: [] })
    const access = await loadAccess()
    expect(access.isAdmin).toBe(true)
    for (const t of TOOLS) expect(access.canTool(t.key), t.key).toBe(true)
  })

  it('reaches admin-locked surfaces', async () => {
    setup({ role: 'admin' })
    const access = await loadAccess()
    expect(access.can('settings')).toBe(true)
    expect(access.can('admin')).toBe(true)
  })
})

describe('loadAccess: surfaces', () => {
  it('keeps admin-locked surfaces shut even when configured open', async () => {
    // Settings, Export and Edit-note are admin-only by rule. A row in
    // access_level_pages saying otherwise must not win, or the matrix screen
    // would be able to hand out the API tokens page.
    setup({
      role: 'team_leader',
      surfaces: [
        { role: 'team_leader', key: 'settings', allowed: true },
        { role: 'team_leader', key: 'admin', allowed: true },
      ],
    })
    const access = await loadAccess()
    expect(access.can('settings')).toBe(false)
    expect(access.can('admin')).toBe(false)
  })

  it('always allows the locked-open surfaces', async () => {
    setup({ role: 'user' })
    const access = await loadAccess()
    expect(access.can('home')).toBe(true)
    expect(access.can('dir-base')).toBe(true)
  })

  it('denies an unknown surface key', async () => {
    // Fails closed: a typo'd key in a new page's guard must not open it.
    setup({ role: 'user', surfaces: [{ role: 'user', key: 'not-a-surface', allowed: true }] })
    const access = await loadAccess()
    expect(access.can('not-a-surface')).toBe(false)
  })

  it('lets the configured row override the catalogue default', async () => {
    setup({ role: 'user', surfaces: [{ role: 'user', key: 'tools', allowed: false }] })
    expect((await loadAccess()).can('tools')).toBe(false)

    setup({ role: 'user', surfaces: [{ role: 'user', key: 'tools', allowed: true }] })
    expect((await loadAccess()).can('tools')).toBe(true)
  })
})

describe('requireSurface', () => {
  it('sends someone without the surface Home', async () => {
    setup({ role: 'user', surfaces: [{ role: 'user', key: 'settings', allowed: true }] })
    await expect(requireSurface('settings')).rejects.toThrow('REDIRECT:/')
    expect(redirected).toHaveBeenCalledWith('/')
  })

  it('returns the access it resolved when allowed', async () => {
    setup({ role: 'admin' })
    const access = await requireSurface('settings')
    expect(access.isAdmin).toBe(true)
    expect(redirected).not.toHaveBeenCalled()
  })
})
