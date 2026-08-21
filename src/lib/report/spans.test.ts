import { describe, expect, it } from 'vitest'
import {
  daysBetween, deriveSpans, lateness, median, onTimeShare, percentile90, type LoggedEvent,
} from './spans'

const ev = (o: Partial<LoggedEvent> & Pick<LoggedEvent, 'event' | 'occurred_at'>): LoggedEvent => ({
  board_id: 7, item_id: 1, people_col: 'writer', monday_user_id: 42, due_date: null, ...o,
})

describe('deriveSpans', () => {
  it('pairs a hand-off with the finish that closes it', () => {
    const spans = deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T09:00:00Z' }),
      ev({ event: 'done', occurred_at: '2026-08-05T09:00:00Z' }),
    ])
    expect(spans).toHaveLength(1)
    expect(spans[0].heldDays).toBe(4)
  })

  it('ignores a step that landed and has not been finished', () => {
    expect(deriveSpans([ev({ event: 'assigned', occurred_at: '2026-08-01T09:00:00Z' })])).toEqual([])
  })

  // Without an assigned event there is no moment to measure from, which is
  // the state all open work is in until it next moves.
  it('ignores a finish with no hand-off before it', () => {
    expect(deriveSpans([ev({ event: 'done', occurred_at: '2026-08-05T09:00:00Z' })])).toEqual([])
  })

  // The decided rule: rework does not inflate delivery.
  it('counts a reopened step once, on the last finish', () => {
    const spans = deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z' }),
      ev({ event: 'done', occurred_at: '2026-08-03T00:00:00Z' }),
      ev({ event: 'reopened', occurred_at: '2026-08-04T00:00:00Z' }),
      ev({ event: 'done', occurred_at: '2026-08-09T00:00:00Z' }),
    ])
    expect(spans).toHaveLength(1)
    expect(spans[0].doneAt).toBe('2026-08-09T00:00:00Z')
    // Measured from the reopen, not from the original hand-off.
    expect(spans[0].heldDays).toBe(5)
  })

  it('drops the delivery entirely while a reopen is still open', () => {
    expect(deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z' }),
      ev({ event: 'done', occurred_at: '2026-08-03T00:00:00Z' }),
      ev({ event: 'reopened', occurred_at: '2026-08-04T00:00:00Z' }),
    ])).toEqual([])
  })

  it('ends an attempt that was taken off them without a delivery', () => {
    expect(deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z' }),
      ev({ event: 'unassigned', occurred_at: '2026-08-02T00:00:00Z' }),
      ev({ event: 'done', occurred_at: '2026-08-03T00:00:00Z' }),
    ])).toEqual([])
  })

  it('reads events that arrive out of order', () => {
    const spans = deriveSpans([
      ev({ event: 'done', occurred_at: '2026-08-05T00:00:00Z' }),
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z' }),
    ])
    expect(spans).toHaveLength(1)
  })

  it('keeps two people on one step apart', () => {
    const spans = deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z', monday_user_id: 1 }),
      ev({ event: 'done', occurred_at: '2026-08-02T00:00:00Z', monday_user_id: 1 }),
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z', monday_user_id: 2 }),
      ev({ event: 'done', occurred_at: '2026-08-08T00:00:00Z', monday_user_id: 2 }),
    ])
    expect(spans.map(s => s.heldDays).sort()).toEqual([1, 7])
  })

  // A deadline moved mid-flight is the one the finish is judged against.
  it('judges the finish against the deadline in force at the time', () => {
    const spans = deriveSpans([
      ev({ event: 'assigned', occurred_at: '2026-08-01T00:00:00Z', due_date: '2026-08-05' }),
      ev({ event: 'due_date', occurred_at: '2026-08-04T00:00:00Z', due_date: '2026-08-20' }),
      ev({ event: 'done', occurred_at: '2026-08-10T00:00:00Z' }),
    ])
    expect(spans[0].dueDate).toBe('2026-08-20')
    expect(spans[0].lateDays).toBe(0)
  })
})

describe('lateness', () => {
  it('is zero for a finish on the due date itself', () => {
    expect(lateness('2026-08-05T18:00:00Z', '2026-08-05')).toBe(0)
  })

  it('counts whole days past the deadline', () => {
    expect(lateness('2026-08-07T09:00:00Z', '2026-08-05')).toBe(2)
  })

  // Not on time and not late: counting it either way is a claim about work
  // nobody ever set a date for.
  it('has no answer without a deadline', () => {
    expect(lateness('2026-08-07T09:00:00Z', null)).toBeNull()
  })

  it('does not credit an early finish as negative', () => {
    expect(lateness('2026-08-01T09:00:00Z', '2026-08-05')).toBe(0)
  })
})

describe('daysBetween', () => {
  it('counts calendar days, weekends included', () => {
    // Friday to Monday is three days, because that is how long it sat.
    expect(daysBetween('2026-08-07T09:00:00Z', '2026-08-10T09:00:00Z')).toBe(3)
  })

  it('is zero for same-day work rather than negative for a clock skew', () => {
    expect(daysBetween('2026-08-10T18:00:00Z', '2026-08-10T09:00:00Z')).toBe(0)
  })
})

describe('median and percentile90', () => {
  it('takes the middle of an odd set', () => {
    expect(median([1, 9, 3])).toBe(3)
  })

  it('averages the middle two of an even set', () => {
    expect(median([1, 2, 3, 10])).toBe(2.5)
  })

  // Null, not zero: zero says everything was instant.
  it('has no median for nothing at all', () => {
    expect(median([])).toBeNull()
    expect(percentile90([])).toBeNull()
  })

  it('takes the slowest one in ten', () => {
    expect(percentile90(Array.from({ length: 10 }, (_, i) => i + 1))).toBe(9)
  })
})

describe('onTimeShare', () => {
  const span = (lateDays: number | null) =>
    ({ board_id: 7, item_id: 1, people_col: 'w', monday_user_id: 1, assignedAt: '', doneAt: '', heldDays: 1, dueDate: null, lateDays })

  it('counts only the spans that had a deadline', () => {
    expect(onTimeShare([span(0), span(3), span(null)])).toEqual({ pct: 50, onTime: 1, judged: 2 })
  })

  it('has no share when nothing carried a deadline', () => {
    expect(onTimeShare([span(null), span(null)])).toEqual({ pct: null, onTime: 0, judged: 0 })
  })
})
