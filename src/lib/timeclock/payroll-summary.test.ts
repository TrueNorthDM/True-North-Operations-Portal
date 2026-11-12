import { describe, expect, it } from 'vitest'
import { buildPayroll, expectedHours, gapText, parsePayrollQuery, payrollCsv, payrollPeriod, payrollSearch, splitName, type PayrollEntry } from './payroll-summary'

const H = 3600
const e = (personId: string, hours: number, sort: PayrollEntry['sort'] = 'work', approved = true): PayrollEntry =>
  ({ personId, date: '2026-10-27', seconds: hours * H, sort, approved })

describe('splitName', () => {
  it('takes the kept last name and what comes before it', () => {
    expect(splitName('Joy Deche', 'Deche')).toEqual({ fname: 'Joy', lname: 'Deche' })
    expect(splitName('Mary Ann  van Dyke', 'van Dyke')).toEqual({ fname: 'Mary Ann', lname: 'van Dyke' })
  })
  it('falls back to the last word when no last name is kept', () => {
    expect(splitName('Rock Kai', null)).toEqual({ fname: 'Rock', lname: 'Kai' })
    expect(splitName('Cher', null)).toEqual({ fname: 'Cher', lname: '' })
  })
})

describe('payrollPeriod', () => {
  const today = '2026-11-12', anchor = '2026-09-27'
  it('opens on the current pay period and steps 14 days', () => {
    const p = payrollPeriod({ kind: 'pp' }, today, anchor)
    expect(p).toEqual({ from: '2026-11-08', to: '2026-11-21', label: 'Nov 8 to 21, 2026', prev: '2026-10-25', next: '2026-11-22' })
    expect(payrollPeriod({ kind: 'pp', at: p.prev! }, today, anchor)).toMatchObject({ from: '2026-10-25', to: '2026-11-07', label: 'Oct 25 to Nov 7, 2026' })
  })
  it('opens on the current month and quarter, across the year', () => {
    expect(payrollPeriod({ kind: 'month' }, today, anchor)).toEqual({ from: '2026-11-01', to: '2026-11-30', label: 'November 2026', prev: '2026-10-01', next: '2026-12-01' })
    expect(payrollPeriod({ kind: 'month', at: '2027-01-01' }, today, anchor)).toMatchObject({ label: 'January 2027', prev: '2026-12-01' })
    expect(payrollPeriod({ kind: 'quarter' }, today, anchor)).toMatchObject({ from: '2026-10-01', to: '2026-12-31', label: 'Q4 2026 (Oct to Dec)', next: '2027-01-01' })
  })
  it('keeps the custom days, with no arrows', () => {
    expect(payrollPeriod({ kind: 'custom', from: '2026-10-01', to: '2026-10-15' }, today, anchor)).toMatchObject({ from: '2026-10-01', to: '2026-10-15', prev: null, next: null })
  })
  it('reads and writes the address', () => {
    expect(parsePayrollQuery({})).toEqual({ kind: 'pp', at: undefined, from: undefined, to: undefined })
    expect(payrollSearch({ kind: 'month', at: '2026-10-01' })).toBe('period=month&at=2026-10-01')
    expect(payrollSearch({ kind: 'custom', from: '2026-10-01', to: '2026-10-15', at: 'x' })).toBe('period=custom&from=2026-10-01&to=2026-10-15')
  })
})

describe('expectedHours', () => {
  it('is 8 for each weekday: 80 for a pay period, 176 for October 2026', () => {
    expect(expectedHours('2026-10-25', '2026-11-07')).toBe(80)
    expect(expectedHours('2026-10-01', '2026-10-31')).toBe(176)
    expect(expectedHours('2026-11-07', '2026-11-08')).toBe(0)
  })
})

describe('buildPayroll', () => {
  const people = [
    { id: 't', fullName: 'Tina Gennette', lastName: 'Gennette' },
    { id: 'c', fullName: 'Clarise Nixon', lastName: 'Nixon' },
    { id: 'd', fullName: 'David Sharpe', lastName: 'Sharpe' },
    { id: 'n', fullName: 'Nobody Here', lastName: 'Here' },
  ]
  const lines = buildPayroll(people, [
    e('c', 64), e('c', 8, 'pto'), e('c', 8, 'pto'),
    e('d', 80.75),
    e('t', 70, 'work'), e('t', 2, 'work', false), e('t', 8, 'pto'), e('t', 4, 'unpaid'),
  ], 80)

  it('sorts by first name and keeps people with no hours', () => {
    expect(lines.map(l => l.fname)).toEqual(['Clarise', 'David', 'Nobody', 'Tina'])
  })
  it('splits work and paid time off, leaves unpaid out, never tops up or caps', () => {
    const by = Object.fromEntries(lines.map(l => [l.personId, l]))
    expect(by.c).toMatchObject({ reg: 64, pto: 16, gap: 0 })
    expect(by.d).toMatchObject({ reg: 80.75, pto: 0, gap: 0.75 })
    expect(by.t).toMatchObject({ reg: 72, pto: 8, pending: 2, gap: 0 })
    expect(by.n).toMatchObject({ reg: 0, pto: 0, gap: -80 })
  })
  it('writes the check line', () => {
    expect(gapText(-8, 80)).toBe('8 h short of 80')
    expect(gapText(0.75, 80)).toBe('0.75 h over 80')
    expect(gapText(0, 80)).toBeNull()
  })
  it('writes the file in Tina\'s shape, the PTO row under its person', () => {
    expect(payrollCsv(lines)).toBe([
      'type,hours,fname,lname',
      'REG,64,Clarise,Nixon',
      'PTO,16,,',
      'REG,80.75,David,Sharpe',
      'REG,0,Nobody,Here',
      'REG,72,Tina,Gennette',
      'PTO,8,,',
      '',
    ].join('\n'))
  })
})
