import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client so we can drive auth.getUser() and rpc().
const rpc = vi.fn()
const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}))

// The fail-open path logs via console.error by design — keep test output clean.
vi.spyOn(console, 'error').mockImplementation(() => {})

import { getAccessibleSiteIds, canAccessSite } from './access'

beforeEach(() => {
  rpc.mockReset()
  getUser.mockReset()
})

describe('getAccessibleSiteIds', () => {
  it('returns an empty set when there is no signed-in user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await getAccessibleSiteIds()).toEqual(new Set())
  })

  it('returns the granted site ids from the RPC', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }, { site_id: 'b' }], error: null })
    expect(await getAccessibleSiteIds()).toEqual(new Set(['a', 'b']))
  })

  it('fails OPEN (null) when the RPC errors — nothing is hidden', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } })
    expect(await getAccessibleSiteIds()).toBeNull()
  })
})

describe('canAccessSite', () => {
  it('fails OPEN (true) when access cannot be evaluated', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await canAccessSite('any-site')).toBe(true)
  })

  it('allows a site in the granted set and denies one outside it', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }], error: null })
    expect(await canAccessSite('a')).toBe(true)

    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: [{ site_id: 'a' }], error: null })
    expect(await canAccessSite('b')).toBe(false)
  })
})
