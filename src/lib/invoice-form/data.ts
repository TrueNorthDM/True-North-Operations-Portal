/**
 * The invoice form on the server (owner, 1 November 2026, forms mockup v3):
 * who a proved email is in the Directory, the items sent
 * before, the month already sent, and the invoice a send makes. It is a
 * normal invoice in the invoices tables ('fixed_no_timesheet' with a
 * `source`, migration 147), so Approvals, Mark paid, the PDF, the Drive
 * copies and the Invoices list work on it as on any other. Each reimbursement
 * on it is a reimbursements row riding on it (on_invoice), with its RCT
 * receipt number, approved with the invoice and not one by one.
 *
 * A sender not in the Directory is kept as a submission (invoice_form_
 * submissions) until the default approver links it to a person; only then
 * is it numbered.
 *
 * Every invoice is the contractor's own (leadership, 4 November 2026): each
 * one the form writes carries the record of who sent it, when, how (their own
 * PDF or filled in here) and the sentence they ticked, and each send is kept
 * in invoice_sends (lib/timeclock/contractor-invoice.ts). A new sender's record
 * waits in the submission and goes on the invoice when it is linked, with the
 * time they sent it.
 *
 * Not a "use server" file: the public actions and route, and the portal's
 * actions, decide who may cause each of these.
 */

import { createAdminClient, createUploadClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database.generated'
import { sendEmail } from '@/lib/email/resend'
import { formatAddressLines, normalizeAddress, type PersonAddress } from '@/lib/address'
import { countryName } from '@/lib/countries'
import { dueOn } from '@/lib/timeclock/invoice-lines'
import { usd } from '@/lib/timeclock/invoice-doc'
import { dateLabel, localDate } from '@/lib/timeclock/format'
import { loadInvoiceSettings, loadRouteSettings, loadRoutes, type InvoiceSettings } from '@/lib/timeclock/pay-terms'
import { formApprover } from '@/lib/timeclock/routing'
import { periodLabel } from '@/lib/timeclock/periods'
import { announceTimesheetSubmitted, portalOrigin } from '@/lib/timeclock/clocky-notify'
import { madeByLine, recordSend, sendFields, type MadeBy, type SendRecord } from '@/lib/timeclock/contractor-invoice'
import { renderFormMail, type FormMail } from './emails'
import {
  formInvoice, formRecord, itemKey, monthBounds, monthState, sourceOf, type CheckedSubmission, type Deliverable, type FormReimbursement,
  type FormWork, type MonthState, type Rates, type SenderInput, type SentItem,
} from './rules'

const c = () => createAdminClient()
/** True North's own zone: the day an invoice is issued, the "today" of the form. */
export const FORM_ZONE = 'America/New_York'
export const formToday = (now = new Date()) => localDate(now, FORM_ZONE)

/** The company's deliverable rates. */
export const companyRates = (s: Pick<InvoiceSettings, 'pageRate' | 'assetRate'>): Rates => ({ page: s.pageRate, asset: s.assetRate })

// ── Who they are (decision B) ──────────────────────────────────────────────

export interface FoundSender {
  personId: string
  name: string
  address: PersonAddress | null
  location: string | null
}

const MAILBOXES = ['email_true_north', 'email_goodnews', 'email_personal', 'email_coe'] as const

/**
 * The person a proved email belongs to: any of their four mailboxes, any case,
 * active or not, the active one first. Null when nobody has it. The email
 * comes from rules.emailOf, so it cannot carry filter syntax.
 */
export async function findSender(email: string): Promise<FoundSender | null> {
  const like = email.replace(/[\\%_]/g, m => `\\${m}`)
  const { data, error } = await c().from('people').select('id, full_name, status, address, location, email_true_north, email_goodnews, email_personal, email_coe')
    .or(MAILBOXES.map(m => `${m}.ilike.${like}`).join(',')).limit(20)
  if (error) throw new Error(`The Directory could not be read: ${error.message}`)
  const found = (data ?? []).filter(p => MAILBOXES.some(m => (p[m] ?? '').trim().toLowerCase() === email))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || (a.full_name ?? '').localeCompare(b.full_name ?? ''))
  const p = found[0]
  return p ? { personId: p.id, name: p.full_name ?? '', address: (p.address as PersonAddress | null) ?? null, location: p.location ?? null } : null
}

