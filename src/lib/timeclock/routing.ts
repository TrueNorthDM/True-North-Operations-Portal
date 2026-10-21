/**
 * Who approves a timesheet and its invoice (Clocky part 2, README_PART2.md
 * "Approval routing", implemented exactly):
 *
 *   hoursApprover(p)   = p.reportsTo                  null for the Deputy Director
 *   invoiceApprover(p) = invoiceApprovers has p.reportsTo ? p.reportsTo : the default approver
 *   oneStep(p)         = employee, or hours and invoice with the same person,
 *                        or fixed with no timesheet
 *
 *   Timesheet states:  submitted -> (two steps) hours_approved -> approved | returned
 *                      submitted -> (one step) approved | returned
 *   Deputy Director:   submitted -> recorded (no approver)
 *
 * The people come from invoice_settings (invoice approvers, the default one,
 * the Deputy Director), never from names in code. Pure: the Approvals list,
 * the 6C page and the actions decide with it, and the tests hold it to the
 * README.
 */

export type PaysAs = 'hourly' | 'fixed_monthly' | 'fixed_no_timesheet'

export interface RoutePerson {
  personId: string
  /** Directory, Work tab, "Reports to" (people.manager_id). */
  reportsTo: string | null
  isContractor: boolean
  /** Contractors only; null for employees. */
  paysAs: PaysAs | null
}

export interface RouteSettings {
  /** "Approves invoices" (Arnaldo Oliveira, Dave Sharpe). */
  invoiceApprovers: readonly string[]
  /** Approves every invoice not taken by another approver (Arnaldo Oliveira). */
  defaultApprover: string | null
  /** Their own timesheet is recorded without approval (Dave Sharpe). */
  deputyDirector: string | null
}

export type TimesheetState = 'draft' | 'submitted' | 'hours_approved' | 'approved' | 'returned' | 'recorded'

/** Recorded without approval: the Deputy Director's own timesheet. */
export const isRecordedOnly = (p: RoutePerson, s: RouteSettings): boolean => !!s.deputyDirector && p.personId === s.deputyDirector

export function hoursApprover(p: RoutePerson, s: RouteSettings): string | null {
  if (isRecordedOnly(p, s)) return null
  // Nobody to report to (a gap in the Directory): the default approver decides.
  return p.reportsTo ?? s.defaultApprover
}

export function invoiceApprover(p: RoutePerson, s: RouteSettings): string | null {
  if (isRecordedOnly(p, s) || !p.isContractor) return null
  return p.reportsTo && s.invoiceApprovers.includes(p.reportsTo) ? p.reportsTo : s.defaultApprover
}

export function oneStep(p: RoutePerson, s: RouteSettings): boolean {
  return !p.isContractor || p.paysAs === 'fixed_no_timesheet' || hoursApprover(p, s) === invoiceApprover(p, s)
}

/** The step a waiting timesheet is at, and whose decision it is. Null once nothing waits. */
export function currentStep(p: RoutePerson, s: RouteSettings, state: TimesheetState): { step: 'hours' | 'invoice' | 'both' | 'payroll'; owner: string | null } | null {
  if (state === 'submitted') {
    if (!p.isContractor) return { step: 'payroll', owner: hoursApprover(p, s) }
    if (p.paysAs === 'fixed_no_timesheet') return { step: 'invoice', owner: invoiceApprover(p, s) }
    return oneStep(p, s) ? { step: 'both', owner: invoiceApprover(p, s) } : { step: 'hours', owner: hoursApprover(p, s) }
  }
  if (state === 'hours_approved') return { step: 'invoice', owner: invoiceApprover(p, s) }
  return null
}

/** What submitting does: wait for approval, or (the Deputy Director) be recorded at once. */
export const stateOnSubmit = (p: RoutePerson, s: RouteSettings): TimesheetState => (isRecordedOnly(p, s) ? 'recorded' : 'submitted')

/** The state an approval moves the timesheet to. */
export function stateAfterApprove(p: RoutePerson, s: RouteSettings, state: TimesheetState): TimesheetState | null {
  const step = currentStep(p, s, state)
  if (!step) return null
  return step.step === 'hours' ? 'hours_approved' : 'approved'
}
