'use server'

/**
 * Invoices (Clocky part 2, Invoices.dc.html 6G): Finance marks an approved
 * invoice paid, after paying it outside Rippling. Paid once: the action goes
 * away after that. The contractor hears it in the bell; the reimbursements on
 * it are paid with it.
 *
 * Writes are for the person really signed in (writerAccess), never during a
 * View Stage preview, and go through the privileged client.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, viewerFor } from '@/lib/timeclock/clocky-context'
import { announceInvoicePaid } from '@/lib/timeclock/clocky-notify'
import { dateLabel, localDate } from '@/lib/timeclock/format'
import { isFinance, loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { periodLabel } from '@/lib/timeclock/periods'
import { invoiceViewer, loadInvoiceDetail } from '@/lib/timeclock/invoices-view'
import type { InvoiceDocView } from '@/lib/timeclock/invoice-doc'
import type { Fail, Result } from '@/lib/timeclock/clocky-types'
import { closedRefusal } from '@/lib/timeclock/north-time-lock'
import { linkSubmission, tellApprover, tellFormSender } from '@/lib/invoice-form/data'
import { newSenderRights } from '@/lib/invoice-form/rules'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const fail = (error: string): Fail => ({ ok: false, error })

/** One invoice as its document, for the PDF preview a list row opens (the same people as its page). */
export async function getInvoiceDoc(input: { id: number }): Promise<Result<{ doc: InvoiceDocView }>> {
  try {
    const access = await loadAccess()
    if (!access.can('clocky-invoices')) return fail('Invoices is not open to your access.')
    const v = await viewerFor(access)
    const d = await loadInvoiceDetail(invoiceViewer(access, v?.zone ?? 'America/New_York'), Number(input.id))
    return d ? { ok: true, doc: d.doc } : fail('That invoice is not open to you.')
  } catch (e) {
    console.error('[clocky invoices]', e instanceof Error ? e.message : e)
    return fail('The invoice could not be read. Try again in a moment.')
  }
}

export async function markInvoicePaid(input: { id: number; paidOn: string; ref?: string; note?: string }): Promise<Result<{ toast: string }>> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to mark an invoice paid.')
  const closed = await closedRefusal(fail)
  if (closed) return closed
  const access = await writerAccess()
  if (!access) return fail('Sign in again to save.')
  if (!access.can('clocky-invoices')) return fail('Invoices is not open to your access.')
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    const settings = await loadInvoiceSettings()
    if (!isFinance(access, settings)) return fail('Only Finance marks invoices paid.')
    const paidOn = String(input.paidOn ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(`${paidOn}T00:00:00Z`))) return fail('Write the day it was paid, like Nov 3, 2026.')
    if (paidOn > localDate(new Date(), v.zone)) return fail('Paid on cannot be after today.')
    const ref = String(input.ref ?? '').trim().slice(0, 120) || null
    const note = String(input.note ?? '').trim().slice(0, 1000) || null
    const c = db()
    const { data: inv, error: e1 } = await c.from('invoices').select('id, number, person_id, state, submission_id, period_start, period_end, from_snapshot').eq('id', Number(input.id)).maybeSingle()
    if (e1) throw e1
    if (!inv || inv.state !== 'approved') return fail('That invoice is not waiting to be paid. It may have been marked paid already.')
    const at = new Date().toISOString()
    const { data: moved, error } = await c.from('invoices')
      .update({ state: 'paid', paid_on: paidOn, paid_ref: ref, paid_note: note, paid_by: v.personId, updated_at: at })
      .eq('id', inv.id).eq('state', 'approved').select('id')
    if (error) throw error
    if (!moved?.length) return fail('That invoice is not waiting to be paid. It may have been marked paid already.')
    await c.from('reimbursements').update({ state: 'paid' }).eq('invoice_id', inv.id).eq('state', 'on_invoice')
    await c.from('tc_approval_events').insert({ submission_id: inv.submission_id, invoice_id: inv.id, step: 'paid', action: 'paid', by_person: v.personId, at, note })
    const month = periodLabel({ start: inv.period_start, end: inv.period_end }).label
    await announceInvoicePaid({ invoiceId: inv.id, personId: inv.person_id, number: inv.number, month, paidOn: dateLabel(paidOn), ref })
    // From the invoice form (migration 147): its sender never signs in, so they hear it by email.
    await tellFormSender(inv.id, 'paid')
    revalidatePath('/clocky-hours/invoices')
    const who = (inv.from_snapshot as { name?: string } | null)?.name || 'The contractor'
    return { ok: true, toast: `${inv.number} marked paid. ${who} sees it in the bell.` }
  } catch (e) {
    console.error('[clocky invoices]', e instanceof Error ? e.message : e)
    return fail(NOT_SAVED)
  }
}

/**
 * "Link to this person" on an invoice the invoice form kept for a sender not
 * in the Directory (migration 147, decision B): it becomes that person's
 * numbered invoice, waiting for its approver, and the sender hears the number
 * by email. Whoever sees everyone's money and holds ck-inv-link, or is the default approver (newSenderRights).
 */
export async function linkFormSender(input: { id: number; personId: string }): Promise<Result<{ toast: string }>> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to link an invoice.')
  const closed = await closedRefusal(fail)
  if (closed) return closed
  const access = await writerAccess()
  if (!access) return fail('Sign in again to save.')
  if (!access.can('clocky-invoices')) return fail('Invoices is not open to your access.')
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    const settings = await loadInvoiceSettings()
    if (!newSenderRights(access, settings).link) return fail('Only Super Admins, and the default approver when they are Finance, link a new sender.')
    const personId = String(input?.personId ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(personId)) return fail('Pick the person from the Directory.')
    const { data: p, error } = await db().from('people').select('id, full_name').eq('id', personId).maybeSingle()
    if (error) throw error
    if (!p) return fail('Pick the person from the Directory.')
    const r = await linkSubmission(Number(input?.id), personId, v.personId)
    if (!r.ok) return fail(r.error)
    await tellApprover({ invoiceId: r.invoiceId, submissionId: null, personId, text: `${r.number} (${p.full_name}) came from the invoice form and was linked to the Directory. It waits for your approval.` })
    revalidatePath('/clocky-hours/invoices')
    revalidatePath('/clocky-hours/approvals')
    return { ok: true, toast: `Linked to ${p.full_name}. It is ${r.number} now, waiting for approval; the sender hears the number by email.` }
  } catch (e) {
    console.error('[clocky invoices] link sender:', e instanceof Error ? e.message : e)
    return fail(NOT_SAVED)
  }
}
