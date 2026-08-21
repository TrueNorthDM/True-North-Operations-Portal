import { describe, expect, it } from 'vitest'
import {
  LOAD_SCALE, LOAD_TICK_PCT, SPARK_MAX_PX, availableHours, formatNet, loadPercent,
  groupAverageWeek, netFlow, reading, sparkBar, utilisation,
} from './workload'
import { hoursPerStep } from './workload-data'

describe('utilisation', () => {
  it('divides logged hours by the contracted week', () => {
    // 40h a week for 13 weeks, all of it logged.
    expect(utilisation(520, 40)).toBe(100)
  })

  it('has no answer for someone with no contracted hours', () => {
    expect(utilisation(100, 0)).toBeNull()
  })

  // Absent and empty are different facts. A contractor the timeclock has no
  // record of is not somebody who logged nothing all quarter.
  it('tells no record apart from a record of nothing', () => {
    expect(utilisation(null, 40)).toBeNull()
    expect(utilisation(0, 40)).toBe(0)
  })
})

describe('load', () => {
  // The divisor is the hours they actually work, not the hours they agreed to.
  // Using contracted here would call every part-timer overloaded.
  it('measures against observed hours over the horizon', () => {
    expect(availableHours(20, 30)).toEqual({ hours: 86, estimated: false })
    expect(loadPercent(86, 86)).toBe(100)
  })

  it('has no answer when nobody works any hours', () => {
    expect(loadPercent(40, 0)).toBeNull()
  })

  // Screen 6.2: a contractor outside the timeclock still gets a Load, from
  // the group's average week, and the row is marked so the estimate is not
  // read as measured.
  it('borrows the group average for somebody with no hours, and says so', () => {
    expect(availableHours(null, 20)).toEqual({ hours: 86, estimated: true })
  })

  it('averages only the people the timeclock knows about', () => {
    expect(groupAverageWeek([{ observed: 38 }, { observed: 22 }, { observed: null }])).toBe(30)
  })

  it('has no average to borrow when nobody is on the timeclock', () => {
    expect(groupAverageWeek([{ observed: null }])).toBe(0)
  })

  it('puts the 100% tick short of the end, because the scale runs past it', () => {
    expect(LOAD_SCALE).toBe(120)
    expect(LOAD_TICK_PCT).toBeCloseTo(83.3, 1)
  })
})

describe('reading', () => {
  it('calls 120% overloaded before anything else', () => {
    expect(reading(130, 2, 20)).toBe('overloaded')
  })

  // The case the column exists for: work piling up with the hours not being
  // worked is somebody else's approval, not this person's capacity.
  it('separates waiting from at capacity', () => {
    expect(reading(90, 0.8, 55)).toBe('waiting')
    expect(reading(90, 0.8, 85)).toBe('at-capacity')
  })

  it('needs both a light load and a clearing queue to call it spare', () => {
    expect(reading(50, 0, 80)).toBe('spare')
    expect(reading(50, 0.4, 80)).toBe('steady')
  })

  it('falls back to steady when no rule fires', () => {
    expect(reading(70, 0.3, 80)).toBe('steady')
  })

  // Nobody on the timeclock: load and utilisation are both unknown, and the
  // row still has to say something rather than crash or claim Spare.
  it('survives a person with no hours at all', () => {
    expect(reading(null, 0.9, null)).toBe('steady')
    expect(reading(null, 0, null)).toBe('steady')
  })
})

describe('netFlow and formatNet', () => {
  it('keeps one decimal', () => {
    expect(netFlow(4.62, 3.5)).toBe(1.1)
  })

  it('signs a growing queue', () => {
    expect(formatNet(1.1)).toBe('+1.1/wk')
    expect(formatNet(-0.4)).toBe('-0.4/wk')
  })
})

describe('sparkBar', () => {
  it('caps a bad week so it cannot stretch the row', () => {
    expect(sparkBar(9).px).toBe(SPARK_MAX_PX)
  })

  it('keeps a quiet week visible', () => {
    expect(sparkBar(0).px).toBe(2)
  })

  it('tells piling up from clearing', () => {
    expect(sparkBar(1).piling).toBe(true)
    expect(sparkBar(-1).piling).toBe(false)
  })
})

describe('hoursPerStep', () => {
  it('averages the hours actually logged over the steps actually delivered', () => {
    expect(hoursPerStep(1046, 118)).toBe(8.9)
  })

  // An average over no steps is not a small number, it is no number. Load has
  // to say so rather than divide and print a confident zero.
  it('has no answer before anything has been delivered', () => {
    expect(hoursPerStep(1046, 0)).toBeNull()
  })
})
