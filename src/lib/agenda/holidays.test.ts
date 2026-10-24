import { describe, expect, it } from 'vitest'
import { countryOf, nationalHolidays } from './holidays'
import { countryName, flagOf } from './model'

describe('where a person lives', () => {
  it('reads the address country first, then the end of the location', () => {
    expect(countryOf({ country: 'br' }, 'Nairobi, Kenya')).toBe('BR')
    expect(countryOf(null, 'Nairobi, Kenya')).toBe('KE')
    expect(countryOf({ country: '' }, 'Los Angeles, California, USA')).toBe('US')
    expect(countryOf(null, 'Fortaleza, Brazil')).toBe('BR')
    expect(countryOf(null, 'London, UK')).toBe('GB')
    expect(countryOf(null, null)).toBeNull()
    expect(countryOf(null, 'Somewhere')).toBeNull()
  })
})

describe('national holidays', () => {
  it('lists a country\'s public holidays in English, in the days asked', () => {
    const ke = nationalHolidays('KE', '2026-12-01', '2026-12-31')
    expect(ke.get('2026-12-12')).toBe('Jamhuri Day')
    expect([...ke.keys()].every(d => d >= '2026-12-01' && d <= '2026-12-31')).toBe(true)
    expect(nationalHolidays('BR', '2026-11-01', '2026-11-30').get('2026-11-15')).toBe('Republic Day')
  })
  it('shows nothing for a country it does not know', () => {
    expect(nationalHolidays('ZZ', '2026-01-01', '2026-12-31').size).toBe(0)
  })
  it('draws the flag and names the country', () => {
    expect(flagOf('KE')).toBe('\u{1F1F0}\u{1F1EA}')
    expect(flagOf(null)).toBe('')
    expect(countryName('KE')).toBe('Kenya')
  })
})
