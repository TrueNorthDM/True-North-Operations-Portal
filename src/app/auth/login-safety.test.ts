import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sign-in screen after the security audit of 8 November 2026: it never says
 * who is invited, a stranger cannot use up someone else's codes, and the
 * authenticator code cannot be guessed by trying.
 */

let visitorIp = '203.0.113.1'
const store = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() }
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (n: string) => (n === 'x-forwarded-for' ? visitorIp : null) }),
  cookies: async () => store,
}))
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`) } }))

const otp = vi.fn(async () => ({ error: null }))
const verifyOtp = vi.fn(async () => ({ data: { user: null }, error: { message: 'bad' } }))
const challengeAndVerify = vi.fn(async () => ({ error: { message: 'bad' } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithOtp: otp, verifyOtp, mfa: { challengeAndVerify, listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }] } }) } } }),
}))
let invited = new Set(['ana@goodnewsadvocates.org'])
vi.mock('@/lib/auth/portal-access', () => ({ canSignIn: async (e: string) => invited.has(e) }))
vi.mock('@/lib/auth/origin', () => ({ requestOrigin: async () => 'https://portal.test' }))
vi.mock('@/lib/auth/start-page', () => ({ withStartPage: (n: string) => n }))
vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => null }))
vi.mock('@/lib/auth/session', () => ({ getSessionUser: async () => ({ id: 'user-1', email: 'ana@goodnewsadvocates.org', aal: 'aal1' }) }))
vi.mock('@/lib/auth/two-step', () => ({ SKIP_COOKIE: 'x', checkTwoStep: async () => ({ need: 'ok' }) }))

import { sendMagicLink, verifyCode } from './actions'
import { verifyTwoStep } from './two-step-actions'

beforeEach(() => { otp.mockClear(); verifyOtp.mockClear(); challengeAndVerify.mockClear(); visitorIp = `203.0.113.${Math.floor(Math.random() * 200) + 2}` })

describe('who is invited stays private', () => {
  it('answers an address that is not invited exactly like one that is, and sends it nothing', async () => {
    const a = await sendMagicLink({ email: 'stranger@goodnewsadvocates.org' })
    const b = await sendMagicLink({ email: 'ana@goodnewsadvocates.org' })
    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(otp).toHaveBeenCalledTimes(1)
  })
  it('gives the same wrong-code answer whether or not the address is invited', async () => {
    const a = await verifyCode({ email: 'stranger@goodnewsadvocates.org', code: '123456' })
    const b = await verifyCode({ email: 'ana@goodnewsadvocates.org', code: '123456' })
    expect(a).toEqual(b)
  })
})

describe('a stranger cannot use up someone else\'s codes', () => {
  it('stops the stranger after five, while the real person can still ask from their own address', async () => {
    invited = new Set(['bea@goodnewsadvocates.org'])
    visitorIp = '198.51.100.9'
    for (let i = 0; i < 5; i++) expect((await sendMagicLink({ email: 'bea@goodnewsadvocates.org' })).ok).toBe(true)
    expect((await sendMagicLink({ email: 'bea@goodnewsadvocates.org' })).ok).toBe(false)
    visitorIp = '192.0.2.44'
    expect((await sendMagicLink({ email: 'bea@goodnewsadvocates.org' })).ok).toBe(true)
  })
})

describe('authenticator codes cannot be guessed by trying', () => {
  it('refuses a sixth code within five minutes without asking the sign-in service', async () => {
    for (let i = 0; i < 5; i++) expect(await verifyTwoStep('000000')).toMatchObject({ ok: false, error: expect.stringMatching(/not right/) })
    expect(await verifyTwoStep('000000')).toMatchObject({ ok: false, error: expect.stringMatching(/Too many codes/) })
    expect(challengeAndVerify).toHaveBeenCalledTimes(5)
  })
})
