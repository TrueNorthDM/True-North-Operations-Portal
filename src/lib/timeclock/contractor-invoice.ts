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
import { periodLabel } from './periods'
import { builderProblem, lineAmount, linesAtFileRate, payOnFile, type BuilderLine, type MadeBy, type SentFrom } from './contractor-invoice-rules'
import { placeOf, type PersonAddress } from '@/lib/address'

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

/** Said when the period is already sent (two sends at once: the second one is refused). */
export const ALREADY_SENT = 'Your invoice for this period is already sent and waiting for approval.'
/** Said when a reimbursement they ticked went on another invoice while they were sending. */
export const RMB_TAKEN = 'A reimbursement you chose is already on another invoice. Reload the page and send your invoice again.'

/** One invoice a month across both ways: refused here when the invoice form already has one for a month this period covers. */
export const formMonthTakenText = (monthName: string, number: string, financeEmail: string | null): string =>
  `You already sent an invoice for ${monthName} with the invoice form (${number}). One invoice a month: to change it, write to Finance${financeEmail ? ` at ${financeEmail}` : ''}.`

/** What a send changes on an invoice sent back to them, kept to put back when the send fails half way. */
const BEFORE_COLS = [
  'state', 'total', 'issued_on', 'due_on', 'from_snapshot', 'to_snapshot', 'approved_by', 'approved_at', 'paid_note', 'updated_at',
  'made_by', 'sent_from', 'sent_by', 'sent_at', 'confirmed_text', 'their_number', 'stated_hours', 'stated_total', 'covers', 'own_pdf_path', 'own_pdf_name',
] as const

/**
 * A contractor's invoice sent from the portal: for a sent timesheet (hourly,
 * fixed monthly) or a month with no timesheet. A new invoice, or the same one
 * again after it was sent back (same number, new lines). Returns its id and
 * number. The caller has checked who may send it and the confirmation.
 * Built lines are billed at the rate or amount on file, read here again
 * (owner, 5 November 2026): whatever rate or amount the record carries is
 * replaced, and the total made again from the lines and reimbursements.
 *
 * Safe against two sends at once (audit, 5 November 2026): a sent-back invoice
 * is claimed out of Draft in one step, a reimbursement moves onto it only
 * while it is still approved and on no invoice, and the old lines go only once
 * the new ones are in. When any step fails, what this send did is put back.
 * One invoice a person a month across both ways: refused when the invoice
 * form already has a live one (not sent back) for a month this period covers.
 */
