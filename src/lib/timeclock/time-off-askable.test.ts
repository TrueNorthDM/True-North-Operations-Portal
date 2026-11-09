import { describe, expect, it } from 'vitest'
import { askable } from './time-off-data'

describe('the kinds of time off a person asks for (Tina, 29 October 2026)', () => {
  it('leaves out company holidays and the Rwanda-only kind', () => {
    expect(askable('Holiday')).toBe(false)
    expect(askable('Rwanda-Incidental')).toBe(false)
    expect(askable(' holiday ')).toBe(false)
  })
  it('keeps the three kinds Rippling has (owner, 9 November 2026)', () => {
    for (const k of ['Vacation', 'Sick', 'Unpaid Time Off']) expect(askable(k)).toBe(true)
  })
  it('no longer offers Jury duty nor Other', () => {
    for (const k of ['Jury duty', 'Other', ' other ']) expect(askable(k)).toBe(false)
  })
})
