import { describe, it, expect } from 'vitest'
import { textOn } from './StatusChip'

describe('textOn (audit, 10 October 2026)', () => {
  it("puts dark text on Monday's light labels and white on its dark ones", () => {
    expect(textOn('#FDAB3D')).toBe('#012358') // Working on it
    expect(textOn('#00C875')).toBe('#012358') // Done
    expect(textOn('#784BD1')).toBe('#ffffff')
    expect(textOn('#E2445C')).toBe('#ffffff') // Stuck
  })

  it('falls back to white for a colour it cannot read', () => {
    expect(textOn('var(--x)')).toBe('#ffffff')
  })
})
