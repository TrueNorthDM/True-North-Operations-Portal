import { describe, expect, it } from 'vitest'
import { authUrl, connectNotice, idTokenClaims, missingScopes, onApprovedDomain, readStateCookie, SCOPES, stateCookie } from './google-oauth'

const PERSON = '0b6f3c1e-2a4d-4e8f-9b10-1c2d3e4f5a6b'
const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`

describe('the Google sign-in address', () => {
  it('asks for every scope, offline, with consent so a refresh token comes back', () => {
    const u = new URL(authUrl({ clientId: 'abc.apps.googleusercontent.com' }, 'https://staging.truenorthportal.online/api/agenda/google/callback', 'S'.repeat(32)))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('scope')).toBe(SCOPES.join(' '))
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toContain('consent')
    expect(u.searchParams.get('redirect_uri')).toBe('https://staging.truenorthportal.online/api/agenda/google/callback')
    expect(u.searchParams.get('login_hint')).toBeNull()
  })

  it('suggests office@ for the team calendar', () => {
    const u = new URL(authUrl({ clientId: 'abc' }, 'https://x/cb', 'S'.repeat(32), 'office@truenorthdigitalmarketing.com'))
    expect(u.searchParams.get('login_hint')).toBe('office@truenorthdigitalmarketing.com')
  })
})

describe('the state cookie', () => {
  it('reads back what it wrote', () => {
    const s = 'A1b2C3d4E5f6G7h8I9j0K1l2'
    expect(readStateCookie(stateCookie(s, 'team', PERSON))).toEqual({ state: s, purpose: 'team', personId: PERSON })
  })
  it('refuses anything else', () => {
    expect(readStateCookie(undefined)).toBeNull()
    expect(readStateCookie('short.me.' + PERSON)).toBeNull()
    expect(readStateCookie(`${'a'.repeat(24)}.admin.${PERSON}`)).toBeNull()
  })
})

describe('the answer from Google', () => {
  it('reads who signed in from the ID token', () => {
    expect(idTokenClaims(jwt({ email: 'Office@TrueNorthDigitalMarketing.com', sub: '123', email_verified: true })))
      .toEqual({ email: 'office@truenorthdigitalmarketing.com', sub: '123', verified: true })
    expect(idTokenClaims('nonsense')).toBeNull()
    expect(idTokenClaims(jwt({ sub: '1' }))).toBeNull()
  })

  it('needs the two calendar scopes; Drive is optional', () => {
    expect(missingScopes(SCOPES.join(' '))).toEqual([])
    expect(missingScopes('openid https://www.googleapis.com/auth/calendar.events')).toEqual(['https://www.googleapis.com/auth/calendar.freebusy'])
  })

  it('takes only the True North domain until Google approves the portal', () => {
    expect(onApprovedDomain('ana@truenorthdigitalmarketing.com')).toBe(true)
    expect(onApprovedDomain('ana@gmail.com')).toBe(false)
    expect(onApprovedDomain('ana@evil-truenorthdigitalmarketing.com')).toBe(false)
  })
})

describe('what Agenda settings says afterwards', () => {
  it('words every outcome and ignores unknown codes', () => {
    expect(connectNotice('connected', 'ana@truenorthdigitalmarketing.com')).toEqual({ text: 'ana@truenorthdigitalmarketing.com is connected to Google.', error: false })
    expect(connectNotice('domain', 'ana@gmail.com')?.error).toBe(true)
    expect(connectNotice('connected', '<b>x</b>')?.text).toBe('That account is connected to Google.')
    expect(connectNotice('whatever')).toBeNull()
    expect(connectNotice(null)).toBeNull()
  })
})
