import { describe, it, expect } from 'vitest'
import { splitPhone } from './PhoneField'

describe('a stored phone, split for the field', () => {
  it('reads the country from the calling code', () => {
    expect(splitPhone('5585986839825', 'US')).toEqual({ country: 'BR', national: '85986839825' })
    expect(splitPhone('+1 407 555 0142', 'BR')).toEqual({ country: 'US', national: '4075550142' })
    expect(splitPhone('254712345678', 'US')).toEqual({ country: 'KE', national: '712345678' })
  })
  it('starts on the address country when empty', () => {
    expect(splitPhone('', 'BR')).toEqual({ country: 'BR', national: '' })
  })
})
