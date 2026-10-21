/**
 * Invoices on the server (Clocky part 2): the hours a period holds by client,
 * and the invoice a contractor's submitted timesheet makes. Made when they
 * submit, remade when they submit again after a return (same number, new
 * lines), frozen once approved. Fixed, no timesheet invoices are made on day 1
 * by the cron (invoices-cron.ts).
 *
 * Not a "use server" file: the actions decide who may cause it.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { allRows, loadCatalog } from './clocky-context'
import { entrySeconds } from './clocky-panel'
import type { EntryRow } from './clocky-store'
import { buildInvoiceLines, dueOn, type ReimbursementForInvoice } from './invoice-lines'
import { loadInvoiceSettings, loadPayTerms } from './pay-terms'
import { periodLabel } from './periods'
import type { PaysAs } from './routing'

/** The client a job bills: its top folder ("2 - i7 Marketing"), or the job itself at the top. */
export const clientFolder = (path: string): string => (path ? path.split(' › ')[0] : 'Other')

/** Worked hours in a period by client, biggest first (time off left out). */
export async function hoursByClient(personId: string, start: string, end: string, now = new Date()): Promise<{ client: string; seconds: number }[]> {
  const [catalog, rows] = await Promise.all([
    loadCatalog(),
    allRows<Pick<EntryRow, 'jobcode_id' | 'started_at' | 'ended_at' | 'duration_seconds' | 'kind'>>((a, b) =>
      createAdminClient().from('tc_entries').select('jobcode_id, started_at, ended_at, duration_seconds, kind').eq('person_id', personId)
        .gte('entry_date', start).lte('entry_date', end).neq('kind', 'absence').order('id').range(a, b), 'Hours could not be read'),
  ])
  const by = new Map<string, number>()
  for (const r of rows) {
    const c = clientFolder(catalog.jobs.get(r.jobcode_id ?? -1)?.path ?? '')
    by.set(c, (by.get(c) ?? 0) + entrySeconds(r, now))
  }
  return [...by.entries()].map(([client, seconds]) => ({ client, seconds })).sort((a, b) => b.seconds - a.seconds)
}

/** The approved reimbursements waiting for this person's next invoice (Requests). */
async function reimbursementsFor(personId: string): Promise<ReimbursementForInvoice[]> {
  const { data, error } = await createAdminClient().from('reimbursements').select('id, category, purpose, amount').eq('person_id', personId).eq('state', 'approved').is('invoice_id', null).order('asked_at')
  if (error) throw new Error(`Reimbursements could not be read: ${error.message}`)
  return (data ?? []).map(r => ({ id: r.id, category: r.category, purpose: r.purpose, amount: Number(r.amount) }))
}

/** Whether an invoice can be made for this person now: the reason it cannot, in their words. */
export async function invoiceBlocker(personId: string): Promise<string | null> {
  const t = (await loadPayTerms([personId])).get(personId)
  if (!t || !t.route.isContractor) return null
  if (t.paysAs === 'hourly' && !(t.hourlyRate && t.hourlyRate > 0)) return 'Your invoice cannot be made yet: there is no rate an hour for you in Rates & Costs. Ask a Super Admin to add it, then submit.'
  if (t.paysAs !== 'hourly' && !(t.fixedAmount && t.fixedAmount > 0)) return 'Your invoice cannot be made yet: there is no amount a month for you in Rates & Costs. Ask a Super Admin to add it, then submit.'
  return null
}

/**
 * Makes (or remakes) the invoice of a contractor's submitted timesheet.
 * Returns its id, or null for someone who gets no invoice from a timesheet
 * (employees, fixed with no timesheet).
 */