export async function writeSentInvoice(x: {
  personId: string
  submissionId: number | null
  start: string
  end: string
  kind: 'hourly' | 'fixed_monthly' | 'fixed_no_timesheet'
  record: SendRecord
  /** Approved reimbursements they put on it, and (sent again) the ones already on it they keep. */
  reimbursementIds: readonly number[]
  now?: Date
}): Promise<{ id: number; number: string; total: number }> {
  const c = createAdminClient()
  const now = x.now ?? new Date()
  const ids = [...new Set(x.reimbursementIds)]
  // The one already there for this timesheet or month (sent back to them): sent again, same number.
  const q = c.from('invoices').select('*').eq('person_id', x.personId)
  const [settings, personRes, rmbRes, exRes, formRes] = await Promise.all([
    loadInvoiceSettings(),
    c.from('people').select('full_name, address, email_personal, email_true_north, internal_rate, monthly_salary').eq('id', x.personId).maybeSingle(),
    ids.length
      ? c.from('reimbursements').select('id, category, purpose, amount, state, invoice_id, person_id').in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    x.submissionId
      ? q.eq('submission_id', x.submissionId).maybeSingle()
      : q.is('submission_id', null).is('source', null).eq('kind', 'fixed_no_timesheet').eq('period_start', x.start).maybeSingle(),
    // The other way: a live invoice from the invoice form (waiting, approved or paid) for a month this period covers.
    c.from('invoices').select('id, number, period_start, period_end').eq('person_id', x.personId).not('source', 'is', null).neq('state', 'draft')
      .lte('period_start', x.end).gte('period_end', x.start).limit(1),
  ])
  if (personRes.error) throw new Error(`The person could not be read: ${personRes.error.message}`)
  if (rmbRes.error) throw new Error(`Reimbursements could not be read: ${rmbRes.error.message}`)
  if (exRes.error) throw new Error(`The invoice could not be read: ${exRes.error.message}`)
  if (formRes.error) throw new Error(`Invoices could not be read: ${formRes.error.message}`)
  const existing = exRes.data
  if (existing && existing.state !== 'draft') throw new Error(existing.state === 'waiting' ? ALREADY_SENT : 'Your invoice for this period is already approved.')
  const fromForm = (formRes.data ?? [])[0]
  if (fromForm) throw new Error(formMonthTakenText(periodLabel({ start: fromForm.period_start, end: fromForm.period_end }).full, fromForm.number, settings.billingEmail))

  const person = personRes.data
  type R = { id: number; category: string; purpose: string; amount: number; state: string; invoice_id: number | null; person_id: string }
  const rmb = ((rmbRes.data ?? []) as R[])
  // Only their own: approved and on no invoice, or (sent again) already on this one.
  const usable = (r: R) => (r.state === 'approved' && r.invoice_id == null) || (!!existing && r.state === 'on_invoice' && r.invoice_id === existing.id)
  if (rmb.length !== ids.length || rmb.some(r => r.person_id !== x.personId || !usable(r))) throw new Error('A reimbursement on it is not yours to add, is not approved, or is already on another invoice.')

  let record = x.record
  if (record.madeBy === 'builder') {
    const num = (v: unknown) => (v == null || v === '' ? null : Number(v))
    const billed = linesAtFileRate(record.lines, payOnFile(x.kind, num(person?.internal_rate), num(person?.monthly_salary)))
    if ('error' in billed) throw new Error(billed.error)
    const problem = builderProblem(billed.lines)
    if (problem) throw new Error(problem)
    const total = Math.round((billed.lines.reduce((n, l) => n + (lineAmount(l) ?? 0), 0) + rmb.reduce((n, r) => n + Number(r.amount), 0)) * 100) / 100
    record = { ...record, lines: billed.lines, total }
  }

  const issued = now.toISOString().slice(0, 10)
  const builderRows = record.lines.map((l, i) => ({
    kind: l.hours != null ? 'hours' : 'fixed', client: l.client ?? l.description, description: l.description,
    hours_seconds: l.hours != null ? Math.round(l.hours * 3600) : null, rate: l.rate, amount: lineAmount(l) ?? 0, reimbursement_id: null as number | null, sort: i,
  }))
  const rmbRows = rmb.map((r, i) => ({
    kind: 'reimbursement', client: null as string | null, description: `Reimbursement: ${r.category}, ${r.purpose}`,
    hours_seconds: null as number | null, rate: null as number | null, amount: Number(r.amount), reimbursement_id: r.id as number | null, sort: 1000 + i,
  }))
  const fields = {
    person_id: x.personId, submission_id: x.submissionId, period_start: x.start, period_end: x.end, kind: x.kind,
    state: 'waiting', issued_on: issued, due_on: dueOn(issued, settings.paymentDays), total: record.total,
    from_snapshot: { name: person?.full_name ?? '', location: placeOf(person?.address as PersonAddress | null | undefined) ?? '', email: person?.email_personal ?? person?.email_true_north ?? '' },
    to_snapshot: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '', email: settings.billingEmail ?? '' },
    approved_by: null, approved_at: null, paid_note: null, updated_at: now.toISOString(),
    ...sendFields(record, now),
  }

  let id: number, number: string
  let oldLines: number[] = []
  if (existing) {
    // Claimed in one step: of two sends at once, only one moves it out of Draft; the other is refused.
    const { data: claimed, error } = await c.from('invoices').update(fields).eq('id', existing.id).eq('state', 'draft').select('id')
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    if (!claimed?.length) throw new Error(ALREADY_SENT)
    id = existing.id; number = existing.number
  } else {
    const { data: n, error: nErr } = await c.rpc('next_document_number', { p_kind: 'invoice' })
    if (nErr || !n) throw new Error(`No invoice number: ${nErr?.message ?? 'none'}`)
    const { data: made, error } = await c.from('invoices').insert({ ...fields, number: n as string }).select('id, number').single()
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    id = made.id; number = made.number
  }

  const before = existing ? Object.fromEntries(BEFORE_COLS.map(k => [k, existing[k]])) as Pick<typeof existing, (typeof BEFORE_COLS)[number]> : null
  const added: number[] = [], moved: number[] = [], freed: number[] = []
  // Put back what this send did: never an invoice waiting with half its lines, never a reimbursement on two invoices.
  const undo = async () => {
    const fails: string[] = []
    const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) fails.push(error.message) }
    if (moved.length) await run(c.from('reimbursements').update({ state: 'approved', invoice_id: null }).in('id', moved).eq('invoice_id', id))
    if (freed.length) await run(c.from('reimbursements').update({ state: 'on_invoice', invoice_id: id }).in('id', freed).eq('state', 'approved').is('invoice_id', null))
    if (added.length) await run(c.from('invoice_lines').delete().in('id', added))
    // Sent back before: as it was, with its reason. New: back to the contractor (Draft, keeping its number) to send again.
    await run(c.from('invoices').update(before ?? { state: 'draft', updated_at: now.toISOString() }).eq('id', id))
    if (fails.length) console.error('[invoice send] not all put back:', fails.join('; '))
  }

  try {
    if (existing) {
      const { data: ol, error } = await c.from('invoice_lines').select('id').eq('invoice_id', id)
      if (error) throw new Error(`The invoice was not saved: ${error.message}`)
      oldLines = (ol ?? []).map(l => l.id as number)
    }
    const all = [...builderRows, ...rmbRows].map(l => ({ ...l, invoice_id: id }))
    if (all.length) {
      const { data: ls, error } = await c.from('invoice_lines').insert(all).select('id')
      if (error) throw new Error(`The invoice lines were not saved: ${error.message}`)
      added.push(...(ls ?? []).map(l => l.id as number))
    }
    if (existing) {
      // Sent again: the reimbursements on it they did not keep go back to waiting for an invoice.
      const keep = rmb.filter(r => r.invoice_id === id).map(r => r.id)
      const { data: onIt, error } = await c.from('reimbursements').select('id').eq('invoice_id', id).eq('state', 'on_invoice')
      if (error) throw new Error(`Reimbursements could not be read: ${error.message}`)
      const drop = (onIt ?? []).map(r => r.id as number).filter(rid => !keep.includes(rid))
      if (drop.length) {
        const { data: off, error: oErr } = await c.from('reimbursements').update({ state: 'approved', invoice_id: null }).in('id', drop).eq('invoice_id', id).select('id')
        if (oErr) throw new Error(`The reimbursements were not saved: ${oErr.message}`)
        freed.push(...(off ?? []).map(r => r.id as number))
      }
    }
    // Onto this invoice only while still approved and on no invoice: one reimbursement is never on two invoices.
    const attach = rmb.filter(r => r.invoice_id !== id).map(r => r.id)
    if (attach.length) {
      const { data: on, error } = await c.from('reimbursements').update({ state: 'on_invoice', invoice_id: id })
        .in('id', attach).eq('state', 'approved').is('invoice_id', null).select('id')
      if (error) throw new Error(`The reimbursements were not saved: ${error.message}`)
      moved.push(...(on ?? []).map(r => r.id as number))
      if (moved.length < attach.length) throw new Error(RMB_TAKEN)
    }
    // The lines of the version before go once the new ones are in: the version itself stays in invoice_sends.
    if (oldLines.length) {
      const { error } = await c.from('invoice_lines').delete().in('id', oldLines)
      if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    }
  } catch (e) {
    await undo()
    throw e
  }
  await recordSend(id, record, now)
  return { id, number, total: record.total }
}
