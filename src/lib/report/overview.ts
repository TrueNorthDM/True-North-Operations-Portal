// The Overview tab's shape, and the two bits of arithmetic that draw it.
//
// The maths lives here rather than inside the component because both are easy
// to get subtly wrong in ways that still render: a chart that rescales looks
// fine on its own and lies the moment you compare two of them.

export type Kpi = {
  label: string
  value: string
  unit: string
  note: string
}

export type Week = {
  /** Start of the week, already formatted. */
  label: string
  total: number
  late: number
}

export type AgeBucket = {
  label: string
  count: number
  color: string
}

export type HeldPerson = {
  name: string
  /** Working days from hand-off to done: the middle one, and the slowest in ten. */
  median: number
  p90: number
}

export type Overview = {
  kpis: Kpi[]
  weeks: Week[]
  aging: AgeBucket[]
  held: HeldPerson[]
}

/**
 * The four ages, in order, with the colour each is drawn in. Measured in
 * working days like held time (lib/report/clock.ts): a working week is 5.
 */
export const AGE_BUCKETS: { label: string; color: string; maxDays: number | null }[] = [
  { label: 'Under a week', color: '#1E7D7F', maxDays: 5 },
  { label: '1 to 4 weeks', color: '#579BFC', maxDays: 20 },
  { label: '1 to 3 months', color: '#E09422', maxDays: 65 },
  { label: 'Over 3 months', color: '#c2410c', maxDays: null },
]

/** Tallest column of the weekly chart, in pixels, under the count label. */
export const WEEK_CHART_PX = 118

/** The held chart is pinned to this many days. See heldWidths. */
export const HELD_SCALE_DAYS = 30

/**
 * Bar heights for one week, in pixels.
 *
 * Scaled against the busiest week rather than a fixed number, so a quiet
 * period still fills the chart. The late segment sits on top of the on-time
 * one, and an on-time count of nothing still draws 2px: a column that
 * vanishes reads as "no data" when it means "all of it was late".
 */
export function weekBars(week: Week, busiest: number): { late: number; onTime: number } {
  if (busiest <= 0) return { late: 0, onTime: 0 }
  const px = WEEK_CHART_PX / busiest
  const late = Math.round(week.late * px)
  return {
    late,
    onTime: week.total > week.late ? Math.max(2, Math.round((week.total - week.late) * px)) : 0,
  }
}

/**
 * Where the median bar ends and the whisker runs to, as percentages.
 *
 * Fixed to a 0 to 30 day scale, stated on the card. Anything past 30 days is
 * clamped rather than rescaled: the point of this chart is comparing one
 * scope against another, and a chart that resizes itself to its own worst row
 * makes a slow team and a fast one look identical.
 */
export function heldWidths(p: HeldPerson): { bar: number; whiskerLeft: number; whiskerWidth: number } {
  const pct = (d: number) => Math.max(0, Math.min(100, (d / HELD_SCALE_DAYS) * 100))
  const bar = pct(p.median)
  const end = pct(p.p90)
  return { bar, whiskerLeft: bar, whiskerWidth: Math.max(0, end - bar) }
}

/** 4.2d under ten days, 26d over: a tenth of a day stops meaning anything. */
export function formatDays(d: number): string {
  return (d < 10 ? d.toFixed(1) : String(Math.round(d))) + 'd'
}
