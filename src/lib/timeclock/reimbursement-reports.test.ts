import { describe, expect, it } from 'vitest'
import { decisionText, receiptsText, reportTitle, totalsText } from './reimbursement-reports'

describe('a reimbursement request with several receipts', () => {
  it('adds the receipts up, dollars first, each currency apart', () => {
    expect(totalsText([{ amount: 412, currency: 'USD' }, { amount: 378.6, currency: 'USD' }, { amount: 18.4, currency: 'USD' }, { amount: 64, currency: 'USD' }])).toBe('$873.00')
    expect(totalsText([{ amount: 1200, currency: 'KES' }, { amount: 18.4, currency: 'USD' }])).toBe('$18.40 and 1,200.00 KES')
    expect(totalsText([{ amount: 5, currency: 'RWF' }, { amount: 1, currency: 'KES' }, { amount: 2, currency: 'USD' }])).toBe('$2.00, 1.00 KES and 5.00 RWF')
    expect(totalsText([])).toBe('$0.00')
  })
  it('names the request', () => {
    expect(receiptsText(1)).toBe('1 receipt')
    expect(reportTitle('São Paulo trip', 4)).toBe('São Paulo trip, 4 receipts')
    expect(reportTitle(null, 3)).toBe('3 receipts')
    expect(reportTitle('  ', 2)).toBe('2 receipts')
  })
  it('says what the decision came to', () => {
    expect(decisionText(4, 0)).toBe('Approved all 4.')
    expect(decisionText(1, 0)).toBe('Approved.')
    expect(decisionText(3, 1)).toBe('Approved 3, denied 1.')
    expect(decisionText(0, 2)).toBe('Denied all 2.')
  })
})