/** A person's own deliverable rates (Rates & Costs), each null when not set. */
export async function ownRates(personId: string): Promise<{ page: number | null; asset: number | null }> {
  const { data, error } = await c().from('pay_terms').select('page_rate, asset_rate').eq('person_id', personId).maybeSingle()
  if (error) throw new Error(`The rates could not be read: ${error.message}`)
  const n = (v: unknown) => (v == null ? null : Number(v))
  return { page: n(data?.page_rate), asset: n(data?.asset_rate) }
}

/** The sender as the invoice names them: the line under the name ("123 Example St, Springfield, IL 62701, United States"). */
export const senderAddress = (s: SenderInput): PersonAddress | null =>
  normalizeAddress({ line1: s.line1, line2: s.line2, city: s.city, state: s.state, zip: s.zip, country: s.country })
export const senderLine = (s: SenderInput): string => formatAddressLines(senderAddress(s)).join(', ')

// ── Items sent before, the month ───────────────────────────────────────────

/**
 * What a submission keeps in its `lines`: the work, the rates it was priced
 * at, and (since 4 November 2026) the send's record: how it was made, what
 * they typed beside their file, and the sentence they ticked. Older ones have
 * no record.
 */
interface StoredWork {
  work: FormWork
  rates: Rates
  record?: { madeBy: MadeBy; own: CheckedSubmission['own']; confirmed: string }
}

/** Every item with one of these keys already sent, by anyone: on an invoice (but `exceptInvoiceId`), or waiting for the Directory. */
export async function sentBefore(keys: readonly string[], exceptInvoiceId: number | null): Promise<SentItem[]> {
  if (!keys.length) return []
  const out: SentItem[] = []
  const uniq = [...new Set(keys)]
  for (let i = 0; i < uniq.length; i += 100) {
    const { data, error } = await c().from('invoice_lines').select('invoice_id, deliverable_key, deliverable_kind, invoices(issued_on)')
      .eq('kind', 'deliverable').in('deliverable_key', uniq.slice(i, i + 100))
    if (error) throw new Error(`Invoice lines could not be read: ${error.message}`)
    for (const l of data ?? []) {
      if (l.invoice_id === exceptInvoiceId || !l.deliverable_key) continue
      const inv = l.invoices as unknown as { issued_on: string } | null
      out.push({ key: l.deliverable_key, kind: l.deliverable_kind as Deliverable, sentOn: inv?.issued_on ?? '' })
    }
  }
  const { data: waiting, error } = await c().from('invoice_form_submissions').select('lines, created_at').eq('state', 'waiting')
  if (error) throw new Error(`Invoice form submissions could not be read: ${error.message}`)
  const want = new Set(uniq)
  for (const w of waiting ?? []) {
    const stored = w.lines as unknown as StoredWork
    if (stored?.work?.kind !== 'deliverables') continue
    for (const it of stored.work.items) {
      const key = itemKey(it.name)
      if (want.has(key)) out.push({ key, kind: it.kind, sentOn: localDate(w.created_at, FORM_ZONE) })
    }
  }
  return out
}

