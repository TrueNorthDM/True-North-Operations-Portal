import { describe, expect, it } from 'vitest'
import { buildEffortTable, hoursFor, isMeasured, MIN_DELIVERED_TO_MEASURE } from './effort'

const board = (boardId: number, hours: number, delivered: number) =>
  ({ boardId, boardName: `B${boardId}`, hours, delivered })

describe('buildEffortTable', () => {
  it('measures a board with enough finished work', () => {
    const t = buildEffortTable([board(1, 1046, 118)], 1046, 118)
    expect(t.perBoard.get(1)).toBe(8.9)
    expect(isMeasured(t, 1)).toBe(true)
  })

  // Three delivered steps is an average and it is noise: one long item moves
  // it by half. Falling back is a smaller error than a confident wrong number.
  it('refuses to measure a board with too little delivered', () => {
    const t = buildEffortTable([board(1, 30, MIN_DELIVERED_TO_MEASURE - 1)], 1000, 200)
    expect(isMeasured(t, 1)).toBe(false)
    expect(hoursFor(t, 1)).toBe(5)
  })

  it('falls back for a board nobody mapped', () => {
    const t = buildEffortTable([], 1000, 200)
    expect(hoursFor(t, 99)).toBe(5)
    expect(isMeasured(t, 99)).toBe(false)
  })

  // An average over nothing is not a small number, it is no number.
  it('has nothing to say before anything has been delivered', () => {
    const t = buildEffortTable([], 1000, 0)
    expect(t.fallback).toBeNull()
    expect(hoursFor(t, 1)).toBeNull()
  })

  it('ignores a mapped board with no hours booked to it', () => {
    const t = buildEffortTable([board(1, 0, 50)], 1000, 200)
    expect(isMeasured(t, 1)).toBe(false)
  })
})
