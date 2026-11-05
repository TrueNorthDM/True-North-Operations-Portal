import { describe, it, expect } from 'vitest'
import { currentStep, formApprover, hoursApprover, invoiceApprover, isRecordedOnly, isSentInvoice, loneInvoiceApprover, oneStep, orList, reimbursementApprovers, requestApprover, requestDeciders, stateAfterApprove, stateOnSubmit, type RoutePerson, type RouteSettings } from './routing'

// The README's people: Arnaldo approves invoices by default, Dave Sharpe is the
// Deputy Director and approves the invoices of those who report to him.
const S: RouteSettings = { invoiceApprovers: ['arnaldo', 'dave'], defaultApprover: 'arnaldo', deputyDirector: 'dave' }
const p = (personId: string, reportsTo: string | null, isContractor = true, paysAs: RoutePerson['paysAs'] = 'hourly'): RoutePerson => ({ personId, reportsTo, isContractor, paysAs: isContractor ? paysAs : null })

const samuel = p('samuel', 'wendy')                  // reports to Wendy (Team Leader of Web)
const cheyenne = p('cheyenne', 'arnaldo')            // reports to Arnaldo
const rock = p('rock', 'dave')                       // reports to Dave
const wendy = p('wendy', 'arnaldo', false)           // employee
const andressa = p('andressa', 'arnaldo', true, 'fixed_no_timesheet')
const john = p('john', 'dave', true, 'fixed_no_timesheet')
const dave = p('dave', 'arnaldo', false)
const arnaldo = p('arnaldo', 'dave')                 // a contractor, reports to Dave

describe('approval routing (README_PART2 "Approval routing")', () => {
  it('hours go to Reports to', () => {
    expect(hoursApprover(samuel, S)).toBe('wendy')
    expect(hoursApprover(rock, S)).toBe('dave')
    expect(hoursApprover(arnaldo, S)).toBe('dave')
  })

  it('invoices go to Arnaldo, or to Dave for his direct reports', () => {
    expect(invoiceApprover(samuel, S)).toBe('arnaldo')
    expect(invoiceApprover(rock, S)).toBe('dave')
    expect(invoiceApprover(john, S)).toBe('dave')
    expect(invoiceApprover(cheyenne, S)).toBe('arnaldo')
    // Employees have no invoice.
    expect(invoiceApprover(wendy, S)).toBeNull()
  })

  it('one step when it is the same person, for employees and for fixed with no timesheet', () => {
    expect(oneStep(samuel, S)).toBe(false)
    expect(oneStep(cheyenne, S)).toBe(true)
    expect(oneStep(rock, S)).toBe(true)
    expect(oneStep(wendy, S)).toBe(true)
    expect(oneStep(andressa, S)).toBe(true)
  })

  it('the step and its owner, as the Approvals list sorts them', () => {
    expect(currentStep(samuel, S, 'submitted')).toEqual({ step: 'hours', owner: 'wendy' })
    expect(currentStep(samuel, S, 'hours_approved')).toEqual({ step: 'invoice', owner: 'arnaldo' })
    expect(currentStep(cheyenne, S, 'submitted')).toEqual({ step: 'both', owner: 'arnaldo' })
    expect(currentStep(rock, S, 'submitted')).toEqual({ step: 'both', owner: 'dave' })
    expect(currentStep(wendy, S, 'submitted')).toEqual({ step: 'payroll', owner: 'arnaldo' })
    expect(currentStep(john, S, 'submitted')).toEqual({ step: 'invoice', owner: 'dave' })
    expect(currentStep(samuel, S, 'approved')).toBeNull()
  })

  it("the Deputy Director's own timesheet is recorded, never approved", () => {
    expect(isRecordedOnly(dave, S)).toBe(true)
    expect(stateOnSubmit(dave, S)).toBe('recorded')
    expect(hoursApprover(dave, S)).toBeNull()
    expect(stateOnSubmit(samuel, S)).toBe('submitted')
  })

  it('approving moves one step at a time', () => {
    expect(stateAfterApprove(samuel, S, 'submitted')).toBe('hours_approved')
    expect(stateAfterApprove(samuel, S, 'hours_approved')).toBe('approved')
    expect(stateAfterApprove(cheyenne, S, 'submitted')).toBe('approved')
    expect(stateAfterApprove(cheyenne, S, 'approved')).toBeNull()
  })

  it('nobody to report to: the default approver decides', () => {
    expect(hoursApprover(p('new', null), S)).toBe('arnaldo')
    expect(oneStep(p('new', null), S)).toBe(true)
  })

  it('someone who cannot open Approvals is passed over for the default approver', () => {
    // Wendy (Team Leader of Web) lost Approvals; Dave still has it.
    const A: RouteSettings = { ...S, approvers: ['arnaldo', 'dave'] }
    expect(hoursApprover(samuel, A)).toBe('arnaldo')
    expect(oneStep(samuel, A)).toBe(true)
    expect(currentStep(samuel, A, 'submitted')).toEqual({ step: 'both', owner: 'arnaldo' })
    expect(currentStep(wendy, A, 'submitted')).toEqual({ step: 'payroll', owner: 'arnaldo' })
    expect(hoursApprover(rock, A)).toBe('dave')
    // An invoice approver who lost it too.
    const B: RouteSettings = { ...S, approvers: ['arnaldo'] }
    expect(invoiceApprover(rock, B)).toBe('arnaldo')
    expect(currentStep(john, B, 'submitted')).toEqual({ step: 'invoice', owner: 'arnaldo' })
    // Not given: as named, whoever they are.
    expect(hoursApprover(samuel, S)).toBe('wendy')
  })
})

