// The SEO team's whole order on 18 September 2026 as stretches: placed by hand
// or following True North, and how many steps each. Design check only.

import type { OrderRow } from '../order-clarity/data'

export const TEAM_RUNS: [boolean, number][] = [[true, 169], [false, 2], [true, 4], [false, 2], [true, 2], [false, 5], [true, 4], [false, 423], [true, 4], [false, 103], [true, 7], [false, 52]]

/** One stand-in row per step, enough for the map: its place and whether it was placed by hand. */
export const TEAM_ROWS: OrderRow[] = TEAM_RUNS.flatMap(([placed, n], i) => {
  const from = 1 + TEAM_RUNS.slice(0, i).reduce((t, [, m]) => t + m, 0)
  return Array.from({ length: n }, (_, k) => ({ team: from + k, tn: 0, placed, placedAbove: 0, item: '', board: '', step: '', who: '' }))
})
