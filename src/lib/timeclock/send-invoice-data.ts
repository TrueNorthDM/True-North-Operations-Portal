/**
 * What a contractor still has to send an invoice for (leadership, 4 November
 * 2026: they make and send their own invoice; migration 152): each sent
 * timesheet with no invoice yet (or one sent back to them), and for "fixed, no
 * timesheet" the last month and this one. With it, their timesheet's hours by
 * client (the lines the builder opens with, at the rate on file) and their approved
 * reimbursements waiting for an invoice. An invoice sent back to them offers
 * again the reimbursements still on it (audit, 5 November 2026): they can keep
 * them on it when they send it again.
 *
 * Their own money only: call it for the person themselves.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { reimbursementLabel } from './invoice-check-data'
import { hoursByClient } from './invoices-data'
import { loadPayTerms } from './pay-terms'
import { periodLabel } from './periods'
import { isSentInvoice, type PaysAs } from './routing'

import type { SendableReimbursement } from './send-invoice-reimbursements'
export type { SendableReimbursement } from './send-invoice-reimbursements'
export { reimbursementsFor } from './send-invoice-reimbursements'

export interface InvoiceToSend {
  start: string
  end: string
  /** "October 2026", or "Oct 4 to 17, 2026" for a pay period. */
  label: string
  kind: PaysAs
  submissionId: number | null
  /**
   * Sent back to them: its number, the reason, and the reimbursements still on
   * it. Those are offered for this send only, beside the ones waiting for an
   * invoice (SendInvoiceData.reimbursements).
   */
  returned: { number: string; reason: string | null; reimbursements: SendableReimbursement[] } | null
  timesheet: { client: string; seconds: number }[]
}

export interface SendInvoiceData {
  toSend: InvoiceToSend[]
  reimbursements: SendableReimbursement[]
  /** Their own rate an hour and amount a month on file, shown only to them. */
  rate: number | null
  fixedAmount: number | null
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)
/** The first and last day of the month `back` months before `today` (yyyy-mm-dd). */
function monthOf(today: string, back: number): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 - back, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  return { start: ymd(first), end: ymd(last) }
}

const sendable = (r: { id: number; receipt_number: string | null; purpose: string; amount: number }): SendableReimbursement =>
  ({ id: r.id, label: reimbursementLabel(r), purpose: r.purpose, amount: Number(r.amount) })

/** Null for someone who sends no invoice (an employee, or nobody in the Directory). */
export async function loadInvoicesToSend(personId: string, now = new Date(), opts: { hours?: boolean } = {}): Promise<SendInvoiceData | null> {
  const t = (await loadPayTerms([personId])).get(personId)
  if (!t || !t.route.isContractor || !t.paysAs) return null
  const c = createAdminClient()
  const toSend: InvoiceToSend[] = []
  /** The invoice sent back to them behind each period, by its start. */
  const returnedId = new Map<string, number>()

  if (t.paysAs === 'fixed_no_timesheet') {
    // From the 1st: last month's; and this month's, for whoever sends at the end of it.
    const today = ymd(now)
    for (const m of [monthOf(today, 1), monthOf(today, 0)]) {
      const { data: invs, error } = await c.from('invoices').select('id, number, state, paid_note, source').eq('person_id', personId)
        .eq('kind', 'fixed_no_timesheet').eq('period_start', m.start).order('id', { ascending: false })
      if (error) throw new Error(`Invoices could not be read: ${error.message}`)
      // Sent either way (here or with the invoice form): one invoice a month.
      if ((invs ?? []).some(i => isSentInvoice(i.state))) continue
      // Sent back: only the portal's own is sent again here; the form's is sent again with the form.
      const inv = (invs ?? []).find(i => i.source == null && i.state === 'draft')
      if (inv) returnedId.set(m.start, inv.id)
      toSend.push({ ...m, label: periodLabel(m).full, kind: 'fixed_no_timesheet', submissionId: null, returned: inv ? { number: inv.number, reason: inv.paid_note, reimbursements: [] } : null, timesheet: [] })
    }
  } else {
    const { data: subs, error } = await c.from('tc_submissions').select('id, state, tc_periods(start_date, end_date)').eq('person_id', personId)
      .in('state', ['submitted', 'hours_approved', 'approved'])
    if (error) throw new Error(`Timesheets could not be read: ${error.message}`)
    const rows = (subs ?? []) as unknown as { id: number; state: string; tc_periods: { start_date: string; end_date: string } | null }[]
    const ids = rows.map(r => r.id)
    const { data: invs, error: iErr } = ids.length
      ? await c.from('invoices').select('id, submission_id, number, state, paid_note').in('submission_id', ids)
      : { data: [], error: null }
    if (iErr) throw new Error(`Invoices could not be read: ${iErr.message}`)
    const invOf = new Map((invs ?? []).map(i => [i.submission_id, i]))
    for (const r of rows) {
      const p = r.tc_periods
      if (!p) continue
      const inv = invOf.get(r.id)
      // Approved before 4 November with the portal's invoice: nothing to send.
      if (inv && isSentInvoice(inv.state)) continue
      if (r.state === 'approved' && !inv) continue
      const span = { start: p.start_date, end: p.end_date }
      if (inv) returnedId.set(span.start, inv.id)
      toSend.push({
        ...span, label: periodLabel(span).full, kind: t.paysAs, submissionId: r.id,
        returned: inv ? { number: inv.number, reason: inv.paid_note, reimbursements: [] } : null,
        timesheet: opts.hours === false ? [] : await hoursByClient(personId, span.start, span.end, now),
      })
    }
  }

  const { data: rmb, error: rErr } = await c.from('reimbursements').select('id, receipt_number, purpose, amount').eq('person_id', personId)
    .eq('state', 'approved').is('invoice_id', null).order('asked_at')
  if (rErr) throw new Error(`Reimbursements could not be read: ${rErr.message}`)
  // The ones still on an invoice sent back to them: theirs to keep on it when they send it again.
  const backIds = [...new Set(returnedId.values())]
  if (backIds.length) {
    const { data: on, error: oErr } = await c.from('reimbursements').select('id, receipt_number, purpose, amount, invoice_id').eq('person_id', personId)
      .eq('state', 'on_invoice').in('invoice_id', backIds).order('asked_at')
    if (oErr) throw new Error(`Reimbursements could not be read: ${oErr.message}`)
    for (const p of toSend) {
      const invId = returnedId.get(p.start)
      if (p.returned && invId != null) p.returned.reimbursements = (on ?? []).filter(r => r.invoice_id === invId).map(sendable)
    }
  }
  return {
    toSend: toSend.sort((a, b) => a.start.localeCompare(b.start)),
    reimbursements: (rmb ?? []).map(sendable),
    rate: t.hourlyRate,
    fixedAmount: t.fixedAmount,
  }
}
