import { describe, it, expect } from 'vitest'
import { langChipStyle } from './lang-chip'

describe('langChipStyle', () => {
  it('uses the flag colour, with navy words on a light flag', () => {
    expect(langChipStyle('es')).toEqual({ backgroundColor: '#F5B800', color: '#012358' })
    expect(langChipStyle('sw')).toEqual({ backgroundColor: '#00A3DD', color: '#ffffff' })
    expect(langChipStyle('en').color).toBe('#ffffff')
  })
  it('gives a language without a flag colour a chip too', () => {
    expect(langChipStyle('xx').backgroundColor).toMatch(/^#/)
  })
})
