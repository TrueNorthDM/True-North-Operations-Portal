import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * resolve.ts joins the access rule (decide.ts, tested on its own) to the
 * request: who is signed in, a View Stage preview, the page guard and the gate
 * for writes. The mocks stop at those edges; the rule and the catalogue are the
 * real ones, so a change to either shows up here.
 */

vi.mock('react', async orig => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))

const redirected = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { redirected(to); throw new Error(`REDIRECT:${to}`) },
}))

let signedIn: { id: string; email: string | null } | null = { id: 'user-1', email: 'someone@goodnewsadvocates.org' }
let realPerson: { id: string } | null = { id: 'p-real' }
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => (signedIn ? { ...signedIn, aal: null } : null),
  getRealPerson: async () => realPerson,
}))

let preview: { role: 'admin' | 'team_leader' | 'user' } | null = null
vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => preview }))

let aalPending = false
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: signedIn } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: aalPending ? { nextLevel: 'aal2', currentLevel: 'aal1' } : { nextLevel: 'aal1', currentLevel: 'aal1' } }) },
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

type Subj = { id: string; name: string; level: string; given: string | null; teams: Map<string, boolean>; exceptions: never[]; profileId: null; status: string }
let subjects: Subj[] = []
vi.mock('@/lib/access/store', () => ({
  loadRules: async () => ({ levels: new Map(), tools: new Map([['href-links', { every: false, teams: new Map([['seo', 'team']]) }]]) }),
  loadSubject: async (_db: unknown, id: string) => subjects.find(s => s.id === id) ?? null,
  loadSubjects: async () => subjects,
}))

const person = (id: string, level: string, teams: [string, boolean][] = []): Subj =>
  ({ id, name: id, level, given: level === 'super_admin' || level === 'admin' ? level : null, teams: new Map(teams), exceptions: [], profileId: null, status: 'active' })

import { allowedTo, loadAccess, requireSurface } from './resolve'

beforeEach(() => {
  redirected.mockClear()
  signedIn = { id: 'user-1', email: 'someone@goodnewsadvocates.org' }
  realPerson = { id: 'p-real' }
  preview = null
  aalPending = false
  subjects = [person('p-real', 'team_leader', [['seo', true]]), person('p-admin', 'admin'), person('p-user', 'user')]
})

describe('loadAccess', () => {
  it('answers for the signed-in person, tools included', async () => {
    const a = await loadAccess()
    expect(a.level).toBe('team_leader')
    expect(a.can('my-work')).toBe(true)
    expect(a.canTool('href-links')).toBe(true)
    expect(a.canTool('publishing')).toBe(false)
    expect(a.can('tools')).toBe(true) // the older key reads as the Tools module
    expect(a.isAdmin).toBe(false)
  })

  it('treats someone with no directory record as a User on no team', async () => {
    realPerson = null
    const a = await loadAccess()
    expect(a.level).toBe('user')
    expect(a.can('home')).toBe(true)
    expect(a.toolKeys.size).toBe(0)
    expect(a.can('directory')).toBe(false)
  })

  it('gives the founding account everything, linked or not', async () => {
    signedIn = { id: 'u0', email: 'arnaldo.oliveira@me.com' }
    realPerson = null
    const a = await loadAccess()
    expect(a.isSuperAdmin).toBe(true)
    expect(a.can('access-levels')).toBe(true)
  })

  it('shows a preview as the first person of that level', async () => {
    preview = { role: 'user' }
    const a = await loadAccess()
    expect(a.level).toBe('user')
    expect(a.personId).toBe('p-user')
  })
})

describe('requireSurface', () => {
  it('sends someone without the item Home', async () => {
    await expect(requireSurface('access-levels')).rejects.toThrow('REDIRECT:/')
    expect(redirected).toHaveBeenCalledWith('/')
  })

  it('returns the access it resolved when allowed', async () => {
    const a = await requireSurface('my-work')
    expect(a.can('my-work')).toBe(true)
  })
})

describe('allowedTo, the gate for writes', () => {
  it('allows what the real person may do', async () => {
    subjects[0] = person('p-real', 'admin')
    expect(await allowedTo('d-edit')).toBe(true)
  })

  it('refuses while the second step of two-step sign-in is owed', async () => {
    subjects[0] = person('p-real', 'admin')
    aalPending = true
    expect(await allowedTo('d-edit')).toBe(false)
  })

  it('lets a preview take powers away, never add them', async () => {
    subjects[0] = person('p-real', 'super_admin')
    preview = { role: 'user' }
    expect(await allowedTo('d-edit')).toBe(false)
    subjects[0] = person('p-real', 'user')
    preview = { role: 'admin' }
    expect(await allowedTo('d-edit')).toBe(false)
  })

  it('refuses a signed-out caller', async () => {
    signedIn = null
    expect(await allowedTo('home')).toBe(false)
  })
})
