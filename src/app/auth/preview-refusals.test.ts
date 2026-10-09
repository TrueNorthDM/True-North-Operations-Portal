import { describe, it, expect, vi, beforeEach } from 'vitest'

// In a View Stage preview the page is someone else's but the session is the
// Super Admin's own: these two would act on the Super Admin's account
// (audit, 9 October 2026).
let viewAs: object | null = null
const signOut = vi.fn(async () => ({ error: null }))
const unenroll = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => viewAs }))
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }), headers: async () => new Map() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signOut,
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' } }),
        listFactors: async () => ({ data: { all: [{ id: 'f1' }] } }),
        unenroll,
      },
    },
  }),
}))

const { signOutEverywhere } = await import('./actions')
const { moveTwoStep } = await import('./two-step-actions')

beforeEach(() => { viewAs = null; signOut.mockClear(); unenroll.mockClear() })

describe('account actions refuse a View Stage preview', () => {
  it('"Sign out on all devices"', async () => {
    viewAs = {}
    expect((await signOutEverywhere()).ok).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('"Move to a new phone"', async () => {
    viewAs = {}
    expect((await moveTwoStep())?.ok).toBe(false)
    expect(unenroll).not.toHaveBeenCalled()
  })

  it('outside a preview they act, and a failed sign-out says so', async () => {
    await expect(signOutEverywhere()).rejects.toThrow('redirect /login')
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
    signOut.mockResolvedValueOnce({ error: { message: 'down' } } as never)
    expect(await signOutEverywhere()).toEqual({ ok: false, error: 'Could not sign out every device. Try again in a moment.' })
  })
})
