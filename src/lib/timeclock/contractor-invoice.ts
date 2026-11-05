/**
 * Writing a contractor's own invoice (leadership, 4 November 2026; migration
 * 152): a send kept among the invoice's versions, and the invoice a contractor
 * sends from the portal. The rules they follow (the confirmation, the
 * builder's lines, the check against the timesheet) are pure and live in
 * contractor-invoice-rules.ts, which the browser can load; they are re-exported
 * here for the server's callers.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { dueOn } from './invoice-lines'
import { loadInvoiceSettings } from './pay-terms'
import { lineAmount, type BuilderLine, type MadeBy, type SentFrom } from './contractor-invoice-rules'

export * from './contractor-invoice-rules'

// ── Writing a send ──────────────────────────────────────────────────────────

export interface SendRecord {
  madeBy: MadeBy
  sentFrom: SentFrom
  sentBy: string | null
  sentEmail: string | null
  confirmed: string
  theirNumber: string | null
  statedHours: number | null
  statedTotal: number | null
  covers: string | null
  ownPdf: { path: string; name: string } | null
  /** The builder's lines as written ([] for an own file). */
  lines: readonly BuilderLine[]
  total: number
}

/** The invoice row's fields for the latest send. */
export function sendFields(r: SendRecord, now: Date) {
  return {
    made_by: r.madeBy, sent_from: r.sentFrom, sent_by: r.sentBy, sent_at: now.toISOString(), confirmed_text: r.confirmed,
    their_number: r.theirNumber, stated_hours: r.statedHours, stated_total: r.statedTotal, covers: r.covers,
    own_pdf_path: r.ownPdf?.path ?? null, own_pdf_name: r.ownPdf?.name ?? null,
  }
}

/** Keeps this send among the invoice's versions. A failure here is logged, never undoes the send. */
export async function recordSend(invoiceId: number, r: SendRecord, now: Date): Promise<void> {
  const { error } = await createAdminClient().from('invoice_sends').insert({
    invoice_id: invoiceId, made_by: r.madeBy, sent_from: r.sentFrom, sent_by: r.sentBy, sent_email: r.sentEmail, sent_at: now.toISOString(),
    confirmed_text: r.confirmed, their_number: r.theirNumber, stated_hours: r.statedHours, stated_total: r.statedTotal, covers: r.covers,
    own_pdf_path: r.ownPdf?.path ?? null, own_pdf_name: r.ownPdf?.name ?? null,
    lines: r.lines.map(l => ({ description: l.description, client: l.client, hours: l.hours, rate: l.rate, amount: lineAmount(l) })),
    total: r.total,
  })
  if (error) console.error('[invoice send] version not kept:', error.message)
}

/**
 * A contractor's invoice sent from the portal: for a sent timesheet (hourly,
 * fixed monthly) or a month with no timesheet. A new invoice, or the same one
 * again after it was sent back (same number, new lines). Returns its id and
 * number. The caller has checked who may send it and the confirmation.
 */