describe('who decides requests (owner, 1 November 2026: "Who approves what")', () => {
  const R: RouteSettings = { ...S, reimbursementApprovers: ['dave'] }

  it('time off and extra hours follow the invoice rule, employees too', () => {
    expect(requestApprover(rock, R)).toBe('dave')
    expect(requestApprover(cheyenne, R)).toBe('arnaldo')
    // Reports to someone who is not an invoice approver: the default approver.
    expect(requestApprover(samuel, R)).toBe('arnaldo')
    expect(requestApprover(wendy, R)).toBe('arnaldo')
    expect(requestApprover(p('emp', 'dave', false), R)).toBe('dave')
    expect(requestApprover(p('new', null, false), R)).toBe('arnaldo')
  })

  it('never the person: their own goes to the default approver, the default approver\'s to the next invoice approver', () => {
    // Arnaldo reports to Dave: Dave decides. Were Arnaldo to report to himself or to nobody, Dave still.
    expect(requestApprover(arnaldo, R)).toBe('dave')
    expect(requestApprover(p('arnaldo', null), R)).toBe('dave')
    expect(requestApprover(p('arnaldo', 'wendy'), R)).toBe('dave')
    // Dave reports to Arnaldo, an invoice approver.
    expect(requestApprover(dave, R)).toBe('arnaldo')
    // Dave reporting to himself (a gap) lands on him: the default approver instead.
    expect(requestApprover(p('dave', 'dave', false), R)).toBe('arnaldo')
  })

  it('someone who cannot open Approvals is passed over for the default approver', () => {
    const B: RouteSettings = { ...R, approvers: ['arnaldo'] }
    expect(requestApprover(rock, B)).toBe('arnaldo')
    // The default approver's own, when the other invoice approver cannot open Approvals: nobody.
    expect(requestApprover(p('arnaldo', 'dave'), B)).toBeNull()
  })

  it('reimbursements go to everyone on the list, never their own', () => {
    expect(reimbursementApprovers('samuel', R)).toEqual(['dave'])
    expect(reimbursementApprovers('arnaldo', R)).toEqual(['dave'])
    // Dave's own: the list minus him is empty, so the default approver.
    expect(reimbursementApprovers('dave', R)).toEqual(['arnaldo'])
    const two: RouteSettings = { ...R, reimbursementApprovers: ['dave', 'tina'] }
    expect(reimbursementApprovers('samuel', two)).toEqual(['dave', 'tina'])
    expect(reimbursementApprovers('dave', two)).toEqual(['tina'])
  })

  it('a reimbursement with nobody able on the list goes to the default approver, or the next invoice approver', () => {
    expect(reimbursementApprovers('samuel', { ...R, reimbursementApprovers: [] })).toEqual(['arnaldo'])
    expect(reimbursementApprovers('samuel', { ...R, approvers: ['arnaldo'] })).toEqual(['arnaldo'])
    // The default approver's own, the list holding only them: the other invoice approver.
    expect(reimbursementApprovers('arnaldo', { ...R, reimbursementApprovers: ['arnaldo'] })).toEqual(['dave'])
    expect(reimbursementApprovers('arnaldo', { ...S, defaultApprover: 'arnaldo', invoiceApprovers: ['arnaldo'], reimbursementApprovers: ['arnaldo'] })).toEqual([])
  })

  it('one answer per kind, and the names read as one line', () => {
    expect(requestDeciders('off', rock, R)).toEqual(['dave'])
    expect(requestDeciders('xh', samuel, R)).toEqual(['arnaldo'])
    expect(requestDeciders('rmb', dave, R)).toEqual(['arnaldo'])
    expect(orList(['David Sharpe'])).toBe('David Sharpe')
    expect(orList(['A', 'B'])).toBe('A or B')
    expect(orList(['X', 'Y', 'Z'])).toBe('X, Y or Z')
  })
})

