import { describe, it, expect } from 'vitest'
import { dateLabel, n, readDue, span, workToday } from './shared'

describe('dateLabel', () => {
  it('writes a date the portal way, whatever the clock', () => {
    expect(dateLabel('2026-10-09')).toBe('Oct 9, 2026')
    expect(dateLabel('2021-03-04')).toBe('Mar 4, 2021')
    expect(dateLabel('2021-03-04T22:15:00Z')).toBe('Mar 4, 2021')
  })

  it('keeps a mistyped year visibly short of a digit', () => {
    expect(dateLabel('0202-08-21')).toBe('Aug 21, 0202')
  })
})

describe('span', () => {
  it('counts years, months and days between two days', () => {
    expect(span('2026-09-01', '2026-09-15')).toBe('14d')
    expect(span('2025-07-20', '2026-09-15')).toBe('1y 1m 26d')
    expect(span('2026-09-15', '2026-09-15')).toBe('today')
  })
})

describe('readDue (audit, 10 October 2026: New York days)', () => {
  const today = '2026-10-09'

  it('is late before the day the page was given, due on it, upcoming after', () => {
    expect(readDue('2026-10-08', false, today)).toEqual({ date: 'Oct 8, 2026', time: '1d', state: 'late' })
    expect(readDue('2026-10-09', false, today)).toEqual({ date: 'Oct 9, 2026', time: '', state: 'today' })
    expect(readDue('2026-10-12', false, today)).toEqual({ date: 'Oct 12, 2026', time: 'in 3d', state: 'upcoming' })
  })

  it('never calls a suspect date late', () => {
    expect(readDue('0202-08-21', true, today).state).toBe('odd')
  })

  it("asks the page's day, not the reader's clock: at 11 PM in New York it is still that day", () => {
    const lateEvening = new Date('2026-10-10T03:00:00Z') // Oct 9, 11 PM in New York; Oct 10 in UTC
    expect(workToday(lateEvening)).toBe('2026-10-09')
    expect(readDue('2026-10-09', false, workToday(lateEvening)).state).toBe('today')
  })
})

describe('n', () => {
  it('writes thousands with a comma', () => {
    expect(n(53210)).toBe('53,210')
  })
})

describe('historyWhen', () => {
  it("writes a change in New York's clock", async () => {
    const { historyWhen } = await import('./HistorySteps')
    expect(historyWhen('2026-10-10T02:05:00Z')).toBe('Oct 9, 2026, 10:05 PM')
    expect(historyWhen(null)).toBe('')
  })
})
