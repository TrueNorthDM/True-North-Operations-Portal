import { describe, it, expect } from 'vitest'

import { rateFor, standardI7Rate, type Assignment } from './rates'

/**
 * These two functions decide every currency figure on the Clients Report: the
 * cost of each project, the month total, and through the carryover every
 * balance the client is shown. buildI7Report had tests for the hours tree;
 * nothing tested which rate those hours are multiplied by.
 *
 * Several cases below pin behaviour that is a simplification rather than an
 * obvious right answer (a mid-month rate change, a person with no rate). They
 * are here so that changing any of it is a decision someone makes on purpose,
 * with a failing test to read, instead of a surprise on a client's invoice.
 */

// Person ids are uuids in life; short strings keep the cases readable, and
// the helper takes a number so every case below reads exactly as before.
const a = (person: number, rate: number, from: string, to: string | null = null): Assignment =>
  ({ personId: `p${person}`, rate, from, to })

describe('rateFor', () => {
  it('returns the rate of an open-ended assignment', () => {
    expect(rateFor([a(1, 95, '2026-01-01')], 'p1', '2026-08')).toBe(95)
  })

  it('returns 0 for a person with no assignment at all', () => {
    // Audit finding M3-1. The report multiplies this into a cost of zero, so
    // the hours show and the money does not, and nothing warns. Pinned so the
    // day someone changes it, they see this case and the note above it.
    expect(rateFor([a(1, 95, '2026-01-01')], 'p999', '2026-08')).toBe(0)
  })

  it('ignores other people entirely', () => {
    const rows = [a(1, 95, '2026-01-01'), a(2, 150, '2026-01-01')]
    expect(rateFor(rows, 'p1', '2026-08')).toBe(95)
    expect(rateFor(rows, 'p2', '2026-08')).toBe(150)
  })

  it('returns 0 when the list is empty', () => {
    expect(rateFor([], 'p1', '2026-08')).toBe(0)
  })

  describe('rate history', () => {
    // One person, raised from 95 to 120 on 1 June.
    const rows = [
      a(1, 95, '2026-01-01', '2026-05-31'),
      a(1, 120, '2026-06-01'),
    ]

    it('uses the old rate for a month before the change', () => {
      expect(rateFor(rows, 'p1', '2026-04')).toBe(95)
    })

    it('uses the old rate for the last month it covers', () => {
      expect(rateFor(rows, 'p1', '2026-05')).toBe(95)
    })

    it('uses the new rate from the month it starts', () => {
      expect(rateFor(rows, 'p1', '2026-06')).toBe(120)
    })

    it('keeps the new rate for later months', () => {
      expect(rateFor(rows, 'p1', '2026-11')).toBe(120)
    })

    it('returns 0 for a month before any assignment existed', () => {
      expect(rateFor(rows, 'p1', '2025-12')).toBe(0)
    })
  })

  describe('month boundaries', () => {
    it('excludes an assignment that starts after the month ends', () => {
      expect(rateFor([a(1, 95, '2026-09-01')], 'p1', '2026-08')).toBe(0)
    })

    it('excludes an assignment that ended before the month began', () => {
      expect(rateFor([a(1, 95, '2026-01-01', '2026-07-31')], 'p1', '2026-08')).toBe(0)
    })

    it('includes an assignment that ends on the first day of the month', () => {
      expect(rateFor([a(1, 95, '2026-01-01', '2026-08-01')], 'p1', '2026-08')).toBe(95)
    })

    it('includes an assignment that starts on the last day of the month', () => {
      expect(rateFor([a(1, 95, '2026-08-31')], 'p1', '2026-08')).toBe(95)
    })

    it('handles February, where the 31st does not exist', () => {
      // The bound is the string `2026-02-31`. It is not a real date and does
      // not need to be: every February day sorts before it, and 1 March after.
      expect(rateFor([a(1, 95, '2026-02-28')], 'p1', '2026-02')).toBe(95)
      expect(rateFor([a(1, 95, '2026-03-01')], 'p1', '2026-02')).toBe(0)
    })

    it('handles the December to January turn', () => {
      const rows = [a(1, 95, '2026-01-01', '2026-12-31'), a(1, 110, '2027-01-01')]
      expect(rateFor(rows, 'p1', '2026-12')).toBe(95)
      expect(rateFor(rows, 'p1', '2027-01')).toBe(110)
    })
  })

  describe('a rate that changes mid-month', () => {
    it('applies the new rate to the whole month', () => {
      // A simplification, not an accident: one month resolves to one rate, and
      // the later start wins. Hours worked before the 15th are priced at the
      // rate that began on the 15th. Rates are meant to be dated to the first
      // of a month, and nothing enforces that (audit finding M3-2).
      const rows = [a(1, 95, '2026-01-01', '2026-08-14'), a(1, 120, '2026-08-15')]
      expect(rateFor(rows, 'p1', '2026-08')).toBe(120)
    })
  })

  it('takes the later start when two assignments overlap the month', () => {
    const rows = [a(1, 95, '2026-01-01'), a(1, 120, '2026-06-01')]
    expect(rateFor(rows, 'p1', '2026-08')).toBe(120)
  })
})

