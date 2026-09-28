import { describe, it, expect } from 'vitest'
import { mayUsePortal, portalAccessState, isFounding } from './portal-rule'

const invited = { status: 'active', email_goodnews: 'ana@goodnewsadvocates.org', portal_invited_at: '2026-09-28T12:00:00Z' }

describe('mayUsePortal', () => {
  it('lets an active, invited person keep using the portal', () => {
    expect(mayUsePortal('ana@goodnewsadvocates.org', invited)).toBe(true)
  })

  it('closes access when the person is made inactive', () => {
    expect(mayUsePortal('ana@goodnewsadvocates.org', { ...invited, status: 'inactive' })).toBe(false)
  })

  it('closes access when the invitation is revoked', () => {
    expect(mayUsePortal('ana@goodnewsadvocates.org', { ...invited, portal_invited_at: null })).toBe(false)
  })

  it('refuses a session with no person behind it', () => {
    expect(mayUsePortal('office@goodnewsadvocates.org', null)).toBe(false)
  })

  it('keeps a session opened on an older address while the person is invited', () => {
    // An account from before migration 089 carries its old address until it is moved.
    expect(mayUsePortal('someone@truenorthdigitalmarketing.com', invited)).toBe(true)
  })

  it('always lets the founding account in, whatever the directory says', () => {
    expect(mayUsePortal('arnaldo.oliveira@me.com', null)).toBe(true)
    expect(mayUsePortal(' Arnaldo.Oliveira@ME.com ', null)).toBe(true)
    expect(isFounding('someone@me.com')).toBe(false)
  })

  it('treats a missing status as active', () => {
    expect(mayUsePortal('ana@goodnewsadvocates.org', { ...invited, status: null })).toBe(true)
  })
})

describe('portalAccessState', () => {
  it('reads where a person stands, in order of what blocks them first', () => {
    expect(portalAccessState({ ...invited, status: 'inactive', hasAccount: true })).toBe('inactive')
    expect(portalAccessState({ ...invited, email_goodnews: null, hasAccount: false })).toBe('no-address')
    expect(portalAccessState({ ...invited, portal_invited_at: null, hasAccount: false })).toBe('not-invited')
    expect(portalAccessState({ ...invited, hasAccount: false })).toBe('invited')
    expect(portalAccessState({ ...invited, hasAccount: true })).toBe('signed-in')
  })
})
