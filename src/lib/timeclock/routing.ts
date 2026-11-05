/**
 * Who approves a timesheet and its invoice (Clocky part 2, README_PART2.md
 * "Approval routing", implemented exactly):
 *
 *   hoursApprover(p)   = p.reportsTo                  null for the Deputy Director
 *   invoiceApprover(p) = invoiceApprovers has p.reportsTo ? p.reportsTo : the default approver
 *
 *   Either one goes to the default approver instead when the person it names
 *   cannot open Approvals (settings.approvers, when given): a timesheet never
 *   waits for someone who could not decide it.
 *   oneStep(p)         = employee, or hours and invoice with the same person,
 *                        or fixed with no timesheet
 *
 *   Requests (owner, 1 November 2026, Company settings > Invoices "Who
 *   approves what"):
 *   requestApprover(p) = the invoice rule for everyone, employees too: time
 *                        off, its cancellation and extra hours
 *   reimbursementApprovers(p) = everyone on the Reimbursements list
 *   Neither ever names the person: their own request goes to the default
 *   approver, or (the default approver's own) to the first other invoice
 *   approver.
 *
 *   Timesheet states:  submitted -> (two steps) hours_approved -> approved | returned
 *                      submitted -> (one step) approved | returned
 *   Deputy Director:   submitted -> recorded (no approver)
 *
 *   The contractor's own invoice (leadership, 4 November 2026): the portal no
 *   longer makes it from the timesheet; the contractor sends it. Until it is
 *   sent, a contractor's timesheet waits for its hours only ('hours', even
 *   when one person approves both), and once the hours are approved nothing
 *   waits on the approver: the invoice step starts when the invoice arrives.
 *   `invoiceSent` says whether it has (an invoice waiting, approved or paid;
 *   one sent back is not); left out, it is taken as sent.
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
  /** Decide reimbursements, any one of them (migration 146; David Sharpe). */
  reimbursementApprovers?: readonly string[]
  /**
   * Everyone who can open Approvals and sign in (pay-terms.ts loadRouteSettings).
   * When given, an approver not on it is passed over for the default approver;
   * left out, the people above decide as named.
   */
  approvers?: readonly string[] | null
}

/** The default approver instead of someone who cannot open Approvals to decide. */
const able = (id: string | null, s: RouteSettings): string | null =>
  id && s.approvers && !s.approvers.includes(id) ? s.defaultApprover : id

export type TimesheetState = 'draft' | 'submitted' | 'hours_approved' | 'approved' | 'returned' | 'recorded'

/** Recorded without approval: the Deputy Director's own timesheet. */
export const isRecordedOnly = (p: RoutePerson, s: RouteSettings): boolean => !!s.deputyDirector && p.personId === s.deputyDirector

export function hoursApprover(p: RoutePerson, s: RouteSettings): string | null {
  if (isRecordedOnly(p, s)) return null
  // Nobody to report to (a gap in the Directory), or someone who cannot open Approvals: the default approver decides.
  return able(p.reportsTo, s) ?? s.defaultApprover
}

export function invoiceApprover(p: RoutePerson, s: RouteSettings): string | null {
  if (isRecordedOnly(p, s) || !p.isContractor) return null
  return p.reportsTo && s.invoiceApprovers.includes(p.reportsTo) ? able(p.reportsTo, s) : s.defaultApprover
}

/**
 * An invoice from the invoice form (migration 147): the invoice rule, as for a
 * contractor whatever the person's type in the Directory, and the default
 * approver when that names nobody (the Deputy Director's own, say).
 */
export function formApprover(p: RoutePerson, s: RouteSettings): string | null {
  return invoiceApprover({ ...p, isContractor: true, paysAs: 'fixed_no_timesheet' }, s) ?? s.defaultApprover
}

/** Who decides an invoice with no timesheet: the form's rule when it came from the form (`source`), else the invoice rule. */
export const loneInvoiceApprover = (p: RoutePerson, s: RouteSettings, source: string | null | undefined): string | null =>
  source ? formApprover(p, s) : invoiceApprover(p, s)

export function oneStep(p: RoutePerson, s: RouteSettings): boolean {
  return !p.isContractor || p.paysAs === 'fixed_no_timesheet' || hoursApprover(p, s) === invoiceApprover(p, s)
}

