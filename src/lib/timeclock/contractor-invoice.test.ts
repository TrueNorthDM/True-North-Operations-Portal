import { describe, it, expect } from 'vitest'
import { builderProblem, compareInvoice, confirmText, lineAmount, linesFromTimesheet, madeByLine } from './contractor-invoice'

// The contractor makes and sends their own invoice (leadership, 4 November 2026).

const h = (n: number) => n * 3600
const timesheet = [{ client: 'i7 Marketing', seconds: h(96) }, { client: 'COE Group', seconds: h(52.5) }, { client: 'True North Internal', seconds: h(12) }]

describe('what they confirm and how it was made', () => {
  it('the sentence is kept word for word', () => {
    expect(confirmText('own_file', 'October 2026')).toBe('This is my invoice. I made it and I am sending it to True North for October 2026.')
    expect(confirmText('builder', 'October 2026')).toBe('This is my invoice. I wrote these lines and I am sending this invoice to True North for October 2026.')
  })
  it('names the way', () => {
    expect(madeByLine('own_file', 'Jordan Lee', 'Invoice 0142.pdf')).toBe('Their own file, "Invoice 0142.pdf"')
    expect(madeByLine('builder', 'Jordan Lee')).toBe("Built by Jordan Lee with the portal's invoice builder")
    expect(madeByLine(null, 'Jordan Lee')).toMatch(/before November 2026/)
  })
})

describe('the builder', () => {
  it('a line is hours times rate, or an amount', () => {
    expect(lineAmount({ description: 'x', client: null, hours: 96, rate: 25, amount: null })).toBe(2400)
    expect(lineAmount({ description: 'x', client: null, hours: null, rate: null, amount: 1800 })).toBe(1800)
    expect(lineAmount({ description: 'x', client: null, hours: 96, rate: null, amount: null })).toBeNull()
  })
  it('says what is missing', () => {
    expect(builderProblem([])).toBe('Add at least one line.')
    expect(builderProblem([{ description: '', client: null, hours: 1, rate: 1, amount: null }])).toBe('Line 1: say what it covers.')
    expect(builderProblem([{ description: 'i7', client: null, hours: 2, rate: null, amount: null }])).toBe('Line 1: write the hours and your rate, or an amount.')
    expect(builderProblem([{ description: 'i7', client: null, hours: 2, rate: 25, amount: null }])).toBeNull()
  })
  it('"Use my timesheet hours" copies the hours by client and leaves the rate to them', () => {
    const l = linesFromTimesheet(timesheet, 'October 2026')
    expect(l.map(x => [x.description, x.hours, x.rate])).toEqual([
      ['i7 Marketing, October 2026', 96, null], ['COE Group, October 2026', 52.5, null], ['True North Internal, October 2026', 12, null],
    ])
  })
})

describe('the invoice beside the timesheet', () => {
  const rmb = [{ label: 'RCT-2026-031', amount: 84.2 }]
  it('matches when every client and the total agree', () => {
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: rmb,
      invoice: { madeBy: 'builder', byClient: timesheet, hours: 160.5, total: 4096.7, reimbursements: ['RCT-2026-031'] } })
    expect(c.matches).toBe(true)
    expect(c.summary).toBeNull()
    expect(c.total.timesheet).toBe('$4,096.70')
  })
  it('marks 2h more on one client and $50 more in all', () => {
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: rmb,
      invoice: { madeBy: 'builder', byClient: [timesheet[0], { client: 'COE Group', seconds: h(54.5) }, timesheet[2]], hours: 162.5, total: 4146.7, reimbursements: ['RCT-2026-031'] } })
    expect(c.matches).toBe(false)
    expect(c.rows.find(r => r.label === 'COE Group')).toMatchObject({ check: 'differs', difference: '+2h 00m' })
    expect(c.total).toMatchObject({ check: 'differs', difference: '+$50.00' })
    expect(c.summary).toBe('It bills 2h 00m more on COE Group, and comes to $50.00 more than the approved hours at the rate on file.')
  })
  it('an own file is checked on the hours in all and the total', () => {
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: [],
      invoice: { madeBy: 'own_file', byClient: [], hours: 160.5, total: 4012.5, reimbursements: [] } })
    expect(c.rows.filter(r => r.check === 'on-file')).toHaveLength(3)
    expect(c.matches).toBe(true)
  })
  it('a fixed amount against the amount on file; no amount on file never matches', () => {
    expect(compareInvoice({ timesheet: [], pay: { kind: 'fixed', amount: 1800 }, reimbursements: [], invoice: { madeBy: 'own_file', byClient: [], hours: null, total: 1800, reimbursements: [] } }).matches).toBe(true)
    const none = compareInvoice({ timesheet: [], pay: { kind: 'fixed', amount: null }, reimbursements: [], invoice: { madeBy: 'own_file', byClient: [], hours: null, total: 1800, reimbursements: [] } })
    expect(none.matches).toBe(false)
    expect(none.summary).toMatch(/no rate or amount on file/)
  })
  it('a reimbursement left out shows as missing', () => {
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: rmb,
      invoice: { madeBy: 'builder', byClient: timesheet, hours: 160.5, total: 4012.5, reimbursements: [] } })
    expect(c.rows.find(r => r.label === 'Reimbursement RCT-2026-031')?.check).toBe('only-timesheet')
  })
})