/** Whether a sender already sent the month (decision C): free, theirs to send again (returned), or taken. */
export async function monthFor(email: string, personId: string | null, ym: string): Promise<MonthState> {
  const { start } = monthBounds(ym)
  const [inv, sub] = await Promise.all([
    personId
      ? c().from('invoices').select('id, number, state').eq('person_id', personId).eq('period_start', start).not('source', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    c().from('invoice_form_submissions').select('id').ilike('email', email.replace(/[\\%_]/g, m => `\\${m}`)).eq('period_start', start).eq('state', 'waiting').limit(1),
  ])
  if (inv.error) throw new Error(`Invoices could not be read: ${inv.error.message}`)
  if (sub.error) throw new Error(`Invoice form submissions could not be read: ${sub.error.message}`)
  return monthState((inv.data ?? []) as { id: number; number: string; state: string }[], (sub.data ?? []).length > 0)
}

// ── Making the invoice ─────────────────────────────────────────────────────

/** A stored file: a receipt or their own PDF, already in the receipts bucket. */
export interface StoredFile { path: string; name: string; size: number }

export interface FormInvoiceInput {
  personId: string
  email: string
  sub: Pick<CheckedSubmission, 'month' | 'kind' | 'sender' | 'work' | 'reimbursements' | 'own'>
  rates: Rates
  /** Each reimbursement's receipt, by its `file` number. */
  receipts: ReadonlyMap<number, StoredFile>
  ownPdf: StoredFile | null
  /** The returned invoice of the same month, sent again: same number, new lines. */
  againId: number | null
  /** Who sent it, when, how, and the sentence ticked (formRecord). Null only for a submission kept before 4 November 2026. */
  record: SendRecord | null
  /** When they sent it: now, or when a new sender sent it (a submission linked later). Defaults to `now`. */
  sentAt?: Date
  now?: Date
}

/**
 * Writes the form's invoice and its reimbursements: a new one numbered INV,
 * or the returned one again (back to waiting, same number). Either all of it
 * is saved or none; on a failure the caller removes the files it stored.
 */
export async function writeFormInvoice(x: FormInvoiceInput): Promise<{ id: number; number: string }> {
  const db = c()
  const now = x.now ?? new Date()
  const at = now.toISOString()
  const settings = await loadInvoiceSettings()
  const { start, end } = monthBounds(x.sub.month)
  const sentAt = x.sentAt ?? now
  const { lines, total } = formInvoice(x.sub, x.rates)
  const issued = formToday(now)
  const fields = {
    person_id: x.personId, submission_id: null, period_start: start, period_end: end, kind: 'fixed_no_timesheet', source: sourceOf(x.sub.kind),
    sender_email: x.email, state: 'waiting', issued_on: issued, due_on: dueOn(issued, settings.paymentDays), total,
    from_snapshot: { name: x.sub.sender.name, location: senderLine(x.sub.sender), email: x.email },
    to_snapshot: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '', email: settings.billingEmail ?? '' },
    approved_by: null, approved_at: null, paid_note: null, updated_at: at,
    // The record of this send (who, when, how, the sentence ticked) and their PDF.
    ...(x.record ? sendFields(x.record, sentAt) : { own_pdf_path: x.ownPdf?.path ?? null, own_pdf_name: x.ownPdf?.name ?? null }),
  }

  let id: number, number: string
  let oldLines: number[] = [], oldRmb: { id: number; receipt_path: string | null }[] = []
  let before: Omit<Before, 'id' | 'number' | 'person_id' | 'source'> | null = null
  if (x.againId) {
    const { data: ex, error } = await db.from('invoices')
      .select('id, number, person_id, source, state, total, own_pdf_path, own_pdf_name, made_by, sent_from, sent_by, sent_at, confirmed_text, their_number, stated_hours, stated_total, covers')
      .eq('id', x.againId).maybeSingle()
    if (error) throw new Error(`The invoice could not be read: ${error.message}`)
    if (!ex || ex.state !== 'draft' || ex.person_id !== x.personId || !ex.source) throw new Error('That invoice is not waiting to be sent again.')
    // All of what this send changes (the record of the send before too), to put back if it fails half way.
    const e = ex as Before
    before = {
      state: e.state, total: e.total, own_pdf_path: e.own_pdf_path, own_pdf_name: e.own_pdf_name, made_by: e.made_by, sent_from: e.sent_from, sent_by: e.sent_by,
      sent_at: e.sent_at, confirmed_text: e.confirmed_text, their_number: e.their_number, stated_hours: e.stated_hours, stated_total: e.stated_total, covers: e.covers,
    }
    const [ol, orr] = await Promise.all([
      db.from('invoice_lines').select('id').eq('invoice_id', ex.id),
      db.from('reimbursements').select('id, receipt_path').eq('invoice_id', ex.id),
    ])
    if (ol.error || orr.error) throw new Error(`The invoice lines could not be read: ${(ol.error ?? orr.error)!.message}`)
    oldLines = (ol.data ?? []).map(l => l.id)
    oldRmb = (orr.data ?? []) as { id: number; receipt_path: string | null }[]
    id = ex.id
    number = ex.number
    // The new send's record replaces the one before on the invoice; the one before stays in invoice_sends.
    const { data: moved, error: uErr } = await db.from('invoices').update(fields).eq('id', ex.id).eq('state', 'draft').select('id')
    if (uErr) throw new Error(`The invoice was not saved: ${uErr.message}`)
    if (!moved?.length) throw new Error('That invoice is not waiting to be sent again.')
  } else {
    const { data: n, error: nErr } = await db.rpc('next_document_number', { p_kind: 'invoice' })
    if (nErr || !n) throw new Error(`No invoice number: ${nErr?.message ?? 'none'}`)
    const { data: made, error } = await db.from('invoices').insert({ ...fields, number: n as string }).select('id').single()
    if (error) throw new Error(`The invoice was not saved: ${error.message}`)
    id = made.id
    number = n as string
  }

  const addedRmb: number[] = []
  const addedReports: number[] = []
  const addedLines: number[] = []
  const undo = async () => {
    if (addedLines.length) await db.from('invoice_lines').delete().in('id', addedLines)
    if (addedRmb.length) await db.from('reimbursements').delete().in('id', addedRmb)
    if (addedReports.length) await db.from('reimbursement_reports').delete().in('id', addedReports)
    if (x.againId && before) await db.from('invoices').update({ ...before, updated_at: at }).eq('id', id)
    else await db.from('invoices').delete().eq('id', id)
  }
  try {
    // An event or trip groups its receipts, as a named request does (migration 122).
    const reportOf = new Map<string, number>()
    for (const ev of [...new Set(x.sub.reimbursements.map(r => r.event).filter((e): e is string => !!e))]) {
      const { data: rep, error } = await db.from('reimbursement_reports').insert({ person_id: x.personId, name: ev }).select('id').single()
      if (error) throw new Error(`The reimbursement was not saved: ${error.message}`)
      addedReports.push(rep.id)
      reportOf.set(ev, rep.id)
    }
    const rmbIds: number[] = []
    for (const r of x.sub.reimbursements) {
      const file = r.file != null ? x.receipts.get(r.file) ?? null : null
      let receiptNumber: string | null = null
      if (file) {
        const { data: n, error } = await db.rpc('next_document_number', { p_kind: 'receipt' })
        if (error || !n) throw new Error(`No receipt number: ${error?.message ?? 'none'}`)
        receiptNumber = n as string
      }
      const { data: row, error } = await db.from('reimbursements').insert(rmbRow(x.personId, r, file, receiptNumber, r.event ? reportOf.get(r.event) ?? null : null, id, at)).select('id').single()
      if (error) throw new Error(`The reimbursement was not saved: ${error.message}`)
      addedRmb.push(row.id)
      rmbIds.push(row.id)
    }
    const { data: ls, error: lErr } = await db.from('invoice_lines').insert(lines.map(l => ({
      invoice_id: id, kind: l.kind, client: l.client, description: l.description, hours_seconds: null, rate: l.rate, amount: l.amount,
      reimbursement_id: l.reimbursement != null ? rmbIds[l.reimbursement] : null, sort: l.sort, deliverable_kind: l.deliverableKind, deliverable_key: l.deliverableKey,
    }))).select('id')
    if (lErr) throw new Error(`The invoice lines were not saved: ${lErr.message}`)
    addedLines.push(...(ls ?? []).map(l => l.id))
  } catch (e) {
    await undo()
    throw e
  }

  if (x.againId) {
    // The old lines and reimbursements go once the new ones are in, and the old receipts with them.
    if (oldLines.length) await db.from('invoice_lines').delete().in('id', oldLines)
    if (oldRmb.length) {
      await db.from('reimbursements').delete().in('id', oldRmb.map(r => r.id))
      const files = oldRmb.map(r => r.receipt_path).filter((p): p is string => !!p)
      if (files.length) await createUploadClient().storage.from('receipts').remove(files).catch(() => null)
    }
    // Their PDF of the send before is kept: its version in invoice_sends still points to it (4 November 2026).
    await db.from('tc_approval_events').insert({ submission_id: null, invoice_id: id, step: 'invoice', action: 'submit', by_person: null, at, note: null })
  }
  if (x.record) await recordSend(id, x.record, sentAt)
  return { id, number }
}

