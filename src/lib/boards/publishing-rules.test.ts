import { describe, it, expect } from 'vitest'
import { publisherTest, targetsForWeek, weekBounds, weekStartDay } from './publishing-rules'

// The rules the publishing goals count by (decided 10 October 2026).

const periods = [
  { boardId: 'A', language: 'English', target: 2, from: '2020-01-06', to: '2026-10-04' },
  { boardId: 'A', language: 'English', target: 4, from: '2026-10-05', to: null },
  { boardId: 'A', language: 'Spanish', target: 3, from: '2020-01-06', to: null },
]

describe('the target in force each week', () => {
  it('judges a past week by the target it had, not by the new one', () => {
    expect(targetsForWeek({ periods, paused: {} }, '2026-09-28')).toEqual({ A: { English: 2, Spanish: 3 } })
    expect(targetsForWeek({ periods, paused: {} }, '2026-10-05')).toEqual({ A: { English: 4, Spanish: 3 } })
  })

  it('leaves a paused language out, as Settings promises', () => {
    expect(targetsForWeek({ periods, paused: { A: ['Spanish'] } }, '2026-10-05')).toEqual({ A: { English: 4 } })
  })
})

describe('who counts as a publisher', () => {
  it('is the full name on the list, any case, any padding', () => {
    const isPub = publisherTest(['Samuel Manzi'])
    expect(isPub('  samuel MANZI ')).toBe(true)
    expect(isPub('Samuel')).toBe(false)
    expect(isPub(null)).toBe(false)
  })
})

describe('a week, in New York', () => {
  it('runs Monday 00:00 to Sunday 23:59 there, daylight saving included', () => {
    const { start, end } = weekBounds('2026-10-05')
    expect(start.toISOString()).toBe('2026-10-05T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-12T03:59:59.999Z')
  })

  it('puts Sunday 8:30pm in New York in that Sunday\'s week', () => {
    expect(weekStartDay(new Date('2026-10-12T00:30:00Z'))).toBe('2026-10-05')
    expect(weekStartDay(new Date('2026-10-12T04:30:00Z'))).toBe('2026-10-12')
  })
})