export async function makeInvoiceForSubmission(submissionId: number, now = new Date()): Promise<number | null> {
  const c = createAdminClient()
  const { data: sub, error } = await c.from('tc_submissions').select('id, person_id, tc_periods(start_date, end_date)').eq('id', submissionId).maybeSingle()
  if (error || !sub) throw new Error(`The timesheet could not be read${error ? `: ${error.message}` : ''}.`)
  const period = sub.tc_periods as unknown as { start_date: string; end_date: string } | null
  if (!period) throw new Error('The timesheet has no period.')
  const t = (await loadPayTerms([sub.person_id])).get(sub.person_id)
  if (!t || !t.route.isContractor || !t.paysAs || t.paysAs === 'fixed_no_timesheet') return null
  return writeInvoice({ personId: sub.person_id, submissionId, start: period.start_date, end: period.end_date, paysAs: t.paysAs, hourlyRate: t.hourlyRate, fixedAmount: t.fixedAmount, now })
}

/** Writes an invoice and its lines: a new one, or the same one again (draft) with new lines. */
export async function writeInvoice(x: { personId: string; submissionId: number | null; start: string; end: string; paysAs: PaysAs; hourlyRate: number | null; fixedAmount: number | null; now?: Date }): Promise<number> {
  const c = createAdminClient()
  const now = x.now ?? new Date()
  const [settings, byClient, reimbursements, { data: person }] = await Promise.all([
    loadInvoiceSettings(),
    x.paysAs === 'fixed_no_timesheet' ? Promise.resolve([]) : hoursByClient(x.personId, x.start, x.end, now),
    reimbursementsFor(x.personId),
    c.from('people').select('full_name, location, email_personal, email_true_north').eq('id', x.personId).maybeSingle(),
  ])
  const periodName = periodLabel({ start: x.start, end: x.end }).full
  const { lines, total } = buildInvoiceLines({ paysAs: x.paysAs, periodName, hourlyRate: x.hourlyRate, fixedAmount: x.fixedAmount, byClient, reimbursements })
  const issued = now.toISOString().slice(0, 10)
  const fields = {
    person_id: x.personId, submission_id: x.submissionId, period_start: x.start, period_end: x.end, kind: x.paysAs,
    state: 'waiting', issued_on: issued, due_on: dueOn(issued, settings.paymentDays), total,
    from_snapshot: { name: person?.full_name ?? '', location: person?.location ?? '', email: person?.email_personal ?? person?.email_true_north ?? '' },
    to_snapshot: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '', email: settings.billingEmail ?? '' },
    approved_by: null, approved_at: null, updated_at: now.toISOString(),
  }

  // The same invoice again after a return (it went back to Draft): same number, new lines.
  const { data: existing } = x.submissionId
    ? await c.from('invoices').select('id, state').eq('submission_id', x.submissionId).maybeSingle()
    : { data: null }
  let id: number
  if (existing) {
    if (existing.state === 'approved' || existing.state === 'paid') throw new Error('That invoice is already approved.')
    const { error } = await c.from('invoices').update(fields).eq('id', existing.id)
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    await c.from('invoice_lines').delete().eq('invoice_id', existing.id)
    id = existing.id
  } else {
    const { data: number, error: nErr } = await c.rpc('next_document_number', { p_kind: 'invoice' })
    if (nErr || !number) throw new Error(`No invoice number: ${nErr?.message ?? 'none'}`)
    const { data: made, error } = await c.from('invoices').insert({ ...fields, number: number as string }).select('id').single()
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    id = made.id
  }
  const { error: lErr } = await c.from('invoice_lines').insert(lines.map(l => ({
    invoice_id: id, kind: l.kind, client: l.client, description: l.description, hours_seconds: l.hoursSeconds, rate: l.rate, amount: l.amount, reimbursement_id: l.reimbursementId, sort: l.sort,
  })))
  if (lErr) throw new Error(`The invoice lines were not saved: ${lErr.message}`)
  // The reimbursements on it leave the queue for the next one.
  const rIds = lines.filter(l => l.reimbursementId).map(l => l.reimbursementId!)
  if (rIds.length) await c.from('reimbursements').update({ state: 'on_invoice', invoice_id: id }).in('id', rIds)
  return id
}
