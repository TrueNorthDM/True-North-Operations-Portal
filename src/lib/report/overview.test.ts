import { describe, expect, it } from 'vitest'
import { HELD_SCALE_DAYS, WEEK_CHART_PX, formatDays, heldWidths, weekBars } from './overview'

describe('weekBars', () => {
  it('fills the chart with the busiest week', () => {
    const bars = weekBars({ label: 'Jun 1', total: 15, late: 0 }, 15)
    expect(bars.onTime).toBe(WEEK_CHART_PX)
    expect(bars.late).toBe(0)
  })

  it('scales a quieter week against the busiest one', () => {
    const bars = weekBars({ label: 'Jun 8', total: 5, late: 0 }, 15)
    expect(bars.onTime).toBeCloseTo(WEEK_CHART_PX / 3, 0)
  })

  it('stacks late on top of on time', () => {
    const bars = weekBars({ label: 'Jun 1', total: 10, late: 4 }, 10)
    expect(bars.late + bars.onTime).toBeCloseTo(WEEK_CHART_PX, 0)
  })

  // A column that vanishes reads as "no data", which is the opposite of what
  // an all-late week means.
  it('keeps a sliver of on time visible when almost everything was late', () => {
    const bars = weekBars({ label: 'Jun 1', total: 100, late: 99 }, 100)
    expect(bars.onTime).toBeGreaterThanOrEqual(2)
  })

  it('draws nothing on time when the whole week was late', () => {
    expect(weekBars({ label: 'Jun 1', total: 8, late: 8 }, 8).onTime).toBe(0)
  })

  it('draws nothing at all when no week delivered anything', () => {
    expect(weekBars({ label: 'Jun 1', total: 0, late: 0 }, 0)).toEqual({ late: 0, onTime: 0 })
  })
})

describe('heldWidths', () => {
  it('puts the median halfway across at half the scale', () => {
    expect(heldWidths({ name: 'A', median: HELD_SCALE_DAYS / 2, p90: HELD_SCALE_DAYS / 2 }).bar).toBe(50)
  })

  it('runs the whisker from the median to the p90', () => {
    const w = heldWidths({ name: 'A', median: 3, p90: 9 })
    expect(w.whiskerLeft).toBeCloseTo(10)
    expect(w.whiskerWidth).toBeCloseTo(20)
  })

  // The point of the chart is comparing one scope with another. Rescaling to
  // the worst row would make a slow team and a fast one look identical.
  it('clamps past the scale rather than rescaling', () => {
    const w = heldWidths({ name: 'A', median: 45, p90: 120 })
    expect(w.bar).toBe(100)
    expect(w.whiskerWidth).toBe(0)
  })

  it('never draws a negative whisker when p90 lands under the median', () => {
    expect(heldWidths({ name: 'A', median: 10, p90: 4 }).whiskerWidth).toBe(0)
  })
})

describe('formatDays', () => {
  it('keeps a tenth of a day while it still means something', () => {
    expect(formatDays(4.24)).toBe('4.2d')
  })

  it('drops it once it does not', () => {
    expect(formatDays(26.4)).toBe('26d')
  })

  it('rounds at the boundary rather than printing 10.0d', () => {
    expect(formatDays(10)).toBe('10d')
  })
})
