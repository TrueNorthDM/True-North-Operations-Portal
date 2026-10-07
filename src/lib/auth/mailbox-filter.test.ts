import { describe, it, expect } from 'vitest'
import { mailboxFilter } from './mailbox-filter'

describe('mailboxFilter', () => {
  it('builds the filter for a plain address', () => {
    expect(mailboxFilter('ana.souza+x@goodnewsadvocates.org')).toBe(
      'email_personal.eq.ana.souza+x@goodnewsadvocates.org,email_true_north.eq.ana.souza+x@goodnewsadvocates.org,email_goodnews.eq.ana.souza+x@goodnewsadvocates.org,email_coe.eq.ana.souza+x@goodnewsadvocates.org',
    )
  })

  it('refuses anything that could add a filter of its own', () => {
    for (const bad of ['a@b.org,access_level.eq.super_admin', 'a@b.org)', 'a(b@c.org', 'a b@c.org', '', null, undefined, 'not-an-address']) {
      expect(mailboxFilter(bad), String(bad)).toBeNull()
    }
  })
})
