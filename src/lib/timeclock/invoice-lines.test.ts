import { describe, it, expect } from 'vitest'
import { buildInvoiceLines, dueOn } from './invoice-lines'

const H = (h: number) => Math.round(h * 3600)

describe('buildInvoiceLines', () => {
  it('hourly: one line per client, hours x rate (Justus Tsofa, $14.00/h, 162h 30m)', () => {
    const { lines, total } = buildInvoiceLines({
      paysAs: 'hourly', periodName: 'October 2026', hourlyRate: 14, fixedAmount: null,
      byClient: [{ client: '2 - i7 Marketing', seconds: H(120) }, { client: '1 - True North', seconds: H(30.5) }, { client: 'A.org Job', seconds: H(12) }],
      reimbursements: [{ id: 7, category: 'Internet', purpose: 'Internet, October', amount: 35 }],
    })
    expect(lines.map(l => [l.description, l.amount])).toEqual([
      ['2 - i7 Marketing, October 2026', 1680], ['1 - True North, October 2026', 427], ['A.org Job, October 2026', 168], ['Internet, October', 35],
    ])
    expect(total).toBe(2310)
  })

  it('fixed monthly: one fixed line with the hours for the record (Olivia Hale, $1,800.00)', () => {
    const { lines, total } = buildInvoiceLines({ paysAs: 'fixed_monthly', periodName: 'October 2026', hourlyRate: 22, fixedAmount: 1800, byClient: [{ client: 'GNA', seconds: H(118.75) }] })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ kind: 'fixed', description: 'Fixed monthly amount, October 2026', hoursSeconds: H(118.75), rate: null, amount: 1800 })
    expect(total).toBe(1800)
  })

  it('fixed, no timesheet: no hours at all (Andressa)', () => {
    const { lines } = buildInvoiceLines({ paysAs: 'fixed_no_timesheet', periodName: 'October 2026', hourlyRate: null, fixedAmount: 2000, byClient: [] })
    expect(lines[0].hoursSeconds).toBeNull()
  })

  it('refuses without a rate or an amount, rather than billing zero', () => {
    expect(() => buildInvoiceLines({ paysAs: 'hourly', periodName: 'October 2026', hourlyRate: null, fixedAmount: null, byClient: [] })).toThrow(/rate/)
    expect(() => buildInvoiceLines({ paysAs: 'fixed_monthly', periodName: 'October 2026', hourlyRate: null, fixedAmount: null, byClient: [] })).toThrow(/amount/)
  })

  it('cents never drift', () => {
    const { total } = buildInvoiceLines({ paysAs: 'hourly', periodName: 'X', hourlyRate: 18.33, fixedAmount: null, byClient: [{ client: 'A', seconds: H(1.25) }, { client: 'B', seconds: H(2.25) }] })
    expect(total).toBe(22.91 + 41.24)
  })
})

describe('dueOn', () => {
  it('adds the payment days', () => {
    expect(dueOn('2026-11-01', 14)).toBe('2026-11-15')
    expect(dueOn('2026-12-20', 15)).toBe('2027-01-04')
  })
})