describe('an invoice from the invoice form (migration 147)', () => {
  it('follows the invoice rule whatever the person\'s type, else the default approver', () => {
    expect(formApprover(rock, S)).toBe('dave')
    expect(formApprover(samuel, S)).toBe('arnaldo')
    // An employee in the Directory still has an approver for a form invoice.
    expect(formApprover(wendy, S)).toBe('arnaldo')
    // The Deputy Director's own goes to the default approver, never to nobody.
    expect(formApprover(dave, S)).toBe('arnaldo')
    expect(formApprover(p('new', null), S)).toBe('arnaldo')
  })

  it('is the rule only for a form invoice', () => {
    expect(loneInvoiceApprover(wendy, S, 'form_fixed')).toBe('arnaldo')
    expect(loneInvoiceApprover(wendy, S, null)).toBeNull()
    expect(loneInvoiceApprover(john, S, null)).toBe('dave')
  })
})

describe('the contractor sends their own invoice (leadership, 4 November 2026)', () => {
  it('until it is sent, only the hours wait, even when one person approves both', () => {
    expect(currentStep(cheyenne, S, 'submitted', false)).toEqual({ step: 'hours', owner: 'arnaldo' })
    expect(currentStep(samuel, S, 'submitted', false)).toEqual({ step: 'hours', owner: 'wendy' })
    expect(stateAfterApprove(cheyenne, S, 'submitted', false)).toBe('hours_approved')
  })

  it('hours approved: nothing waits on the approver until the invoice arrives', () => {
    expect(currentStep(samuel, S, 'hours_approved', false)).toBeNull()
    expect(currentStep(samuel, S, 'hours_approved', true)).toEqual({ step: 'invoice', owner: 'arnaldo' })
  })

  it('once sent, as before: both for one approver, hours then invoice for two', () => {
    expect(currentStep(cheyenne, S, 'submitted', true)).toEqual({ step: 'both', owner: 'arnaldo' })
    expect(currentStep(samuel, S, 'submitted', true)).toEqual({ step: 'hours', owner: 'wendy' })
  })

  it('employees are not touched by it', () => {
    expect(currentStep(wendy, S, 'submitted', false)).toEqual({ step: 'payroll', owner: 'arnaldo' })
  })

  it('an invoice sent back is not sent', () => {
    expect(isSentInvoice('waiting')).toBe(true)
    expect(isSentInvoice('approved')).toBe(true)
    expect(isSentInvoice('paid')).toBe(true)
    expect(isSentInvoice('draft')).toBe(false)
    expect(isSentInvoice(null)).toBe(false)
  })
})
