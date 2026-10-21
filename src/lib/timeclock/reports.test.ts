import { describe, expect, it } from 'vitest'
import { reportFrame } from '@/app/design-check/clocky-part2/report-sample'
import { parseReportQuery, periodOf, reportCsv, reportSearch } from './reports'

describe('the period (12A)', () => {
  it('is the last one that has ended', () => {
    expect(periodOf('month', '2026-11-03', null)).toEqual({ from: '2026-10-01', to: '2026-10-31', label: 'October 2026' })
    expect(periodOf('quarter', '2026-11-03', null)).toEqual({ from: '2026-07-01', to: '2026-09-30', label: 'Q3 2026 (Jul to Sep)' })
    expect(periodOf('quarter', '2026-02-10', null)).toMatchObject({ from: '2025-10-01', to: '2025-12-31' })
    expect(periodOf('custom', '2026-11-03', null)).toEqual({ from: '2026-08-01', to: '2026-10-31', label: 'Aug 1 to Oct 31, 2026' })
    expect(periodOf('pp', '2026-11-03', '2026-10-04')).toEqual({ from: '2026-10-18', to: '2026-10-31', label: 'Pay period Oct 18 to 31, 2026' })
  })
  it('keeps the filters in the address, and only those set', () => {
    const q = parseReportQuery({ period: 'custom', from: '2026-08-01', to: '2026-10-31', bill: 'yes', team: 'x' })
    expect(reportSearch(q)).toBe('period=custom&from=2026-08-01&to=2026-10-31&team=x&bill=yes')
    expect(reportSearch(parseReportQuery({}))).toBe('')
  })
})

describe('the report, with the prototype\'s October', () => {
  it('gives the cards of 12A', () => {
    const v = reportFrame('12A').view
    expect(v.cards.map(c => `${c.label}: ${c.val} (${c.sub})`)).toEqual([
      'Total hours: 2255h 15m (16 people)',
      'Billable: 61% (1376h 45m)',
      'Over the allowance: 11h 15m (3h 15m not approved in advance)',
      'Invoices, October: $26,438.50 (11 contractors)',
      'PTO days: 2 (Approved, employees)',
    ])
    expect(v.chart.axis).toEqual(['2400h', '1800h', '1200h', '600h'])
    expect(v.chart.months.map(m => m.total)).toEqual(['2120h', '2187h', '2232h', '2255h'])
  })
  it('never shows money to a Team Leader', () => {
    const v = reportFrame('12B').view
    expect(v.personHeads.at(-1)).toBe('Timesheet')
    expect(v.cards[3]).toMatchObject({ label: 'Timesheets, October', val: '1 of 3' })
    expect(JSON.stringify(v)).not.toMatch(/\$/)
    expect(v.byPerson.map(p => p.last)).toEqual(['With Dave Sharpe', 'Waiting for you', 'Approved'])
  })
  it('writes the people as CSV', () => {
    expect(reportCsv(reportFrame('12U').view)).toBe('Person,Team,Hours,Billable,Allowance,Over,Invoice\nJustus Tsofa,Africa,162h 30m,81%,-,-,"$2,310.00"\n')
  })
})
