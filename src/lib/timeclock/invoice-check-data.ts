/**
 * An invoice beside its timesheet, read for the approver, the invoice's page
 * and the record page of its PDF (leadership, 4 November 2026; migration 152).
 * Money: call it only for someone who sees this person's pay (seesMoney), or
 * from the server's own jobs.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { compareInvoice, invoiceDetails, type CompareInput, type Comparison, type InvoiceDetails, type MadeBy } from './contractor-invoice'
import { hoursByClient } from './invoices-data'
import { loadPayTerms } from './pay-terms'

/** How a reimbursement is named on the check: its receipt number, else its purpose. */
export const reimbursementLabel = (r: { receipt_number: string | null; id: number; purpose: string }): string =>
  r.receipt_number ?? `#${r.id} ${r.purpose}`

/**
 * Whether an approved reimbursement not on any invoice was there to include
 * when the invoice was sent (sent_at, else created_at): approved at or before
 * it. With no decision time it is not counted.
 */
export function availableWhenSent(decidedAt: string | null, sentAt: string | null): boolean {
  if (!decidedAt) return false
  if (!sentAt) return true
  return Date.parse(decidedAt) <= Date.parse(sentAt)
}

export interface InvoiceCheck extends Comparison {
  madeBy: MadeBy | null
  /** What the contractor sent, with the check beside each part ("Invoice details submitted"). */
  details?: InvoiceDetails
}

/** The comparison for one invoice; null when it has no person or cannot be read. */
export async function loadInvoiceCheck(invoiceId: number, now = new Date()): Promise<InvoiceCheck | null> {
  const c = createAdminClient()
  const { data: inv, error } = await c.from('invoices')
    .select('id, person_id, submission_id, period_start, period_end, kind, made_by, stated_hours, stated_total, their_number, covers, confirmed_text, total, sent_at, created_at')
    .eq('id', invoiceId).maybeSingle()
  if (error || !inv) return null
  const [terms, timesheet, linesRes, rmbRes] = await Promise.all([
    loadPayTerms([inv.person_id]),
    inv.submission_id && inv.kind !== 'fixed_no_timesheet' ? hoursByClient(inv.person_id, inv.period_start, inv.period_end, now) : Promise.resolve([]),
    c.from('invoice_lines').select('kind, client, description, hours_seconds, rate, amount, reimbursement_id, sort').eq('invoice_id', invoiceId).order('sort'),
    // What should be on it: the ones on this one, and their approved reimbursements still waiting for an
    // invoice (not on a reimbursement document). Which of those were there when it was sent is decided below.
    c.from('reimbursements').select('id, receipt_number, purpose, amount, state, invoice_id, decided_at').eq('person_id', inv.person_id)
      .or(`invoice_id.eq.${invoiceId},and(state.eq.approved,invoice_id.is.null,document_id.is.null)`),
  ])
  if (linesRes.error || rmbRes.error) return null
  const t = terms.get(inv.person_id)
  const lines = linesRes.data ?? []
  const byClient = new Map<string, number>()
  for (const l of lines) if (l.kind === 'hours' && l.client && l.hours_seconds) byClient.set(l.client, (byClient.get(l.client) ?? 0) + l.hours_seconds)
  // A reimbursement approved after the invoice was sent waits for the next one: it was never missing here.
  const sentAt = inv.sent_at ?? inv.created_at
  const rmb = (rmbRes.data ?? []).filter(r => r.invoice_id === invoiceId || availableWhenSent(r.decided_at, sentAt))
  const onIt = new Set(lines.filter(l => l.reimbursement_id).map(l => l.reimbursement_id))
  const builderHours = lines.filter(l => l.kind === 'hours').reduce((n, l) => n + (l.hours_seconds ?? 0), 0) / 3600
  const madeBy = (inv.made_by ?? null) as MadeBy | null
  const input: CompareInput = {
    timesheet,
    pay: inv.kind === 'hourly' ? { kind: 'hourly', rate: t?.hourlyRate ?? null } : { kind: 'fixed', amount: t?.fixedAmount ?? null },
    reimbursements: rmb.map(r => ({ label: reimbursementLabel(r), amount: Number(r.amount) })),
    invoice: {
      madeBy,
      byClient: [...byClient].map(([client, seconds]) => ({ client, seconds })),
      hours: madeBy === 'own_file' ? (inv.stated_hours == null ? null : Number(inv.stated_hours)) : builderHours,
      total: Number(inv.total),
      reimbursements: rmb.filter(r => onIt.has(r.id)).map(reimbursementLabel),
    },
  }
  const cmp = compareInvoice(input)
  const details = invoiceDetails({
    ...input,
    lines: lines.map(l => ({ kind: l.kind, client: l.client, description: l.description, hoursSeconds: l.hours_seconds, rate: l.rate == null ? null : Number(l.rate), amount: Number(l.amount) })),
    stated: { theirNumber: inv.their_number, hours: inv.stated_hours == null ? null : Number(inv.stated_hours), total: inv.stated_total == null ? null : Number(inv.stated_total), covers: inv.covers },
    confirmed: inv.confirmed_text,
  }, cmp)
  return { ...cmp, madeBy, details }
}

export interface InvoiceSendRow {
  at: string
  madeBy: MadeBy
  sentFrom: 'portal' | 'form'
  sentBy: string | null
  sentEmail: string | null
  confirmed: string
  theirNumber: string | null
  statedHours: number | null
  statedTotal: number | null
  covers: string | null
  ownPdfName: string | null
  total: number | null
}

/** Every version the contractor sent, oldest first. Empty before migration 152 or for an invoice the portal made. */
export async function loadInvoiceSends(invoiceId: number): Promise<InvoiceSendRow[]> {
  const { data, error } = await createAdminClient().from('invoice_sends').select('*').eq('invoice_id', invoiceId).order('sent_at')
  if (error) return []
  return (data ?? []).map(s => ({
    at: s.sent_at, madeBy: s.made_by as MadeBy, sentFrom: s.sent_from as 'portal' | 'form', sentBy: s.sent_by, sentEmail: s.sent_email,
    confirmed: s.confirmed_text, theirNumber: s.their_number, statedHours: s.stated_hours == null ? null : Number(s.stated_hours),
    statedTotal: s.stated_total == null ? null : Number(s.stated_total), covers: s.covers, ownPdfName: s.own_pdf_name, total: s.total == null ? null : Number(s.total),
  }))
}