/** The step a waiting timesheet is at, and whose decision it is. Null once nothing waits. */
export function currentStep(p: RoutePerson, s: RouteSettings, state: TimesheetState, invoiceSent = true): { step: 'hours' | 'invoice' | 'both' | 'payroll'; owner: string | null } | null {
  if (state === 'submitted') {
    if (!p.isContractor) return { step: 'payroll', owner: hoursApprover(p, s) }
    if (p.paysAs === 'fixed_no_timesheet') return { step: 'invoice', owner: invoiceApprover(p, s) }
    if (!invoiceSent) return { step: 'hours', owner: hoursApprover(p, s) }
    return oneStep(p, s) ? { step: 'both', owner: invoiceApprover(p, s) } : { step: 'hours', owner: hoursApprover(p, s) }
  }
  // Hours approved: the invoice step, once the contractor has sent it.
  if (state === 'hours_approved') return invoiceSent ? { step: 'invoice', owner: invoiceApprover(p, s) } : null
  return null
}

/** An invoice state that counts as sent by the contractor: waiting, approved or paid (not one sent back, 'draft'). */
export const isSentInvoice = (state: string | null | undefined): boolean => state === 'waiting' || state === 'approved' || state === 'paid'

/** What submitting does: wait for approval, or (the Deputy Director) be recorded at once. */
export const stateOnSubmit = (p: RoutePerson, s: RouteSettings): TimesheetState => (isRecordedOnly(p, s) ? 'recorded' : 'submitted')

/** The state an approval moves the timesheet to. */
export function stateAfterApprove(p: RoutePerson, s: RouteSettings, state: TimesheetState, invoiceSent = true): TimesheetState | null {
  const step = currentStep(p, s, state, invoiceSent)
  if (!step) return null
  return step.step === 'hours' ? 'hours_approved' : 'approved'
}

// ── Requests: time off, extra hours, reimbursements ─────────────────────────

/** Who decides instead when the rule lands on the person: the default approver, else the first other invoice approver. */
function notTheirOwn(id: string | null, personId: string, s: RouteSettings): string | null {
  if (id && id !== personId) return id
  if (s.defaultApprover && s.defaultApprover !== personId) return s.defaultApprover
  return s.invoiceApprovers.find(a => a !== personId && (!s.approvers || s.approvers.includes(a))) ?? null
}

/**
 * Who decides a time off, its cancellation, or extra hours (for the person the
 * hours are for, not who asked): the invoice rule applied to everyone. Their
 * Reports to when that is an invoice approver, else the default approver;
 * never the person themselves.
 */
export function requestApprover(p: Pick<RoutePerson, 'personId' | 'reportsTo'>, s: RouteSettings): string | null {
  const ruled = p.reportsTo && s.invoiceApprovers.includes(p.reportsTo) ? able(p.reportsTo, s) : s.defaultApprover
  return notTheirOwn(ruled, p.personId, s)
}

/**
 * Who decides a reimbursement: anyone on the Reimbursements list (the first
 * decision closes it), passed over when they cannot open Approvals, never the
 * person. Nobody left: the default approver, or the first other invoice approver.
 */
export function reimbursementApprovers(personId: string, s: RouteSettings): string[] {
  const list = [...new Set(s.reimbursementApprovers ?? [])].filter(id => id !== personId && (!s.approvers || s.approvers.includes(id)))
  if (list.length) return list
  const other = notTheirOwn(null, personId, s)
  return other ? [other] : []
}

export type RequestKind = 'off' | 'xh' | 'rmb'

/** Everyone who decides this kind of request for this person (one, but for a reimbursement). */
export const requestDeciders = (kind: RequestKind, p: Pick<RoutePerson, 'personId' | 'reportsTo'>, s: RouteSettings): string[] => {
  if (kind === 'rmb') return reimbursementApprovers(p.personId, s)
  const one = requestApprover(p, s)
  return one ? [one] : []
}

/** "David Sharpe", "Arnaldo Oliveira or David Sharpe", "A, B or C". */
export const orList = (names: readonly string[]): string =>
  names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
