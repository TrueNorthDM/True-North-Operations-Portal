import { describe, expect, it } from 'vitest'
import { allWaiting, decisionText, eventKey, joinableReport, joinedToast, receiptsText, reportTitle, rmbVersion, totalsText } from './reimbursement-reports'

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

describe('one approval for the same event (owner, 5 November 2026)', () => {
  const reports = [{ id: 4, name: 'ASI convention' }, { id: 7, name: 'Sao Paulo trip' }, { id: 9, name: 'asi  Convention ' }, { id: 11, name: null }]
  it('compares names with case and spaces ignored', () => {
    expect(eventKey('  ASI  Convention ')).toBe(eventKey('asi convention'))
    expect(eventKey('ASI convention')).not.toBe(eventKey('ASI conventions'))
    expect(eventKey(null)).toBe('')
  })
  it('joins the newest request with that name still entirely waiting', () => {
    const items = [{ report_id: 4, state: 'pending' }, { report_id: 9, state: 'pending' }, { report_id: 9, state: 'pending' }, { report_id: 7, state: 'pending' }]
    expect(joinableReport(reports, items, 'ASI Convention')).toBe(9)
    expect(joinableReport(reports, items, 'sao paulo TRIP')).toBe(7)
  })
  it('makes a new request when the one with that name is partly decided, withdrawn or empty', () => {
    expect(joinableReport(reports, [{ report_id: 9, state: 'pending' }, { report_id: 9, state: 'approved' }, { report_id: 4, state: 'denied' }], 'ASI convention')).toBeNull()
    expect(joinableReport(reports, [{ report_id: 9, state: 'withdrawn' }, { report_id: 4, state: 'pending' }], 'ASI convention')).toBe(4)
    expect(joinableReport(reports, [], 'ASI convention')).toBeNull()
    expect(joinableReport(reports, [{ report_id: 11, state: 'pending' }], '')).toBeNull()
    expect(joinableReport(reports, [{ report_id: 4, state: 'pending' }], 'Other trip')).toBeNull()
  })
  it('says where the receipts went', () => {
    expect(joinedToast(' ASI convention ', 5)).toBe('Added to your waiting request "ASI convention": now 5 receipts.')
  })
  it('lets only a request with every receipt waiting be edited or withdrawn', () => {
    expect(allWaiting([{ state: 'pending' }, { state: 'pending' }])).toBe(true)
    expect(allWaiting([{ state: 'pending' }, { state: 'denied' }])).toBe(false)
    expect(allWaiting([])).toBe(false)
  })
})

describe('the version a decider saw (audit, 5 November 2026)', () => {
  const row = { id: 1, state: 'pending', spent_on: '2026-10-30', category: 'Software', amount: 45, currency: 'USD', purpose: 'Figma', client: null, billable: false, miles: null, receipt_path: 'a/1.pdf', report_id: 7 }
  it('is the same however the database writes the numbers, and in any order', () => {
    expect(rmbVersion([{ ...row, amount: '45.00' }])).toBe(rmbVersion([row]))
    const two = { ...row, id: 2, purpose: 'Hotel' }
    expect(rmbVersion([two, row])).toBe(rmbVersion([row, two]))
  })
  it('changes with anything the decider is shown or decides on', () => {
    const v = rmbVersion([row])
    for (const change of [{ amount: 45.01 }, { purpose: 'Figma, two seats' }, { receipt_path: 'a/9.pdf' }, { category: 'Other' }, { spent_on: '2026-10-29' }, { client: '2 - i7 Marketing' }, { billable: true }, { miles: 10 }, { currency: 'KES' }, { state: 'approved' }]) {
      expect(rmbVersion([{ ...row, ...change }]), JSON.stringify(change)).not.toBe(v)
    }
    expect(rmbVersion([row, { ...row, id: 2 }])).not.toBe(v)
  })
})
