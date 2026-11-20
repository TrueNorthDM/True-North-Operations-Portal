import { describe, expect, it } from 'vitest'
import { addressZoneChoices, normalizeAddress, zoneOfAddress } from './address'

const form = (over: Record<string, string>) => ({ country: 'US', zip: '', line1: '', line2: '', city: '', state: '', zone: '', ...over })

describe('the time zone of an address in a state with two (owner, 20 November 2026)', () => {
  it('reads McDonald, Tennessee as Eastern, and Nashville as Central', () => {
    expect(zoneOfAddress({ country: 'US', state: 'Tn', city: 'McDonald', zip: '37353' })).toMatchObject({ zone: 'America/New_York', decided: true })
    expect(zoneOfAddress({ country: 'US', state: 'TN', city: 'Nashville' }).zone).toBe('America/Chicago')
  })
  it('takes the zone the person chose, when it is one of the state\'s two', () => {
    expect(zoneOfAddress({ country: 'US', state: 'TN', city: 'Nashville', zone: 'America/New_York' })).toMatchObject({ zone: 'America/New_York', decided: true })
    expect(zoneOfAddress({ country: 'US', state: 'Oregon', zone: 'America/Denver' }).zone).toBe('America/Denver')
    // A zone that is not one of the two is not trusted.
    expect(zoneOfAddress({ country: 'US', state: 'TN', city: 'Nashville', zone: 'Asia/Tokyo' }).zone).toBe('America/Chicago')
  })
  it('offers the choice only where the state has two zones', () => {
    expect(addressZoneChoices({ country: 'US', state: 'Tennessee' })).toEqual(['America/Chicago', 'America/New_York'])
    expect(addressZoneChoices({ country: 'US', state: 'Virginia' })).toBeNull()
    expect(addressZoneChoices({ country: 'BR', state: 'CE' })).toBeNull()
  })
  it('keeps a chosen zone on save only when it belongs to the state', () => {
    expect(normalizeAddress(form({ state: 'TN', zone: 'America/New_York' }))?.zone).toBe('America/New_York')
    expect(normalizeAddress(form({ state: 'TN', zone: 'Asia/Tokyo' }))?.zone).toBeUndefined()
    expect(normalizeAddress(form({ state: 'VA', zone: 'America/Chicago' }))?.zone).toBeUndefined()
  })
})
