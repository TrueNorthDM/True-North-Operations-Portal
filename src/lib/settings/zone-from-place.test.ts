import { describe, it, expect } from 'vitest'
import { zoneFromPlace } from './zone-from-place'

// The locations people have in the Directory (6 November 2026).
describe('a time zone from where a person lives', () => {
  it('reads Brazil by its state', () => {
    expect(zoneFromPlace('BR', 'Fortaleza - State of Ceará, Brazil')).toBe('America/Fortaleza')
    expect(zoneFromPlace('BR', 'Vitória da Conquista, State of Bahia, Brazil')).toBe('America/Bahia')
    expect(zoneFromPlace('BR', 'São Paulo, Brazil')).toBe('America/Sao_Paulo')
  })
  it('reads the US by its state, name or code', () => {
    expect(zoneFromPlace('US', 'Beaverton, OR, USA')).toBe('America/Los_Angeles')
    expect(zoneFromPlace('US', 'Beaverton, MI 48612, USA')).toBe('America/New_York')
    expect(zoneFromPlace('US', 'Loveland, CO, USA')).toBe('America/Denver')
    expect(zoneFromPlace('US', 'Chattanooga, TN, USA')).toBe('America/Chicago')
    expect(zoneFromPlace('US', 'Montana, USA')).toBe('America/Denver')
    expect(zoneFromPlace('US', 'California, USA')).toBe('America/Los_Angeles')
    expect(zoneFromPlace('US', 'Fairfax, VA, USA')).toBe('America/New_York')
    expect(zoneFromPlace('US', 'Wenatchee, WA 98801, USA')).toBe('America/Los_Angeles')
  })
  it('reads one-zone countries and the rest', () => {
    expect(zoneFromPlace('KE', 'Nairobi, Kenya')).toBe('Africa/Nairobi')
    expect(zoneFromPlace('RW', 'Kigali City, Kigali, Rwanda')).toBe('Africa/Kigali')
    expect(zoneFromPlace('TZ', 'Arusha, Tanzania')).toBe('Africa/Dar_es_Salaam')
    expect(zoneFromPlace('NG', 'Ilishan-Remo, Nigeria')).toBe('Africa/Lagos')
    expect(zoneFromPlace('VE', 'Venezuela')).toBe('America/Caracas')
    expect(zoneFromPlace('CA', 'British Columbia, Canada')).toBe('America/Vancouver')
    expect(zoneFromPlace('MX', 'Montemorelos, Nuevo Leon, Mexico')).toBe('America/Monterrey')
  })
  it('gives nothing it cannot tell', () => {
    expect(zoneFromPlace(null, 'Somewhere')).toBeNull()
    expect(zoneFromPlace('ZZ', 'Nowhere')).toBeNull()
  })
  it('names only real zones', () => {
    for (const z of ['America/Fortaleza', 'America/Bahia', 'Africa/Dar_es_Salaam', 'America/Monterrey', 'America/Vancouver']) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: z })).not.toThrow()
    }
  })
})

describe('states with two time zones (owner, 20 November 2026)', () => {
  it('knows which states have two, and gives the two', async () => {
    const { splitZones } = await import('./zone-from-place')
    expect(splitZones('US', 'TN')).toEqual(['America/Chicago', 'America/New_York'])
    expect(splitZones('US', 'Tennessee')).toEqual(['America/Chicago', 'America/New_York'])
    expect(splitZones('US', 'Oregon')).toEqual(['America/Los_Angeles', 'America/Denver'])
    expect(splitZones('US', 'Virginia')).toBeNull()
    expect(splitZones('BR', 'TN')).toBeNull()
  })
  it('guesses Eastern for East Tennessee by city or ZIP, and nothing where it is not sure', async () => {
    const { splitGuess } = await import('./zone-from-place')
    expect(splitGuess('Tn', 'McDonald', '37353')).toBe('America/New_York')
    expect(splitGuess('TN', 'Somewhere', '37421')).toBe('America/New_York')
    expect(splitGuess('TN', 'Nashville', '37203')).toBeNull()
    expect(splitGuess('TN', 'Tullahoma', '37388')).toBeNull()
  })
})
