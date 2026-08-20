import { describe, expect, it } from 'vitest'
import { DRAWER_ROW_CAP, hoursBar, landed, visibleDeliveries, type Delivery } from './drawer'

const row = (i: number): Delivery =>
  ({ id: String(i), item: 'Item', step: 'Write', heldDays: 3, lateDays: null })

describe('landed', () => {
  it('carries the overshoot rather than saying Late on its own', () => {
    expect(landed(2)).toEqual({ label: 'Late 2d', late: true })
    expect(landed(21)).toEqual({ label: 'Late 21d', late: true })
  })

  it('reads on time at zero and when there is nothing to compare against', () => {
    expect(landed(0).label).toBe('On time')
    expect(landed(null).label).toBe('On time')
  })

  // A step finished early is on time, not "Late -3d".
  it('does not call an early finish late', () => {
    expect(landed(-3)).toEqual({ label: 'On time', late: false })
  })
})

describe('visibleDeliveries', () => {
  it('shows everything under the cap and hides nothing', () => {
    const { rows, hidden } = visibleDeliveries([row(1), row(2)])
    expect(rows).toHaveLength(2)
    expect(hidden).toBe(0)
  })

  it('caps a long period and says how many are left', () => {
    const { rows, hidden } = visibleDeliveries(Array.from({ length: 214 }, (_, i) => row(i)))
    expect(rows).toHaveLength(DRAWER_ROW_CAP)
    expect(hidden).toBe(214 - DRAWER_ROW_CAP)
  })
})

describe('hoursBar', () => {
  it('measures every project against the biggest one', () => {
    expect(hoursBar({ project: 'a', hours: 73 }, 146)).toBe(50)
  })

  it('draws nothing when no hours were logged at all', () => {
    expect(hoursBar({ project: 'a', hours: 0 }, 0)).toBe(0)
  })
})
