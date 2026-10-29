/**
 * Invoices on the server (Clocky part 2): the hours a period holds by client,
 * and the invoice a contractor's submitted timesheet makes. Made when they
 * submit, remade when they submit again after a return (same number, new
 * lines), frozen once approved. Fixed, no timesheet invoices are made on day 1
 * by the cron (invoices-cron.ts).
 *
 * Not a "use server" file: the actions decide who may cause it.
 */

import type { Access } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { allRows, entryClient2026, loadCatalog } from './clocky-context'
import { entrySeconds } from './clocky-panel'
import type { EntryRow } from './clocky-store'
import { buildInvoiceLines, dueOn, missingRate, type ReimbursementForInvoice } from './invoice-lines'
import { loadInvoiceSettings, loadPayTerms, paysWhat } from './pay-terms'
import { periodLabel } from './periods'
import type { PaysAs } from './routing'

/** The client a job bills: its top folder ("2 - i7 Marketing"), or the job itself at the top. */
export const clientFolder = (path: string): string => (path ? path.split(' › ')[0] : 'Other')

/** Worked hours in a period by client, biggest first (time off left out): the 2026 client where the job has one. */
export async function hoursByClient(personId: string, start: string, end: string, now = new Date()): Promise<{ client: string; seconds: number }[]> {
  const [catalog, rows] = await Promise.all([
    loadCatalog(),
    allRows<Pick<EntryRow, 'jobcode_id' | 'started_at' | 'ended_at' | 'duration_seconds' | 'kind' | 'fields'>>((a, b) =>
      createAdminClient().from('tc_entries').select('jobcode_id, started_at, ended_at, duration_seconds, kind, fields').eq('person_id', personId)
        .gte('entry_date', start).lte('entry_date', end).neq('kind', 'absence').order('id').range(a, b), 'Hours could not be read'),
  ])
  const by = new Map<string, number>()
  for (const r of rows) {
    const j = catalog.jobs.get(r.jobcode_id ?? -1)
    const c = entryClient2026(j, r.fields as Record<string, string> | null, catalog.keys) ?? clientFolder(j?.path ?? '')
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
  const missing = t ? missingRate({ ...t, isContractor: t.route.isContractor }) : null
  if (missing === 'hourly') return 'Your invoice cannot be made yet: there is no rate an hour for you in Rates & Costs. Ask a Super Admin to add it, then submit.'
  if (missing === 'fixed') return 'Your invoice cannot be made yet: there is no amount a month for you in Rates & Costs. Ask a Super Admin to add it, then submit.'
  return null
}

/**
 * The rail's "Contractors with no rate" on Rates & Costs (owner, 25 October
 * 2026): contractors still in the company (active, as Rates & Costs lists
 * them) for whom invoiceBlocker would refuse an invoice today. Money-free as a
 * number, but read from pay: call it only for d-rates.
 */
export async function countMissingRates(): Promise<number> {
  const { data, error } = await createAdminClient().from('people').select('id').eq('status', 'active').eq('employment_type', 'contractor')
  if (error) throw new Error(`People could not be read: ${error.message}`)
  const ids = (data ?? []).map(p => p.id as string)
  if (!ids.length) return 0
  const terms = await loadPayTerms(ids)
  return [...terms.values()].filter(t => missingRate({ ...t, isContractor: t.route.isContractor })).length
}

/**
 * The rail's "To pay" on Invoices (owner, 25 October 2026): for Super Admins,
 * Admins and Finance, the approved invoices not paid yet and the
 * reimbursement documents waiting, under the same rule as Home's lines
 * (paysWhat). 0 for anyone else, read or not.
 */
export async function countToPay(access: Pick<Access, 'personId' | 'can' | 'isAdmin'>): Promise<number> {
  const pays = paysWhat(access, await loadInvoiceSettings())
  if (!pays.invoices && !pays.documents) return 0
  const c = createAdminClient()
  const count = async (table: 'invoices' | 'reimbursement_documents', on: boolean) => {
    if (!on) return 0
    const { count: n, error } = await c.from(table).select('id', { count: 'exact', head: true }).eq('state', 'approved')
    if (error) throw new Error(`${table === 'invoices' ? 'Invoices' : 'Reimbursement documents'} could not be counted: ${error.message}`)
    return n ?? 0
  }
  const [invoices, documents] = await Promise.all([count('invoices', pays.invoices), count('reimbursement_documents', pays.documents)])
  return invoices + documents
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
  const [settings, byClient, reimbursements, personRes] = await Promise.all([
    loadInvoiceSettings(),
    x.paysAs === 'fixed_no_timesheet' ? Promise.resolve([]) : hoursByClient(x.personId, x.start, x.end, now),
    reimbursementsFor(x.personId),
    c.from('people').select('full_name, location, email_personal, email_true_north').eq('id', x.personId).maybeSingle(),
  ])
  // The invoice keeps who it is from: an unread name would be saved blank on it.
  if (personRes.error) throw new Error(`The person could not be read: ${personRes.error.message}`)
  const person = personRes.data
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
  const lineRows = (id: number) => lines.map(l => ({
    invoice_id: id, kind: l.kind, client: l.client, description: l.description, hours_seconds: l.hoursSeconds, rate: l.rate, amount: l.amount, reimbursement_id: l.reimbursementId, sort: l.sort,
  }))
  const rIds = lines.filter(l => l.reimbursementId).map(l => l.reimbursementId!)

  // The same invoice again after a return (it went back to Draft): same number, new lines.
  // An unread one would be made again as a second invoice for the same timesheet.
  const { data: existing, error: exErr } = x.submissionId
    ? await c.from('invoices').select('id, state, total, issued_on, due_on').eq('submission_id', x.submissionId).maybeSingle()
    : { data: null, error: null }
  if (exErr) throw new Error(`The invoice could not be read: ${exErr.message}`)

  if (existing) {
    if (existing.state === 'approved' || existing.state === 'paid') throw new Error('That invoice is already approved.')
    // The new lines go in before the old ones go, so a failure leaves the Draft as it was, never empty.
    const { data: old, error: oErr } = await c.from('invoice_lines').select('id').eq('invoice_id', existing.id)
    if (oErr) throw new Error(`The invoice lines could not be read: ${oErr.message}`)
    const { data: added, error: lErr } = await c.from('invoice_lines').insert(lineRows(existing.id)).select('id')
    if (lErr) throw new Error(`The invoice lines were not saved: ${lErr.message}`)
    const undoLines = async () => { if (added?.length) await c.from('invoice_lines').delete().in('id', added.map(l => l.id)) }
    const { error } = await c.from('invoices').update(fields).eq('id', existing.id)
    if (error) { await undoLines(); throw new Error(`The invoice was not saved: ${error.message}`) }
    const oldIds = (old ?? []).map(l => l.id)
    const { error: dErr } = oldIds.length ? await c.from('invoice_lines').delete().in('id', oldIds) : { error: null }
    const { error: rErr } = dErr || !rIds.length ? { error: null } : await c.from('reimbursements').update({ state: 'on_invoice', invoice_id: existing.id }).in('id', rIds)
    if (dErr || rErr) {
      // Back to the Draft it was, with its old lines.
      await undoLines()
      await c.from('invoices').update({ state: existing.state, total: existing.total, issued_on: existing.issued_on, due_on: existing.due_on, updated_at: now.toISOString() }).eq('id', existing.id)
      throw new Error(`The invoice was not saved: ${(dErr ?? rErr)!.message}`)
    }
    return existing.id
  }

  const { data: number, error: nErr } = await c.rpc('next_document_number', { p_kind: 'invoice' })
  if (nErr || !number) throw new Error(`No invoice number: ${nErr?.message ?? 'none'}`)
  const { data: made, error } = await c.from('invoices').insert({ ...fields, number: number as string }).select('id').single()
  if (error) throw new Error(`The invoice was not saved: ${error.message}`)
  const id = made.id
  const { error: lErr } = await c.from('invoice_lines').insert(lineRows(id))
  // The reimbursements on it leave the queue for the next one.
  const { error: rErr } = lErr || !rIds.length ? { error: null } : await c.from('reimbursements').update({ state: 'on_invoice', invoice_id: id }).in('id', rIds)
  if (lErr || rErr) {
    // No invoice waiting for approval with no lines: it goes (its lines with it).
    await c.from('invoices').delete().eq('id', id)
    throw new Error(`The invoice lines were not saved: ${(lErr ?? rErr)!.message}`)
  }
  return id
}
