import { describe, it, expect } from 'vitest'
import { skipsSession } from './no-session-paths'

describe('skipsSession', () => {
  it('skips the machine routes', () => {
    expect(skipsSession('/api/cron')).toBe(true)
    expect(skipsSession('/api/cron/ingest')).toBe(true)
    expect(skipsSession('/api/cron/monday-worklist')).toBe(true)
    expect(skipsSession('/api/monday/webhook')).toBe(true)
    expect(skipsSession('/api/monday/webhook/LKROyVgUY7-OhrqzX2ewM2z')).toBe(true)
  })

  // Public to the proxy, but a signed-in person calls it with their cookie. If it
  // skipped the session, an expired token would never be refreshed for it.
  it('does not skip item history, which reads the signed-in session', () => {
    expect(skipsSession('/api/monday/item-history')).toBe(false)
  })

  // The trap in any prefix rule: a sibling that merely starts with the same letters.
  it('does not match a path that only shares the prefix', () => {
    expect(skipsSession('/api/cronjob')).toBe(false)
    expect(skipsSession('/api/cron-admin')).toBe(false)
    expect(skipsSession('/api/monday/webhooks')).toBe(false)
    expect(skipsSession('/api/monday/webhook-test')).toBe(false)
  })

  it('never skips pages or the sign-in flow', () => {
    for (const p of ['/', '/login', '/auth/callback', '/work-tools', '/admin', '/my-work', '/api/monday', '/api/snapshot']) {
      expect(skipsSession(p)).toBe(false)
    }
  })
})
