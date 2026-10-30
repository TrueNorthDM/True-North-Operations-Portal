import { describe, expect, it } from 'vitest'
import { askable } from './time-off-data'

describe('the kinds of time off a person asks for (Tina, 29 October 2026)', () => {
  it('leaves out company holidays and the Rwanda-only kind', () => {
    expect(askable('Holiday')).toBe(false)
    expect(askable('Rwanda-Incidental')).toBe(false)
    expect(askable(' holiday ')).toBe(false)
  })
  it('keeps the kinds people ask for', () => {
    for (const k of ['Vacation', 'Sick', 'Jury duty']) expect(askable(k)).toBe(true)
  })
})