/** A returned invoice as read before it is sent again: what the send changes, kept to put back when it fails half way. */
type Before = {
  id: number; number: string; person_id: string; source: string | null; state: string; total: number
  own_pdf_path: string | null; own_pdf_name: string | null; made_by: string | null; sent_from: string | null; sent_by: string | null
  sent_at: string | null; confirmed_text: string | null; their_number: string | null; stated_hours: number | null; stated_total: number | null; covers: string | null
}

/** A reimbursement riding on a form invoice: no decision of its own, approved with the invoice. */
function rmbRow(personId: string, r: FormReimbursement, file: StoredFile | null, receiptNumber: string | null, reportId: number | null, invoiceId: number, at: string) {
  return {
    person_id: personId, spent_on: r.spentOn, category: r.category, amount: r.amount, currency: r.currency, purpose: r.purpose,
    client: r.client, billable: r.billable, receipt_path: file?.path ?? null, receipt_number: receiptNumber,
    receipt_name: file ? file.name.slice(0, 200) || 'receipt' : null, receipt_size: file?.size ?? null,
    miles: r.miles, mileage_rate: r.mileageRate, state: 'on_invoice', invoice_id: invoiceId, report_id: reportId, asked_at: at,
  }
}

/** "Use these" (decision B): what they changed goes on their own record too: the address, and the location when it was empty. */
export async function writeBackAddress(personId: string, s: SenderInput): Promise<void> {
  const address = senderAddress(s)
  if (!address) return
  const { data: p } = await c().from('people').select('location').eq('id', personId).maybeSingle()
  const location = p?.location ? undefined : [s.city, countryName(s.country)].filter(Boolean).join(', ') || undefined
  const { error } = await c().from('people').update({ address: address as Json, ...(location ? { location } : {}) }).eq('id', personId)
  if (error) console.error('[invoice form] the address was not saved on the record:', error.message)
}

