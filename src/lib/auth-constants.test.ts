import { describe, it, expect } from 'vitest'
import { isAllowedEmail } from './auth-constants'

describe('isAllowedEmail', () => {
  it('allows the GoodNews domain only', () => {
    expect(isAllowedEmail('someone@goodnewsadvocates.org')).toBe(true)
    // One address per person since migration 089: the True North mailbox no
    // longer signs in, so nobody ends up with two accounts.
    expect(isAllowedEmail('someone@truenorthdigitalmarketing.com')).toBe(false)
  })

  it('allows a named exception regardless of domain', () => {
    expect(isAllowedEmail('arnaldo.oliveira@me.com')).toBe(true)
  })

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(isAllowedEmail('  SOMEONE@GoodNewsAdvocates.ORG ')).toBe(true)
    expect(isAllowedEmail(' Arnaldo.Oliveira@ME.com ')).toBe(true)
  })

  it('rejects other domains', () => {
    expect(isAllowedEmail('hacker@evil.com')).toBe(false)
  })

  it('rejects a look-alike domain (the @ boundary must match)', () => {
    // ends with "goodnewsadvocates.org" but not "@goodnewsadvocates.org"
    expect(isAllowedEmail('x@notgoodnewsadvocates.org')).toBe(false)
  })

  it('rejects empty or malformed input', () => {
    expect(isAllowedEmail('')).toBe(false)
    expect(isAllowedEmail('nodomain')).toBe(false)
  })
})
