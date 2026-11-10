import { describe, it, expect } from 'vitest'
import { addressZoneText, placeOf, zoneOfAddress } from './address'
import { countryCode } from './countries'

describe('where someone lives, from the address', () => {
  it('says city, state and country name, skipping empty parts', () => {
    expect(placeOf({ country: 'BR', state: 'CE', city: 'Fortaleza', line1: 'Rua X, 123' })).toBe('Fortaleza, CE, Brazil')
    expect(placeOf({ country: 'US', city: 'Austin', state: '' })).toBe('Austin, United States')
    expect(placeOf({ country: 'KE' })).toBe('Kenya')
    expect(placeOf({ country: 'Brazil', city: 'Recife' })).toBe('Recife, Brazil')
    expect(placeOf({ line1: 'Only a street' })).toBeNull()
    expect(placeOf(null)).toBeNull()
  })
})

describe('a country typed as a code or a name', () => {
  it('reads both', () => {
    expect(countryCode('br')).toBe('BR')
    expect(countryCode('Brazil')).toBe('BR')
    expect(countryCode('USA')).toBe('US')
    expect(countryCode('United States')).toBe('US')
    expect(countryCode('uk')).toBe('GB')
    expect(countryCode('Kenya')).toBe('KE')
    expect(countryCode('Atlantis')).toBeNull()
    expect(countryCode('')).toBeNull()
  })
})

describe('the time zone from the address', () => {
  it('reads the country and the state', () => {
    expect(zoneOfAddress({ country: 'BR', state: 'Ceará', city: 'Fortaleza' })).toEqual({ zone: 'America/Fortaleza', country: 'BR', decided: true, missing: null })
    expect(zoneOfAddress({ country: 'US', state: 'OR', city: 'Beaverton' }).zone).toBe('America/Los_Angeles')
    expect(zoneOfAddress({ country: 'US', state: 'VA', city: 'Fairfax' })).toMatchObject({ zone: 'America/New_York', decided: true })
    expect(zoneOfAddress({ country: 'Kenya', city: 'Nairobi' })).toMatchObject({ zone: 'Africa/Nairobi', country: 'KE', decided: true })
  })
  it('says when it cannot tell, and keeps New York', () => {
    expect(zoneOfAddress(null)).toMatchObject({ zone: 'America/New_York', decided: false, missing: 'country' })
    expect(zoneOfAddress({ country: 'US', city: 'Austin' })).toMatchObject({ zone: 'America/New_York', decided: false, missing: 'state' })
    expect(zoneOfAddress({ country: 'IS' })).toMatchObject({ zone: 'America/New_York', decided: false, missing: 'known-zone' })
  })
  it('words it for the profile and Settings', () => {
    expect(addressZoneText({ country: 'BR', state: 'CE', city: 'Fortaleza' })).toBe('Brasília time (BRT), Fortaleza')
    expect(addressZoneText({ country: 'US' })).toBe('Eastern time (ET), New York (add the state to set it)')
    expect(addressZoneText(null)).toBe('Eastern time (ET), New York (add the country to set it)')
  })
})
