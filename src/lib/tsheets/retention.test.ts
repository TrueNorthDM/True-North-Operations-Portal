import { describe, it, expect } from 'vitest'
import { retentionFloor, availableMonths, editableMonths, pastMonths, DATA_START } from './retention'

// Month is 0-indexed in `new Date(y, m, d)`, so (2026, 6, …) is July 2026.

describe('retentionFloor', () => {
  it('floors at DATA_START when the rolling window predates our data', () => {
    expect(retentionFloor(new Date(2026, 6, 15))).toBe('2026-01') // Jul 2026
  })
  it('at Dec 2027 the 24-month window lands exactly on Jan 2026', () => {
    expect(retentionFloor(new Date(2027, 11, 1))).toBe('2026-01')
  })
  it('rolls forward once the window passes DATA_START', () => {
    expect(retentionFloor(new Date(2028, 0, 10))).toBe('2026-02') // Jan 2028 → Feb 2026
  })
})

describe('availableMonths', () => {
  it('lists floor…current, newest first', () => {
    expect(availableMonths(new Date(2026, 6, 1))).toEqual([
      '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ])
  })
  it('never goes before DATA_START', () => {
    expect(availableMonths(new Date(2026, 2, 1)).at(-1)).toBe(DATA_START)
  })
})

describe('editableMonths', () => {
  it('is the current month + next 5, oldest first', () => {
    expect(editableMonths(new Date(2026, 6, 1))).toEqual([
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
  })
  it('crosses the year boundary', () => {
    expect(editableMonths(new Date(2026, 10, 1))).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
    ])
  })
})

describe('pastMonths', () => {
  it('is floor…previous month, oldest first, excluding the current month', () => {
    const m = pastMonths(new Date(2026, 6, 1)) // Jul 2026
    expect(m).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'])
    expect(m).not.toContain('2026-07')
  })
  it('is empty at DATA_START (no prior months in range)', () => {
    expect(pastMonths(new Date(2026, 0, 15))).toEqual([])
  })
})
