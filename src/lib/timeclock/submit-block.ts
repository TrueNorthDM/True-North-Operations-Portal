/**
 * The block in the Submit window that says what submitting makes
 * (Invoices.dc.html 6A and 6B): a contractor's invoice, with the same lines
 * the invoice will have (buildInvoiceLines), or an employee's payroll
 * summary (worked hours and time off, sent to Rippling when approved).
 * Pure: clocky-entries.ts brings the person's terms and names.
 */

import { dayLabel } from './format'
import { buildInvoiceLines, type ReimbursementForInvoice } from './invoice-lines'
import { usd } from './invoice-doc'
import { formatDuration } from './rounding'
import type { PaysAs } from './routing'
import type { SubmitSummary } from './clocky-types'

export type SubmitBlock = NonNullable<SubmitSummary['block']>

export function buildSubmitBlock(x: {
  isContractor: boolean
  paysAs: PaysAs | null
  hourlyRate: number | null
  fixedAmount: number | null
  /** "October 2026" / "October" */
  periodName: string
  label: string
  byClient: readonly { client: string; seconds: number }[]
  reimbursements: readonly ReimbursementForInvoice[]
  /** Time off in the period: its day and kind. */
  timeOff: readonly { date: string; kind: string; seconds: number }[]
  workedSeconds: number
  /** Who approves the hours and who the invoice (names); null for the Deputy Director. */
  hoursBy: string | null
  invoiceBy: string | null
}): SubmitBlock {
  if (x.isContractor && x.paysAs && x.paysAs !== 'fixed_no_timesheet') {
    const { lines, total } = buildInvoiceLines({ paysAs: x.paysAs, periodName: x.periodName, hourlyRate: x.hourlyRate, fixedAmount: x.fixedAmount, byClient: x.byClient, reimbursements: x.reimbursements })
    const hours = lines.filter(l => l.kind === 'hours')
    const rmb = lines.filter(l => l.kind === 'reimbursement')
    const hoursAmount = hours.reduce((n, l) => n + Math.round(l.amount * 100), 0) / 100
    const rows: { k: string; v: string }[] = x.paysAs === 'hourly'
      ? [{ k: `${formatDuration(x.workedSeconds)} × ${usd(x.hourlyRate ?? 0)}/h`, v: usd(hoursAmount) }]
      : [{ k: `Fixed monthly amount (${formatDuration(x.workedSeconds)} listed)`, v: usd(x.fixedAmount ?? 0) }]
    for (const r of rmb) rows.push({ k: `Reimbursement: ${r.description}`, v: usd(r.amount) })
    const plus = rmb.length ? `, plus ${rmb.length} reimbursement${rmb.length === 1 ? '' : 's'}` : ''
    const what = x.paysAs === 'hourly' ? `${formatDuration(x.workedSeconds)} at ${usd(x.hourlyRate ?? 0)}/h` : `the fixed monthly amount`
    return {
      kind: 'invoice', title: 'Your invoice', lines: rows, sumLabel: 'Total', sum: usd(total),
      note: x.hoursBy && x.hoursBy === x.invoiceBy
        ? `Created when you submit. ${x.hoursBy} approves your hours and this invoice together.`
        : `Created when you submit. ${x.hoursBy ?? 'Your approver'} approves your hours, then ${x.invoiceBy ?? 'the invoice approver'} the invoice.`,
      confirm: `We will also create your invoice for ${x.label}: ${what}${plus}. You can see it after you submit.`,
    }
  }
  const off = x.timeOff.reduce((n, t) => n + t.seconds, 0)
  return {
    kind: 'payroll', title: 'Your payroll summary',
    lines: [{ k: 'Worked', v: formatDuration(x.workedSeconds) }, ...x.timeOff.map(t => ({ k: `PTO: ${t.kind}, ${dayLabel(t.date)}`, v: formatDuration(t.seconds) }))],
    sumLabel: 'Paid hours', sum: formatDuration(x.workedSeconds + off),
    note: x.hoursBy ? 'Sent to Rippling when approved.' : 'Recorded and sent to Rippling. Your timesheet needs no approval.',
    confirm: x.hoursBy
      ? `No invoice for employees. When ${x.hoursBy} approves, your hours and PTO go to Rippling for payroll, by day.`
      : 'No invoice for employees. Your hours and PTO go to Rippling for payroll, by day.',
  }
}
