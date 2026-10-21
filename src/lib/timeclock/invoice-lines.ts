/**
 * An invoice's lines (Clocky part 2, README_PART2 "Timesheet and invoice"),
 * pure: the caller brings the hours by client, the rate or fixed amount and
 * the approved reimbursements; this makes the frozen lines and the total.
 *
 *   Hourly            one line per client: "<client>, October 2026", hours x rate
 *   Fixed monthly     one line: "Fixed monthly amount, October 2026", the hours
 *                     listed for the record, rate "Fixed"
 *   Fixed, no timesheet   the same fixed line, no hours
 *   Reimbursements    one line each, after the hours
 *
 * Money in cents, so totals never drift.
 */

import type { PaysAs } from './routing'

export interface InvoiceLineInput {
  kind: 'hours' | 'fixed' | 'reimbursement'
  client: string | null
  description: string
  hoursSeconds: number | null
  rate: number | null
  amount: number
  reimbursementId: number | null
  sort: number
}

export interface ReimbursementForInvoice { id: number; category: string; purpose: string; amount: number }

const cents = (n: number) => Math.round(n * 100)
const money = (c: number) => c / 100

export function buildInvoiceLines(input: {
  paysAs: PaysAs
  /** "October 2026", the period as the invoice names it. */
  periodName: string
  hourlyRate: number | null
  fixedAmount: number | null
  /** Worked hours by client, biggest first is how they read. */
  byClient: readonly { client: string; seconds: number }[]
  reimbursements?: readonly ReimbursementForInvoice[]
}): { lines: InvoiceLineInput[]; total: number } {
  const lines: InvoiceLineInput[] = []
  if (input.paysAs === 'hourly') {
    if (input.hourlyRate == null || input.hourlyRate <= 0) throw new Error('No rate an hour in Rates & Costs.')
    for (const c of input.byClient) {
      if (c.seconds <= 0) continue
      lines.push({
        kind: 'hours', client: c.client, description: `${c.client}, ${input.periodName}`, hoursSeconds: c.seconds,
        rate: input.hourlyRate, amount: money(cents((c.seconds / 3600) * input.hourlyRate)), reimbursementId: null, sort: lines.length,
      })
    }
  } else {
    if (input.fixedAmount == null || input.fixedAmount <= 0) throw new Error('No amount a month in Rates & Costs.')
    const seconds = input.byClient.reduce((s, c) => s + c.seconds, 0)
    lines.push({
      kind: 'fixed', client: null, description: `Fixed monthly amount, ${input.periodName}`,
      hoursSeconds: input.paysAs === 'fixed_no_timesheet' ? null : seconds, rate: null, amount: input.fixedAmount, reimbursementId: null, sort: 0,
    })
  }
  for (const r of input.reimbursements ?? []) {
    lines.push({ kind: 'reimbursement', client: r.category, description: r.purpose, hoursSeconds: null, rate: null, amount: r.amount, reimbursementId: r.id, sort: lines.length })
  }
  return { lines, total: money(lines.reduce((s, l) => s + cents(l.amount), 0)) }
}

/** The day an invoice is due: issued plus the payment days. */
export function dueOn(issuedOn: string, paymentDays: number): string {
  const d = new Date(`${issuedOn}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + paymentDays)
  return d.toISOString().slice(0, 10)
}
