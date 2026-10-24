import { describe, it, expect } from 'vitest'
import { currentStep, hoursApprover, invoiceApprover, isRecordedOnly, oneStep, stateAfterApprove, stateOnSubmit, type RoutePerson, type RouteSettings } from './routing'

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
