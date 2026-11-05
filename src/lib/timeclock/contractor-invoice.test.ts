import { describe, it, expect } from 'vitest'
import { builderProblem, compareInvoice, confirmText, fixedLine, lineAmount, linesAtFileRate, linesFromTimesheet, madeByLine, missingOnFile, payOnFile } from './contractor-invoice-rules'

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
    expect(builderProblem([{ description: 'i7', client: null, hours: null, rate: 25, amount: null }])).toBe('Line 1: write the hours.')
    expect(builderProblem([{ description: 'i7', client: null, hours: 2, rate: 25, amount: null }])).toBeNull()
  })
  it('opens from the sent timesheet: one line a client, with the rate on file', () => {
    const l = linesFromTimesheet(timesheet, 'October 2026', 25)
    expect(l.map(x => [x.description, x.hours, x.rate, lineAmount(x)])).toEqual([
      ['i7 Marketing, October 2026', 96, 25, 2400], ['COE Group, October 2026', 52.5, 25, 1312.5], ['True North Internal, October 2026', 12, 25, 300],
    ])
    expect(linesFromTimesheet(timesheet, 'October 2026', null).every(x => x.rate === null)).toBe(true)
  })
})

describe('the rate and the amount on file (owner, 5 November 2026)', () => {
  it('hourly bills at the rate on file, whatever rate or amount is sent', () => {
    const sent = [
      { description: 'i7 Marketing, October 2026', client: 'i7 Marketing', hours: 96, rate: 90, amount: null },
      { description: 'Extra', client: null, hours: null, rate: null, amount: 5000 },
    ]
    const r = linesAtFileRate(sent, payOnFile('hourly', 25, 1800))
    if ('error' in r) throw new Error(r.error)
    expect(r.lines.map(l => [l.rate, l.amount])).toEqual([[25, null], [25, null]])
    expect(lineAmount(r.lines[0])).toBe(2400)
    // A free amount on an hourly invoice is not allowed: it has to be hours.
    expect(builderProblem(r.lines)).toBe('Line 2: write the hours.')
  })
  it('fixed bills one line at the amount on file', () => {
    const r = linesAtFileRate([{ description: 'Fixed monthly amount, October 2026', client: null, hours: 10, rate: 99, amount: 9999 }], payOnFile('fixed_monthly', 25, 1800))
    if ('error' in r) throw new Error(r.error)
    expect(r.lines).toEqual([{ description: 'Fixed monthly amount, October 2026', client: null, hours: null, rate: null, amount: 1800 }])
    expect(fixedLine('October 2026', 1800)).toEqual(r.lines[0])
    expect(linesAtFileRate([fixedLine('October 2026', 1800), fixedLine('October 2026', 1800)], payOnFile('fixed_no_timesheet', null, 1800))).toEqual({ error: expect.stringMatching(/one line/) })
  })
  it('nothing on file (or zero) cannot be built, and says who to ask', () => {
    expect(payOnFile('hourly', 0, null)).toEqual({ kind: 'hourly', rate: null })
    expect(missingOnFile(payOnFile('hourly', null, 1800))).toMatch(/no hourly rate on file.*whoever approves your invoice/)
    expect(missingOnFile(payOnFile('fixed_no_timesheet', 25, null))).toMatch(/no fixed amount on file/)
    expect(missingOnFile(payOnFile('hourly', 25, null))).toBeNull()
    expect(linesAtFileRate(linesFromTimesheet(timesheet, 'October 2026', null), payOnFile('hourly', null, null))).toEqual({ error: expect.stringMatching(/no hourly rate/) })
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
  it('an invoice the portal made from the timesheet (made_by null) is checked on its total only', () => {
    // Before 4 November 2026 the lines carried the TSheets names; the timesheet now groups by the 2026 clients.
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: [],
      invoice: { madeBy: null, byClient: [{ client: '1 - True North', seconds: h(80) }, { client: '2 - i7 Marketing', seconds: h(80.5) }], hours: 160.5, total: 4012.5, reimbursements: [] } })
    expect(c.rows).toEqual([])
    expect(c.matches).toBe(true)
    expect(c.summary).toBeNull()
    expect(c.total.check).toBe('match')
    expect(c.note).toBe("Made by the portal from this timesheet before November 4, 2026: the hours are the timesheet's. Total $4,012.50.")
    const off = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: rmb,
      invoice: { madeBy: null, byClient: [], hours: 160.5, total: 4112.5, reimbursements: [] } })
    expect(off.rows).toEqual([])
    expect(off.total).toMatchObject({ check: 'differs', difference: '+$100.00' })
    expect(off.matches).toBe(false)
  })
  it('a reimbursement left out shows as missing', () => {
    const c = compareInvoice({ timesheet, pay: { kind: 'hourly', rate: 25 }, reimbursements: rmb,
      invoice: { madeBy: 'builder', byClient: timesheet, hours: 160.5, total: 4012.5, reimbursements: [] } })
    expect(c.rows.find(r => r.label === 'Reimbursement RCT-2026-031')?.check).toBe('only-timesheet')
  })
})
