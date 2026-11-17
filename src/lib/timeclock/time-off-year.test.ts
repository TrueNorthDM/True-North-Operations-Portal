import { describe, expect, it } from 'vitest'
import { daysLabel, hoursLabel, offKindOf, offRuns, yearCount, type OffEntry } from './time-off-year'

const H = 3600
const e = (date: string, hours: number, kind: OffEntry['kind']): OffEntry => ({ date, seconds: hours * H, kind })

describe('offKindOf', () => {
  it('reads the type from the job, and leaves company holidays out', () => {
    expect(offKindOf({ name: 'Vacation', kind: 'pto' })).toBe('vacation')
    expect(offKindOf({ name: 'Sick', kind: 'pto' })).toBe('sick')
    expect(offKindOf({ name: 'Unpaid Time Off', kind: 'unpaid' })).toBe('unpaid')
    expect(offKindOf({ name: 'Jury duty', kind: 'unpaid' })).toBe('unpaid')
    expect(offKindOf({ name: 'Rwanda-Incidental', kind: 'pto' })).toBe('other')
    expect(offKindOf({ name: 'Holiday', kind: 'pto' })).toBeNull()
  })
})

describe('labels', () => {
  it('writes days of 8 hours and hours', () => {
    expect(daysLabel(48 * H)).toBe('6 days')
    expect(daysLabel(8 * H)).toBe('1 day')
    expect(daysLabel(12 * H)).toBe('1.5 days')
    expect(daysLabel(0)).toBe('0')
    expect(hoursLabel(11.25 * H)).toBe('11.25h')
  })
})

describe('yearCount', () => {
  const entries = [e('2026-02-18', 8, 'sick'), e('2026-07-17', 8, 'vacation'), e('2026-08-03', 16, 'vacation'), e('2026-08-20', 4, 'sick'), e('2025-12-30', 8, 'vacation')]
  it('adds the year by type, without Other when there is none', () => {
    const c = yearCount(entries, 2026)
    expect(c.lines.map(l => [l.key, l.seconds / H])).toEqual([['vacation', 24], ['sick', 12], ['unpaid', 0]])
    expect(c.total.seconds / H).toBe(36)
    expect(c.partial).toBe(true)
    expect(yearCount(entries, 2025).partial).toBe(false)
  })
  it('shows what the year becomes with the request being decided', () => {
    const c = yearCount(entries, 2026, { kind: 'sick', seconds: 16 * H, date: '2026-11-24' })
    const sick = c.lines.find(l => l.key === 'sick')!
    expect([sick.seconds / H, sick.withSeconds / H, sick.adds]).toEqual([12, 28, true])
    expect(c.lines.find(l => l.key === 'vacation')!.adds).toBe(false)
    expect(c.total.withSeconds / H).toBe(52)
    expect(c.month).toBe(10)
  })
  it('colours each month by the type taken most in it', () => {
    const c = yearCount(entries, 2026)
    expect(c.months[1]).toBe('sick')
    expect(c.months[7]).toBe('vacation')
    expect(c.months[0]).toBeNull()
  })
  it('lists Other when the year has some', () => {
    expect(yearCount([e('2026-03-02', 8, 'other')], 2026).lines.map(l => l.key)).toContain('other')
  })
})

describe('offRuns', () => {
  it('joins days in a row across a weekend, by type and place, newest first', () => {
    const r = offRuns([
      { date: '2026-10-26', seconds: 8 * H, kind: 'vacation', source: 'tsheets' },
      { date: '2026-10-23', seconds: 8 * H, kind: 'vacation', source: 'tsheets' },
      { date: '2026-10-27', seconds: 8 * H, kind: 'vacation', source: 'tsheets' },
      { date: '2026-11-24', seconds: 8 * H, kind: 'sick', source: 'portal' },
      { date: '2026-10-28', seconds: 8 * H, kind: 'sick', source: 'tsheets' },
    ])
    expect(r.map(x => [x.from, x.to, x.kind, x.seconds / H])).toEqual([
      ['2026-11-24', '2026-11-24', 'sick', 8],
      ['2026-10-28', '2026-10-28', 'sick', 8],
      ['2026-10-23', '2026-10-27', 'vacation', 24],
    ])
  })
})
