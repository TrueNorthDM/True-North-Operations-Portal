import { describe, expect, it } from 'vitest'
import { DEVICE_MAX_AGE, codeHash, codeMatches, deviceEmail, devicePass } from './secrets'

const S = 'a-test-secret-only'
const now = Date.parse('2026-11-01T12:00:00Z')

describe('the code is kept only as a hash', () => {
  it('matches the right code for the right email, nothing else', () => {
    const h = codeHash('ana@example.com', '123456', S)
    expect(h).not.toContain('123456')
    expect(codeMatches(h, 'ana@example.com', '123456', S)).toBe(true)
    expect(codeMatches(h, 'ana@example.com', '123457', S)).toBe(false)
    expect(codeMatches(h, 'bo@example.com', '123456', S)).toBe(false)
    expect(codeMatches(h, 'ana@example.com', '123456', 'another-secret')).toBe(false)
  })

  it('is closed without the secret', () => {
    expect(() => codeHash('ana@example.com', '123456', '')).toThrow()
    expect(codeMatches('x', 'ana@example.com', '123456', '')).toBe(false)
  })
})

describe('the device remembers a proved email for 30 days', () => {
  it('gives the email back while it lasts', () => {
    const pass = devicePass('ana@example.com', now, S)
    expect(deviceEmail(pass, now, S)).toBe('ana@example.com')
    expect(deviceEmail(pass, now + DEVICE_MAX_AGE * 1000 - 1, S)).toBe('ana@example.com')
    expect(deviceEmail(pass, now + DEVICE_MAX_AGE * 1000, S)).toBeNull()
  })

  it('refuses a changed email, a changed date, another secret, or junk', () => {
    const pass = devicePass('ana@example.com', now, S)
    const [, exp, sig] = pass.split('.')
    expect(deviceEmail(`${Buffer.from('bo@example.com').toString('base64url')}.${exp}.${sig}`, now, S)).toBeNull()
    expect(deviceEmail(pass.replace(exp, String(Number(exp) + 1000)), now, S)).toBeNull()
    expect(deviceEmail(pass, now, 'another-secret')).toBeNull()
    expect(deviceEmail('nonsense', now, S)).toBeNull()
    expect(deviceEmail(pass, now, '')).toBeNull()
  })
})
