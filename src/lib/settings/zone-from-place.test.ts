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
