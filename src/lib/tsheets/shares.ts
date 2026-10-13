/**
 * Percentages of a whole that add up to the whole, as displayed.
 *
 * Rounding every share on its own let a list of three equal parts read
 * 33% + 33% + 33% under a total of 100%, and four parts of 12.5% read 13% each,
 * 52% in all (audit, 13 October 2026). The same lesson as the cents in
 * format.ts: the lines on a client document must add up to its total.
 *
 * Largest remainder: every part gets its share rounded down at the displayed
 * precision, and the units still missing go one each to the parts that lost
 * the most in that rounding. No part moves by more than one displayed unit
 * from its own rounding, and the list always sums to `total`.
 *
 * Pure: no database, no React.
 */

export interface ShareOptions {
  /**
   * What the parts add up to, 100 by default. A sub-list (the projects of one
   * invoice) passes its parent's displayed share, so the rows of a table add up
   * to their subtotal and the subtotals to 100.
   */
  total?: number
  /** Decimal places shown, 0 by default ("33%"); 1 shows "33.3%". */
  decimals?: number
}

/**
 * Each value's share of the values' sum, in the same order, summing exactly to
 * `total` at `decimals` places. Values at or below zero get zero, and so does
 * everything when nothing is above zero (there is no whole to share).
 */
export function shares(values: readonly number[], { total = 100, decimals = 0 }: ShareOptions = {}): number[] {
  const scale = 10 ** decimals
  // Whole display units to hand out: 100 at no decimals, 1000 at one.
  const units = Math.round(total * scale)
  const parts = values.map(v => (Number.isFinite(v) && v > 0 ? v : 0))
  const sum = parts.reduce((s, v) => s + v, 0)
  if (sum <= 0 || units <= 0) return values.map(() => 0)

  // Trimmed to nine places before flooring: 0.29 / 1 * 100 is 28.999999999999996
  // in floating point, and flooring that would take a unit the part is owed.
  const quotas = parts.map(v => Math.round((v / sum) * units * 1e9) / 1e9)
  const floors = quotas.map(Math.floor)
  let missing = units - floors.reduce((s, f) => s + f, 0)

  // Biggest remainder first; on a tie the bigger part, then the earlier one, so
  // the same figures always come out the same way.
  const order = parts
    .map((v, i) => ({ i, rest: quotas[i] - floors[i], v }))
    .filter(o => o.v > 0)
    .sort((a, b) => b.rest - a.rest || b.v - a.v || a.i - b.i)
  for (let k = 0; missing > 0 && order.length > 0; k = (k + 1) % order.length, missing--) {
    floors[order[k].i] += 1
  }

  return floors.map(f => f / scale)
}
