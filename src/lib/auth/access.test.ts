import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client so we can drive rpc(), and the session module
// so we can drive who is signed in. Site access reads the identity the render
// already resolved (lib/auth/session.ts) rather than asking Supabase again.
const rpc = vi.fn()
const sessionUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc }),
}))
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => sessionUser() }))

// The fail-open path logs via console.error by design, keep test output clean.
vi.spyOn(console, 'error').mockImplementation(() => {})

import { getAccessibleSiteIds, canAccessSite } from './access'

beforeEach(() => {
  rpc.mockReset()
  sessionUser.mockReset()
})

describe('getAccessibleSiteIds', () => {
  it('returns an empty set when there is no signed-in user', async () => {
    sessionUser.mockResolvedValue(null)
    expect(await getAccessibleSiteIds()).toEqual(new Set())
  })

  it('returns the granted site ids from the RPC', async () => {
    sessionUser.mockResolvedValue({ id: 'u1', email: null })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }, { site_id: 'b' }], error: null })
    expect(await getAccessibleSiteIds()).toEqual(new Set(['a', 'b']))
  })

  it('fails OPEN (null) when the RPC errors, nothing is hidden', async () => {
    sessionUser.mockResolvedValue({ id: 'u1', email: null })
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } })
    expect(await getAccessibleSiteIds()).toBeNull()
  })
})

describe('canAccessSite', () => {
  it('fails CLOSED (false) when access cannot be evaluated', async () => {
    // A database blip must not read as an access grant. The visible cost is
    // an empty Projects list, which is the failure you want to notice.
    sessionUser.mockResolvedValue({ id: 'u1', email: null })
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await canAccessSite('any-site')).toBe(false)
  })

  it('allows a site in the granted set and denies one outside it', async () => {
    sessionUser.mockResolvedValue({ id: 'u1', email: null })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }], error: null })
    expect(await canAccessSite('a')).toBe(true)

    sessionUser.mockResolvedValue({ id: 'u1', email: null })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }], error: null })
    expect(await canAccessSite('b')).toBe(false)
  })
})