// ── New senders (not in the Directory) ─────────────────────────────────────

export interface StoredReimbursement extends FormReimbursement { receipt: StoredFile | null }

/** Keeps what a sender not in the Directory sent, to be linked to a person later. */
export async function storeSubmission(x: { email: string; sub: CheckedSubmission; rates: Rates; receipts: ReadonlyMap<number, StoredFile>; ownPdf: StoredFile | null; confirmed: string }): Promise<number> {
  const { start, end } = monthBounds(x.sub.month)
  const { total } = formInvoice(x.sub, x.rates)
  // The record waits here with the send; created_at is when they sent it.
  const stored: StoredWork = { work: x.sub.work, rates: x.rates, record: { madeBy: x.sub.madeBy, own: x.sub.own, confirmed: x.confirmed } }
  const reimbursements: StoredReimbursement[] = x.sub.reimbursements.map(r => ({ ...r, receipt: r.file != null ? x.receipts.get(r.file) ?? null : null }))
  const { data, error } = await c().from('invoice_form_submissions').insert({
    email: x.email, sender: x.sub.sender as unknown as Json, source: sourceOf(x.sub.kind), period_start: start, period_end: end,
    lines: stored as unknown as Json, reimbursements: reimbursements as unknown as Json, total,
    own_pdf_path: x.ownPdf?.path ?? null, own_pdf_name: x.ownPdf?.name ?? null,
  }).select('id').single()
  if (error) throw new Error(`The invoice was not saved: ${error.message}`)
  return data.id
}

export interface WaitingSender {
  id: number
  email: string
  name: string
  line: string
  month: string
  how: string
  total: string
  lines: { text: string; amount: string }[]
  /** Files to open: their PDF and each receipt, by the name the link takes. */
  files: { key: string; label: string }[]
  sentOn: string
}

type SubRow = { id: number; email: string; sender: Json; source: string; period_start: string; period_end: string; lines: Json; reimbursements: Json; total: number; own_pdf_path: string | null; own_pdf_name: string | null; created_at: string }
const SUB_COLS = 'id, email, sender, source, period_start, period_end, lines, reimbursements, total, own_pdf_path, own_pdf_name, created_at'

