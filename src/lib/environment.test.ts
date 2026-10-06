import { describe, it, expect } from 'vitest'
import { stagingMayEmail } from './environment'

describe('stagingMayEmail', () => {
  it('sends only to the listed addresses, whatever the case or spacing', () => {
    expect(stagingMayEmail('Arnaldo.Oliveira@me.com ', 'arnaldo.oliveira@me.com, tester@goodnewsadvocates.org')).toBe(true)
    expect(stagingMayEmail('tester@goodnewsadvocates.org', ' arnaldo.oliveira@me.com ,tester@goodnewsadvocates.org')).toBe(true)
  })

  it('refuses anyone else', () => {
    expect(stagingMayEmail('someone@goodnewsadvocates.org', 'arnaldo.oliveira@me.com')).toBe(false)
  })

  it('sends nothing when the list is empty or missing', () => {
    expect(stagingMayEmail('arnaldo.oliveira@me.com', '')).toBe(false)
    expect(stagingMayEmail('arnaldo.oliveira@me.com', undefined)).toBe(false)
  })
})
