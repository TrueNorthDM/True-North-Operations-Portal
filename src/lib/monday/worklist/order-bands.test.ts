import { describe, expect, it } from 'vitest'
import { bandRange, bandReason, bandsOf, placedAbove } from './order-bands'

describe('bandsOf', () => {
  // Jeannette's own list on 18 September 2026: 126 placed, 69 following, 4, 32, 5.
  it('cuts a new band every time the list changes kind, in the order shown', () => {
    const kinds = [...Array(126).fill(true), ...Array(69).fill(false), ...Array(4).fill(true), ...Array(32).fill(false), ...Array(5).fill(true)] as boolean[]
    const bands = bandsOf(kinds.map((p, i) => ({ i, p })), x => x.p)
    expect(bands.map(b => [b.placed, b.items.length])).toEqual([[true, 126], [false, 69], [true, 4], [false, 32], [true, 5]])
    expect(bands[1].items[0].i).toBe(126)
  })

  it('gives one band to a list of one kind, and none to an empty one', () => {
    expect(bandsOf([1, 2, 3], () => false)).toHaveLength(1)
    expect(bandsOf([], () => true)).toEqual([])
  })
})

describe('placedAbove', () => {
  it('counts the steps placed by hand before each one', () => {
    const m = placedAbove({ keys: ['a', 'b', 'c', 'd'], pinned: new Set(['a', 'c']) })
    expect([...m.values()]).toEqual([0, 1, 1, 2])
  })
})

describe('bandReason', () => {
  it('says steps placed by hand pushed a band down', () => {
    expect(bandReason({ team: 203, tn: 80, placedAbove: 179 }))
      .toBe("179 steps placed by hand come before these, so True North's #80 is the team's #203.")
  })

  // Jeannette's fourth band: the team's #628 is True North's #633.
  it('does not say "come before" of a band that moved up', () => {
    expect(bandReason({ team: 628, tn: 633, placedAbove: 183 }))
      .toBe("Steps placed by hand further down let these move up, so True North's #633 is the team's #628.")
  })

  it('says so when nothing moved it', () => {
    expect(bandReason({ team: 4, tn: 4, placedAbove: 0 })).toBe("True North's #4 is the team's #4, the same place.")
  })
})

describe('bandRange', () => {
  it('writes a range, or a single place', () => {
    expect(bandRange(1, 165)).toBe('#1 to #165')
    expect(bandRange(192, 192)).toBe('#192')
    expect(bandRange(1000, 1161)).toBe('#1,000 to #1,161')
  })
})