/** The submissions waiting for the Directory, oldest first, as the Invoices page shows them. */
export async function loadWaitingSenders(): Promise<WaitingSender[]> {
  const { data, error } = await c().from('invoice_form_submissions').select(SUB_COLS).eq('state', 'waiting').order('created_at')
  if (error) throw new Error(`Invoice form submissions could not be read: ${error.message}`)
  return ((data ?? []) as SubRow[]).map(s => {
    const sender = s.sender as unknown as SenderInput
    const stored = s.lines as unknown as StoredWork
    const rmb = s.reimbursements as unknown as StoredReimbursement[]
    const { lines } = formInvoice({ work: stored.work, reimbursements: rmb, own: stored.record?.own ?? null }, stored.rates)
    const n = stored.work.kind === 'deliverables' ? stored.work.items.length : 0
    const made = stored.record ? `, ${madeByLine(stored.record.madeBy, sender.name, s.own_pdf_name).replace(/^./, ch => ch.toLowerCase())}` : ''
    return {
      id: s.id, email: s.email, name: sender.name, line: senderLine(sender), month: periodLabel({ start: s.period_start, end: s.period_end }).full,
      how: `${stored.work.kind === 'fixed' ? 'The invoice form, fixed amount' : `The invoice form, deliverables, ${n} line${n === 1 ? '' : 's'}`}${made}`,
      total: usd(Number(s.total)),
      lines: lines.map(l => ({ text: l.kind === 'reimbursement' ? `Reimbursement: ${l.client}, ${l.description}` : l.description, amount: usd(l.amount) })),
      files: [
        ...(s.own_pdf_path ? [{ key: 'pdf', label: s.own_pdf_name || 'Their invoice (PDF)' }] : []),
        ...rmb.flatMap((r, i) => (r.receipt ? [{ key: `r${i}`, label: `Receipt ${i + 1}: ${r.receipt.name}` }] : [])),
      ],
      sentOn: dateLabel(localDate(s.created_at, FORM_ZONE)),
    }
  })
}

/** One file of a waiting submission ('pdf' or 'r<n>'): where it is kept. */
export async function submissionFile(id: number, key: string): Promise<StoredFile | null> {
  const { data, error } = await c().from('invoice_form_submissions').select('own_pdf_path, own_pdf_name, reimbursements').eq('id', id).maybeSingle()
  if (error || !data) return null
  if (key === 'pdf') return data.own_pdf_path ? { path: data.own_pdf_path, name: data.own_pdf_name ?? 'invoice.pdf', size: 0 } : null
  const m = /^r(\d{1,2})$/.exec(key)
  const r = m ? (data.reimbursements as unknown as StoredReimbursement[])[Number(m[1])] : null
  return r?.receipt ?? null
}

/**
 * Links a waiting submission to a person: it becomes their numbered invoice,
 * and the sender hears its number. The month rule still holds: a person who
 * already has a form invoice for that month is refused.
 */
export async function linkSubmission(id: number, personId: string, linkedBy: string): Promise<{ ok: true; number: string; invoiceId: number } | { ok: false; error: string }> {
  const db = c()
  const { data, error } = await db.from('invoice_form_submissions').select(`${SUB_COLS}, state`).eq('id', id).maybeSingle()
  if (error) throw new Error(`The submission could not be read: ${error.message}`)
  if (!data || data.state !== 'waiting') return { ok: false, error: 'That invoice is no longer waiting. Reload the page.' }
  const s = data as SubRow & { state: string }
  const stored = s.lines as unknown as StoredWork
  const rmb = s.reimbursements as unknown as StoredReimbursement[]
  const ym = s.period_start.slice(0, 7)
  const { data: had, error: hErr } = await db.from('invoices').select('id').eq('person_id', personId).eq('period_start', s.period_start).not('source', 'is', null).limit(1)
  if (hErr) throw new Error(`Invoices could not be read: ${hErr.message}`)
  if ((had ?? []).length) return { ok: false, error: `That person already has an invoice from the form for ${periodLabel({ start: s.period_start, end: s.period_end }).full}.` }
  const receipts = new Map<number, StoredFile>()
  const reimbursements = rmb.map((r, i) => {
    if (r.receipt) receipts.set(i, r.receipt)
    return { ...r, file: r.receipt ? i : null }
  })
  const ownPdf = s.own_pdf_path ? { path: s.own_pdf_path, name: s.own_pdf_name ?? 'invoice.pdf', size: 0 } : null
  const sub = { month: ym, kind: stored.work.kind, sender: s.sender as unknown as SenderInput, work: stored.work, reimbursements, own: stored.record?.own ?? null }
  // The record they made when they sent it, now with the person: sent by them, at the time they sent it.
  const record = stored.record
    ? formRecord({ ...sub, madeBy: stored.record.madeBy }, { rates: stored.rates, sentBy: personId, email: s.email, confirmed: stored.record.confirmed, ownPdf })
    : null
  const made = await writeFormInvoice({ personId, email: s.email, againId: null, rates: stored.rates, receipts, ownPdf, sub, record, sentAt: new Date(s.created_at) })
  const { data: moved, error: mErr } = await db.from('invoice_form_submissions')
    .update({ state: 'linked', person_id: personId, invoice_id: made.id, linked_by: linkedBy, linked_at: new Date().toISOString() })
    .eq('id', id).eq('state', 'waiting').select('id')
  if (mErr || !moved?.length) {
    // Linked twice at once: the second invoice goes, the first stays.
    await db.from('invoice_lines').delete().eq('invoice_id', made.id)
    await db.from('reimbursements').delete().eq('invoice_id', made.id)
    await db.from('invoices').delete().eq('id', made.id)
    return { ok: false, error: 'That invoice is no longer waiting. Reload the page.' }
  }
  // Next month the same email finds them: it goes on their record when no one else has it.
  await rememberEmail(personId, s.email)
  await mailSender(s.email, { kind: 'numbered', number: made.number, month: periodLabel({ start: s.period_start, end: s.period_end }).full, total: usd(Number(s.total)) }, `numbered:${made.id}`)
  return { ok: true, number: made.number, invoiceId: made.id }
}