export async function writeSentInvoice(x: {
  personId: string
  submissionId: number | null
  start: string
  end: string
  kind: 'hourly' | 'fixed_monthly' | 'fixed_no_timesheet'
  record: SendRecord
  /** Approved reimbursements they put on it. */
  reimbursementIds: readonly number[]
  now?: Date
}): Promise<{ id: number; number: string }> {
  const c = createAdminClient()
  const now = x.now ?? new Date()
  const [settings, personRes, rmbRes] = await Promise.all([
    loadInvoiceSettings(),
    c.from('people').select('full_name, location, email_personal, email_true_north').eq('id', x.personId).maybeSingle(),
    x.reimbursementIds.length
      ? c.from('reimbursements').select('id, category, purpose, amount, state, invoice_id, person_id').in('id', [...x.reimbursementIds])
      : Promise.resolve({ data: [], error: null }),
  ])
  if (personRes.error) throw new Error(`The person could not be read: ${personRes.error.message}`)
  if (rmbRes.error) throw new Error(`Reimbursements could not be read: ${rmbRes.error.message}`)
  const person = personRes.data
  type R = { id: number; category: string; purpose: string; amount: number; state: string; invoice_id: number | null; person_id: string }
  const rmb = ((rmbRes.data ?? []) as R[])
  // Only their own, approved, not on another invoice.
  if (rmb.some(r => r.person_id !== x.personId || r.state !== 'approved')) throw new Error('A reimbursement on it is not yours to add, or is not approved.')

  const issued = now.toISOString().slice(0, 10)
  const builderRows = x.record.lines.map((l, i) => ({
    kind: l.hours != null ? 'hours' : 'fixed', client: l.client ?? l.description, description: l.description,
    hours_seconds: l.hours != null ? Math.round(l.hours * 3600) : null, rate: l.rate, amount: lineAmount(l) ?? 0, reimbursement_id: null as number | null, sort: i,
  }))
  const rmbRows = rmb.map((r, i) => ({
    kind: 'reimbursement', client: null as string | null, description: `Reimbursement: ${r.category}, ${r.purpose}`,
    hours_seconds: null as number | null, rate: null as number | null, amount: Number(r.amount), reimbursement_id: r.id as number | null, sort: 1000 + i,
  }))
  const fields = {
    person_id: x.personId, submission_id: x.submissionId, period_start: x.start, period_end: x.end, kind: x.kind,
    state: 'waiting', issued_on: issued, due_on: dueOn(issued, settings.paymentDays), total: x.record.total,
    from_snapshot: { name: person?.full_name ?? '', location: person?.location ?? '', email: person?.email_personal ?? person?.email_true_north ?? '' },
    to_snapshot: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '', email: settings.billingEmail ?? '' },
    approved_by: null, approved_at: null, paid_note: null, updated_at: now.toISOString(),
    ...sendFields(x.record, now),
  }

  // The one already there for this timesheet or month (sent back to them): sent again, same number.
  const q = c.from('invoices').select('id, number, state').eq('person_id', x.personId)
  const { data: existing, error: exErr } = x.submissionId
    ? await q.eq('submission_id', x.submissionId).maybeSingle()
    : await q.is('submission_id', null).is('source', null).eq('kind', 'fixed_no_timesheet').eq('period_start', x.start).maybeSingle()
  if (exErr) throw new Error(`The invoice could not be read: ${exErr.message}`)
  if (existing && existing.state !== 'draft') throw new Error(existing.state === 'waiting' ? 'Your invoice for this period is already sent and waiting for approval.' : 'Your invoice for this period is already approved.')

  let id: number, number: string
  if (existing) {
    const { error } = await c.from('invoices').update(fields).eq('id', existing.id)
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    // The lines of the version before go: the version itself stays in invoice_sends.
    await c.from('reimbursements').update({ state: 'approved', invoice_id: null }).eq('invoice_id', existing.id)
    const { error: dErr } = await c.from('invoice_lines').delete().eq('invoice_id', existing.id)
    if (dErr) throw new Error(`The invoice was not saved: ${dErr.message}`)
    id = existing.id; number = existing.number
  } else {
    const { data: n, error: nErr } = await c.rpc('next_document_number', { p_kind: 'invoice' })
    if (nErr || !n) throw new Error(`No invoice number: ${nErr?.message ?? 'none'}`)
    const { data: made, error } = await c.from('invoices').insert({ ...fields, number: n as string }).select('id, number').single()
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    id = made.id; number = made.number
  }
  const all = [...builderRows, ...rmbRows].map(l => ({ ...l, invoice_id: id }))
  if (all.length) {
    const { error: lErr } = await c.from('invoice_lines').insert(all)
    if (lErr) {
      // Never an invoice waiting with no lines: back to the contractor to send again.
      await c.from('invoices').update({ state: 'draft', updated_at: now.toISOString() }).eq('id', id)
      throw new Error(`The invoice lines were not saved: ${lErr.message}`)
    }
  }
  if (rmb.length) {
    const { error: rErr } = await c.from('reimbursements').update({ state: 'on_invoice', invoice_id: id }).in('id', rmb.map(r => r.id))
    if (rErr) console.error('[invoice send] reimbursements not marked:', rErr.message)
  }
  await recordSend(id, x.record, now)
  return { id, number }
}
