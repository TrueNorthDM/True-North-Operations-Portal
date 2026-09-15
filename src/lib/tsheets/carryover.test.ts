/**
 * The i7 balance, as the one function the report and the Home widget share.
 *
 * Checked once against every month of 2026 on the production data when it was
 * extracted from loadI7ReportData, and equal in every field. These keep it that
 * way: each case is a rule a reader of the balance relies on.
 */

import { describe, it, expect } from 'vitest'
import { computeI7Carryover, accumulateMonths, bucketByMonth } from './carryover'
import { buildI7Report } from './i7report'
import { rateFor, type Assignment } from './rates'
import type { I7Entry } from './types'

const entry = (personId: string, date: string, hours: number, i7Code = 'SEO-1'): I7Entry =>
  ({ personId, date, duration: hours * 3600, i7Code, activity: 'Writing' })

const ASSIGNMENTS: Assignment[] = [
  { personId: 'ana', rate: 50, from: '2026-01-01', to: '2026-02-28' },
  // A raise from March, so a month-by-month walk has to ask each month's rate.
  { personId: 'ana', rate: 60, from: '2026-03-01', to: null },
  { personId: 'ben', rate: 40, from: '2026-01-01', to: null },
]

const BUDGETS = { '2026-01': 1000, '2026-02': 1000, '2026-03': 1500 }
const NOW = new Date('2026-03-20T12:00:00Z')

const ENTRIES = [
  entry('ana', '2026-01-10', 10),  // 10 x 50 = 500
  entry('ben', '2026-01-12', 5),   //  5 x 40 = 200
  entry('ana', '2026-02-03', 4),   //  4 x 50 = 200
  entry('ana', '2026-03-05', 8),   //  8 x 60 = 480
  entry('ben', '2026-03-06', 2),   //  2 x 40 =  80
]

describe('computeI7Carryover', () => {
  it('opens with what the earlier months left, and closes with this month taken off', () => {
    const c = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    // January: 1000 - 700 = 300. February: 1000 - 200 = 800. Carried in: 1100.
    expect(c.opening).toBe(1100)
    expect(c.monthBudget).toBe(1500)
    expect(c.totalAvailable).toBe(2600)
    expect(c.monthUsed).toBe(560)
    expect(c.totalLeft).toBe(2040)
    expect(c.openingFrom).toBe('2026-01')
  })

  it('prices each month at the rate that applied in it', () => {
    // Ana's February hours stay at 50 even though she earns 60 by March.
    const feb = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-02', to: '2026-02', now: NOW })
    expect(feb.monthUsed).toBe(200)
  })

  it('starts from nothing in the first month there is data for', () => {
    const jan = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-01', to: '2026-01', now: NOW })
    expect(jan.opening).toBe(0)
    expect(jan.totalLeft).toBe(300)
  })

  // A month's closing is the next month's opening. That is what "carryover"
  // promises, and the reason the balance is a walk and not a per-month figure.
  it('closes each month where the next one opens', () => {
    const jan = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-01', to: '2026-01', now: NOW })
    const feb = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-02', to: '2026-02', now: NOW })
    expect(feb.opening).toBe(jan.totalLeft)
  })

  it('over a range, adds up the range and still opens from before it', () => {
    const c = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-02', to: '2026-03', now: NOW })
    expect(c.opening).toBe(300)
    expect(c.monthBudget).toBe(2500)
    expect(c.monthUsed).toBe(760)
    expect(c.totalLeft).toBe(2040)
  })

  it('ignores anything after the end of the range', () => {
    const later = [...ENTRIES, entry('ben', '2026-04-02', 100)]
    const a = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    const b = computeI7Carryover({ entries: later, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    expect(b).toEqual(a)
  })

  it('counts hours from someone with no rate as costing nothing, as the report does', () => {
    const unrated = [...ENTRIES, entry('cleo', '2026-03-09', 6)]
    const c = computeI7Carryover({ entries: unrated, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    expect(c.monthUsed).toBe(560)
  })

  // The shortcut this module rests on: "used" is taken from a report built with
  // no names and no job code scaffold, and the page builds its report with both.
  // If either ever started changing a cost, the widget and the report would part.
  it('uses the same total as a report built with names and a scaffold', () => {
    const march = ENTRIES.filter(e => e.date.startsWith('2026-03'))
    const rateAt = (pid: string, ym: string) => rateFor(ASSIGNMENTS, pid, ym)
    const full = buildI7Report(march, rateAt, { ana: 'Ana Souza', ben: 'Ben Lee' }, '2026-03-01',
      { projects: ['SEO', 'Web', 'Empty project'], jobcodesByProject: { SEO: ['SEO-1', 'SEO-2'], 'Empty project': ['X-9'] } })
    const c = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    expect(c.monthUsed).toBe(full.totalCost)
  })

  it('says the opening is incomplete once the retention window passes the start of the data', () => {
    const inside = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: NOW })
    const past = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: BUDGETS, from: '2026-03', to: '2026-03', now: new Date('2028-06-01T12:00:00Z') })
    expect(inside.openingComplete).toBe(true)
    expect(past.openingComplete).toBe(false)
  })

  it('treats a month with no budget row as a budget of zero, not as missing', () => {
    const c = computeI7Carryover({ entries: ENTRIES, assignments: ASSIGNMENTS, monthlyBudgets: {}, from: '2026-03', to: '2026-03', now: NOW })
    expect(c.monthBudget).toBe(0)
    expect(c.opening).toBe(-900)
  })
})

describe('accumulateMonths', () => {
  it('adds budgets and costs across the months asked for, and only those', () => {
    const byMonth = bucketByMonth(ENTRIES)
    expect(accumulateMonths(byMonth, ASSIGNMENTS, BUDGETS, ['2026-01', '2026-02'])).toEqual({ budget: 2000, cost: 900 })
    expect(accumulateMonths(byMonth, ASSIGNMENTS, BUDGETS, [])).toEqual({ budget: 0, cost: 0 })
  })
})
