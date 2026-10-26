import { describe, expect, it } from 'vitest'
import { docNumber, seqOf, seqText } from './doc-number'

describe('document numbers', () => {
  it('pads the count to three digits and lets it grow past them', () => {
    expect(seqText(1)).toBe('001')
    expect(seqText(59)).toBe('059')
    expect(seqText(1234)).toBe('1234')
  })
  it('keeps counting when the year changes', () => {
    expect(docNumber('INV', 2026, 59)).toBe('INV-2026-059')
    expect(docNumber('INV', 2027, 60)).toBe('INV-2027-060')
  })
  it('reads the count back from either width', () => {
    expect(seqOf('INV-2027-060')).toBe(60)
    expect(seqOf('INV-2026-0011')).toBe(11)
    expect(seqOf('RMB-2026-1234')).toBe(1234)
    expect(seqOf('nothing')).toBe(0)
  })
})
