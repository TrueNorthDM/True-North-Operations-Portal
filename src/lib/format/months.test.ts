import { describe, expect, it } from 'vitest'
import { MONTH_LONG, MONTH_SHORT } from './months'

describe('month names', () => {
  it('has twelve of each, January first', () => {
    expect(MONTH_SHORT).toHaveLength(12)
    expect(MONTH_LONG).toHaveLength(12)
    expect(MONTH_SHORT[0]).toBe('Jan')
    expect(MONTH_LONG[11]).toBe('December')
  })

  // Spelled out on purpose: these are the strings the hand-written lists held
  // (audit, 15 October 2026), and every label built from them must not move.
  it('spells every month as the portal always has', () => {
    expect(MONTH_SHORT.join(' ')).toBe('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec')
    expect(MONTH_LONG.join(' ')).toBe('January February March April May June July August September October November December')
  })

  // "Sep", not the "Sept" some locales write, so a label never depends on the
  // runtime: the English the dates elsewhere in the portal use ("Oct 9, 2026").
  it('agrees with en-US Intl in New York for every month', () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2026, m, 15, 12))
      expect(MONTH_SHORT[m]).toBe(d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short' }))
      expect(MONTH_LONG[m]).toBe(d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'long' }))
    }
  })

  it('is the short form of the long name', () => {
    MONTH_LONG.forEach((name, i) => expect(MONTH_SHORT[i]).toBe(name.slice(0, 3)))
  })
})