/** The sender's email as the person's personal email, when that is empty and nobody else has the address. */
async function rememberEmail(personId: string, email: string): Promise<void> {
  try {
    const { data: p } = await c().from('people').select('email_personal').eq('id', personId).maybeSingle()
    if (!p || p.email_personal) return
    if (await findSender(email)) return
    await c().from('people').update({ email_personal: email }).eq('id', personId)
  } catch (e) {
    console.error('[invoice form] email not kept:', e instanceof Error ? e.message : e)
  }
}

// ── Emails to the sender (decision F) ──────────────────────────────────────

/** Sends one of the form's emails; a failure is logged, never thrown (the action that wanted it is done). */
export async function mailSender(to: string, m: FormMail, key: string): Promise<boolean> {
  try {
    const mail = renderFormMail(m, await portalOrigin())
    const r = await sendEmail({ to, ...mail, idempotencyKey: `invoice-form:${key}` })
    if (!r.sent && !r.blocked) console.error('[invoice form] email:', r.reason)
    return r.sent
  } catch (e) {
    console.error('[invoice form] email:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * An invoice from the form was approved, returned or paid: its sender hears
 * it by email. Nothing for any other invoice. Never throws.
 */
export async function tellFormSender(invoiceId: number, event: 'approved' | 'returned' | 'paid'): Promise<void> {
  try {
    const { data: i, error } = await c().from('invoices').select('id, number, source, sender_email, period_start, period_end, total, paid_on, paid_ref, paid_note, updated_at').eq('id', invoiceId).maybeSingle()
    if (error || !i?.source || !i.sender_email) return
    const month = periodLabel({ start: i.period_start, end: i.period_end }).full
    const total = usd(Number(i.total))
    const key = `${event}:${i.id}:${i.updated_at}`
    if (event === 'approved') await mailSender(i.sender_email, { kind: 'approved', number: i.number, month, total }, key)
    else if (event === 'paid') await mailSender(i.sender_email, { kind: 'paid', number: i.number, month, total, paidOn: i.paid_on ? dateLabel(i.paid_on) : '', ref: i.paid_ref }, key)
    else {
      const link = `${await portalOrigin()}/send`
      await mailSender(i.sender_email, { kind: 'returned', number: i.number, month, reason: i.paid_note ?? '', link }, key)
    }
  } catch (e) {
    console.error('[invoice form] tell sender:', e instanceof Error ? e.message : e)
  }
}

/**
 * The bell of whoever decides it, as the day 1 invoices ring it
 * (invoices-cron.ts): a form invoice waits for its approver (the form's rule),
 * a new sender's for the default approver. Never throws.
 */
export async function tellApprover(x: { invoiceId: number | null; submissionId: number | null; personId: string | null; text: string }): Promise<void> {
  try {
    const settings = await loadRouteSettings()
    let to: string | null = settings.defaultApprover
    if (x.personId) {
      const route = (await loadRoutes([x.personId])).get(x.personId)
      to = route ? formApprover(route, settings) : settings.defaultApprover
    }
    if (!to) return
    // A negative id, as the day 1 invoices use: the bell's key, never a timesheet.
    const key = x.invoiceId != null ? -x.invoiceId : -(1_000_000_000 + (x.submissionId ?? 0))
    await announceTimesheetSubmitted({ submissionId: key, sentAt: new Date().toISOString(), personId: x.personId ?? '', to: [to], period: '', seconds: 0, text: x.text })
  } catch (e) {
    console.error('[invoice form] tell approver:', e instanceof Error ? e.message : e)
  }
}
