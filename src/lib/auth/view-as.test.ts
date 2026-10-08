import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signViewAs, verifyViewAs } from './view-as'

/**
 * The View Stage token: which level to preview, the Super Admin who made it,
 * and when it ends, signed with the server's key. A preview can only ever be
 * what a Super Admin signed, for as long as they signed it for.
 */

const KEY = 'SUPABASE_SERVICE_ROLE_KEY'
let saved: string | undefined
beforeEach(() => { saved = process.env[KEY]; process.env[KEY] = 'test-signing-key' })
afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved })

const soon = () => Date.now() + 60_000

describe('View Stage tokens', () => {
  it('verifies what was signed', () => {
    const t = signViewAs({ sadmin: 'sa-1', role: 'user', exp: soon() })
    expect(verifyViewAs(t)).toMatchObject({ sadmin: 'sa-1', role: 'user' })
  })

  it('refuses a token whose body was changed (another level, another admin)', () => {
    const t = signViewAs({ sadmin: 'sa-1', role: 'user', exp: soon() })
    const [, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ sadmin: 'sa-1', role: 'admin', exp: soon() })).toString('base64url')
    expect(verifyViewAs(`${forged}.${sig}`)).toBeNull()
  })

  it('refuses one signed with another key', () => {
    const t = signViewAs({ sadmin: 'sa-1', role: 'user', exp: soon() })
    process.env[KEY] = 'a-different-key'
    expect(verifyViewAs(t)).toBeNull()
  })

  it('refuses an expired token', () => {
    expect(verifyViewAs(signViewAs({ sadmin: 'sa-1', role: 'user', exp: Date.now() - 1 }))).toBeNull()
  })

  it('refuses a level outside the previewable ones, Super Admin included', () => {
    const t = signViewAs({ sadmin: 'sa-1', role: 'super_admin' as never, exp: soon() })
    expect(verifyViewAs(t)).toBeNull()
  })

  it('refuses everything when the server has no key', () => {
    const t = signViewAs({ sadmin: 'sa-1', role: 'user', exp: soon() })
    process.env[KEY] = ''
    expect(verifyViewAs(t)).toBeNull()
  })

  it('refuses garbage', () => {
    for (const t of [null, undefined, '', 'nodot', '.sig', 'body.', 'a.b.c']) expect(verifyViewAs(t)).toBeNull()
  })
})
