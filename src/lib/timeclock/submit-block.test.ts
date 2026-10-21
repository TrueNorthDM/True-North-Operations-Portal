import { describe, it, expect } from 'vitest'
import { buildSubmitBlock } from './submit-block'
import { parsePaidOn } from './paid-on'

const H = 3600

describe('the Submit window block (6A, 6B)', () => {
  it('a contractor by the hour: the invoice it makes, with the reimbursement (6A)', () => {
    const b = buildSubmitBlock({
      isContractor: true, paysAs: 'hourly', hourlyRate: 14, fixedAmount: null, periodName: 'October 2026', label: 'October',
      byClient: [{ client: '2 - i7 Marketing', seconds: 120 * H }, { client: '1 - True North', seconds: 30.5 * H }, { client: 'A.org Job', seconds: 12 * H }],
      reimbursements: [{ id: 1, category: 'Internet', purpose: 'Internet, October', amount: 35 }], timeOff: [], workedSeconds: 162.5 * H,
      hoursBy: 'Arnaldo Oliveira', invoiceBy: 'Arnaldo Oliveira',
    })
    expect(b.title).toBe('Your invoice')
    expect(b.lines).toEqual([{ k: '162h 30m × $14.00/h', v: '$2,275.00' }, { k: 'Reimbursement: Internet, October', v: '$35.00' }])
    expect(b.sum).toBe('$2,310.00')
    expect(b.note).toBe('Created when you submit. Arnaldo Oliveira approves your hours and this invoice together.')
    expect(b.confirm).toBe('We will also create your invoice for October: 162h 30m at $14.00/h, plus 1 reimbursement. You can see it after you submit.')
  })

  it('two steps name both approvers', () => {
    const b = buildSubmitBlock({
      isContractor: true, paysAs: 'hourly', hourlyRate: 20, fixedAmount: null, periodName: 'October 2026', label: 'October',
      byClient: [{ client: 'x', seconds: 10 * H }], reimbursements: [], timeOff: [], workedSeconds: 10 * H, hoursBy: 'Wendy Cacka', invoiceBy: 'Arnaldo Oliveira',
    })
    expect(b.note).toBe('Created when you submit. Wendy Cacka approves your hours, then Arnaldo Oliveira the invoice.')
  })

  it('an employee: the payroll summary with the time off (6B)', () => {
    const b = buildSubmitBlock({
      isContractor: false, paysAs: null, hourlyRate: null, fixedAmount: null, periodName: 'Oct 4 to 17, 2026', label: 'Oct 4 to 17',
      byClient: [], reimbursements: [], timeOff: [{ date: '2026-10-16', kind: 'Vacation', seconds: 8 * H }], workedSeconds: 80 * H,
      hoursBy: 'Arnaldo Oliveira', invoiceBy: null,
    })
    expect(b.kind).toBe('payroll')
    expect(b.lines).toEqual([{ k: 'Worked', v: '80h 00m' }, { k: 'PTO: Vacation, Fri, Oct 16', v: '8h 00m' }])
    expect(b.sumLabel).toBe('Paid hours')
    expect(b.sum).toBe('88h 00m')
    expect(b.note).toBe('Sent to Rippling when approved.')
  })
})

describe('the Paid on day (6G)', () => {
  it('reads the way the dialog writes it', () => {
    expect(parsePaidOn('Nov 3, 2026')).toBe('2026-11-03')
    expect(parsePaidOn(' november 12 2026 ')).toBe('2026-11-12')
    expect(parsePaidOn('2026-11-03')).toBe('2026-11-03')
    expect(parsePaidOn('Feb 30, 2026')).toBeNull()
    expect(parsePaidOn('tomorrow')).toBeNull()
  })
})
