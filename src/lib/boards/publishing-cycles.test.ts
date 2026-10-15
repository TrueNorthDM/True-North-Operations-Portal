import { describe, it, expect } from 'vitest'
import {
  cycleLabel, cycleOf, cycleTargets, cyclesTouching, firstCycleEnd, inProgress, isCycled, lastCompleteCycles,
  toCadence, workingDaysGone, WEEKLY,
} from './publishing-cycles'
import { cycleBounds, targetsForWeek } from './publishing-rules'

// Two-week cycles (approved 15 October 2026). Bessemeters' first cycle starts
// Monday 12 October 2026; every date here was checked against a calendar.
const BM = toCadence(2, '2026-10-12')

describe('the cadence a sites row gives', () => {
  it('is two weeks only with a start, and moves a start back to its Monday', () => {
    expect(BM).toEqual({ weeks: 2, start: '2026-10-12' })
    expect(toCadence(2, '2026-10-13')).toEqual({ weeks: 2, start: '2026-10-12' })   // a Tuesday
    expect(toCadence(2, null)).toEqual(WEEKLY)
    expect(toCadence(1, '2026-10-12')).toEqual(WEEKLY)
    expect(toCadence(2, 'not a day')).toEqual(WEEKLY)
    expect(isCycled(BM)).toBe(true)
    expect(isCycled(WEEKLY)).toBe(false)
  })
})

describe('cycles a period touches', () => {
  it('takes every cycle the period touches, whole', () => {
    // October 2026 touches the first cycle and the one that runs into November.
    expect(cyclesTouching(BM, '2026-10-01', '2026-10-31')).toEqual([
      { start: '2026-10-12', end: '2026-10-25' },
      { start: '2026-10-26', end: '2026-11-08' },
    ])
    // A week sits inside one cycle, whichever of its two weeks it is.
    expect(cyclesTouching(BM, '2026-10-19', '2026-10-25')).toEqual([{ start: '2026-10-12', end: '2026-10-25' }])
    // Three days across the edge touch both.
    expect(cyclesTouching(BM, '2026-10-24', '2026-10-26')).toHaveLength(2)
  })

  it('has no cycle before the start', () => {
    expect(cycleOf(BM, '2026-10-11')).toBeNull()
    expect(cyclesTouching(BM, '2026-09-01', '2026-10-11')).toEqual([])
    // "All time" starts at the first cycle, however far back the period reaches.
    expect(cyclesTouching(BM, null, '2026-11-11').map(c => c.start)).toEqual(['2026-10-12', '2026-10-26', '2026-11-09'])
    expect(cyclesTouching(BM, '2020-01-06', '2026-10-12').map(c => c.start)).toEqual(['2026-10-12'])
    // A weekly board has no cycles at all.
    expect(cyclesTouching(WEEKLY, '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('finds the cycle of a day well past the start', () => {
    expect(cycleOf(BM, '2027-01-03')).toEqual({ start: '2026-12-21', end: '2027-01-03' })
    expect(cycleOf(BM, '2027-01-04')).toEqual({ start: '2027-01-04', end: '2027-01-17' })
  })

  it('calls a cycle not yet ended in progress', () => {
    const first = cycleOf(BM, '2026-10-15')!
    expect(inProgress(first, '2026-10-15')).toBe(true)
    expect(inProgress(first, '2026-10-25')).toBe(true)    // its last Sunday
    expect(inProgress(first, '2026-10-26')).toBe(false)
  })

  it('runs Monday 00:00 to the second Sunday 23:59 in New York', () => {
    const { start, end } = cycleBounds({ start: '2026-10-26', end: '2026-11-08' })
    expect(start.toISOString()).toBe('2026-10-26T04:00:00.000Z')
    // Daylight saving ends on 1 November, inside this cycle.
    expect(end.toISOString()).toBe('2026-11-09T04:59:59.999Z')
  })
})

describe('the target of a cycle', () => {
  // 1 page per cycle from the start, raised to 3 in the cycle's SECOND week.
  const periods = [
    { boardId: 'BM', language: 'English', target: 1, from: '2026-10-12', to: '2026-10-18' },
    { boardId: 'BM', language: 'English', target: 3, from: '2026-10-19', to: null },
  ]
  const at = (monday: string) => targetsForWeek({ periods, paused: {} }, monday).BM ?? {}

  it('is the one in force in the cycle\'s first week', () => {
    expect(cycleTargets(cyclesTouching(BM, '2026-10-19', '2026-10-25'), at)).toEqual({ English: 1 })
    expect(cycleTargets(cyclesTouching(BM, '2026-10-26', '2026-10-26'), at)).toEqual({ English: 3 })
  })

  it('adds up across the cycles a period touches', () => {
    expect(cycleTargets(cyclesTouching(BM, '2026-10-01', '2026-10-31'), at)).toEqual({ English: 4 })
    expect(cycleTargets([], at)).toEqual({})
  })
})

describe('the Home card\'s cycles', () => {
  it('gives the last complete cycles, oldest first, and none before the first ends', () => {
    expect(lastCompleteCycles(BM, '2026-11-11', 2)).toEqual([
      { start: '2026-10-12', end: '2026-10-25' },
      { start: '2026-10-26', end: '2026-11-08' },
    ])
    expect(lastCompleteCycles(BM, '2026-10-26', 2)).toEqual([{ start: '2026-10-12', end: '2026-10-25' }])
    expect(lastCompleteCycles(BM, '2026-10-25', 2)).toEqual([])
    expect(lastCompleteCycles(BM, '2026-10-01', 2)).toEqual([])
    expect(firstCycleEnd(BM)).toBe('2026-10-25')
  })

  it('labels a cycle with both ends', () => {
    expect(cycleLabel({ start: '2026-09-28', end: '2026-10-11' })).toBe('Sep 28 to Oct 11')
    expect(cycleLabel({ start: '2026-12-21', end: '2027-01-03' })).toBe('Dec 21 to Jan 3')
  })
})

describe('working days gone in a cycle', () => {
  const first = { start: '2026-10-12', end: '2026-10-25' }
  it('counts the weekdays gone, the weekend closing its week', () => {
    expect(workingDaysGone(first, '2026-10-12')).toBe(0)   // first Monday
    expect(workingDaysGone(first, '2026-10-15')).toBe(3)   // first Thursday
    expect(workingDaysGone(first, '2026-10-17')).toBe(5)   // first Saturday
    expect(workingDaysGone(first, '2026-10-19')).toBe(5)   // second Monday
    expect(workingDaysGone(first, '2026-10-21')).toBe(7)   // second Wednesday
    expect(workingDaysGone(first, '2026-10-25')).toBe(10)  // last Sunday
  })
})