describe('standardI7Rate', () => {
  it('returns the rate most people are on', () => {
    const rows = [a(1, 95, '2026-01-01'), a(2, 95, '2026-01-01'), a(3, 150, '2026-01-01')]
    expect(standardI7Rate(rows, '2026-08')).toBe(95)
  })

  it('breaks a tie towards the higher rate', () => {
    // The figure estimates how many hours a budget buys, so the higher rate
    // gives the more conservative estimate.
    const rows = [a(1, 95, '2026-01-01'), a(2, 150, '2026-01-01')]
    expect(standardI7Rate(rows, '2026-08')).toBe(150)
  })

  it('ignores people with no rate for that month', () => {
    const rows = [a(1, 95, '2026-01-01'), a(2, 95, '2026-01-01'), a(3, 120, '2027-01-01')]
    expect(standardI7Rate(rows, '2026-08')).toBe(95)
  })

  it('does not let people with no rate outvote the ones who have one', () => {
    // The case above passes either way, because 95 still wins on count: found
    // by mutation-testing the filter away and watching nothing fail. Here two
    // people have no rate for the month and one does, so counting zeros would
    // make 0 the majority and report the standard rate as $0.
    const rows = [
      a(1, 95, '2026-01-01'),
      a(2, 120, '2027-01-01'),
      a(3, 120, '2027-01-01'),
    ]
    expect(standardI7Rate(rows, '2026-08')).toBe(95)
  })

  it('returns 0 when nobody has a rate that month', () => {
    expect(standardI7Rate([a(1, 95, '2027-01-01')], '2026-08')).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(standardI7Rate([], '2026-08')).toBe(0)
  })

  it('follows rate history, so the standard moves with the month', () => {
    const rows = [
      a(1, 95, '2026-01-01', '2026-05-31'), a(1, 120, '2026-06-01'),
      a(2, 95, '2026-01-01', '2026-05-31'), a(2, 120, '2026-06-01'),
    ]
    expect(standardI7Rate(rows, '2026-04')).toBe(95)
    expect(standardI7Rate(rows, '2026-07')).toBe(120)
  })

  it('counts each person once, not each assignment row', () => {
    // One person with a long history must not outvote two people on another
    // rate just by having more rows.
    const rows = [
      a(1, 150, '2026-01-01', '2026-02-28'),
      a(1, 150, '2026-03-01', '2026-04-30'),
      a(1, 150, '2026-05-01'),
      a(2, 95, '2026-01-01'),
      a(3, 95, '2026-01-01'),
    ]
    expect(standardI7Rate(rows, '2026-08')).toBe(95)
  })
})
