/**
 * The contractor makes and sends their own invoice (leadership, 4 November
 * 2026, David's answers to the rules; migration 152). The portal no longer
 * makes an invoice from a timesheet: under US labor law making and submitting
 * the invoice is part of being a contractor. Two ways, both on record:
 *
 *   own_file   their own PDF, with the number, hours and total they type so
 *              it can be checked against the timesheet
 *   builder    the invoice builder: they write the lines (the hours of their
 *              timesheet can be copied in with one button they press); the
 *              portal adds them up and makes the PDF in their name
 *
 * Every send is kept (invoice_sends): who sent it, when, how, the sentence
 * they confirmed, what they typed, their file and their lines. The invoice row
 * holds the latest. The approver sees the invoice beside the timesheet with
 * the differences marked (compareInvoice); approving both in one step only
 * goes ahead when they match, or with a reason.
 *
 * Pure apart from the writers at the bottom.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { dueOn } from './invoice-lines'
import { loadInvoiceSettings } from './pay-terms'

export type MadeBy = 'own_file' | 'builder'
export type SentFrom = 'portal' | 'form'

/** The sentence a contractor ticks before sending, kept on the invoice word for word. */
export const confirmText = (madeBy: MadeBy, periodName: string): string =>
  madeBy === 'own_file'
    ? `This is my invoice. I made it and I am sending it to True North for ${periodName}.`
    : `This is my invoice. I wrote these lines and I am sending this invoice to True North for ${periodName}.`

/** How an invoice was made, as the record says it. */
export function madeByLine(madeBy: MadeBy | null, name: string, file?: string | null): string {
  if (madeBy === 'own_file') return `Their own file${file ? `, "${file}"` : ''}`
  if (madeBy === 'builder') return `Built by ${name} with the portal's invoice builder`
  return 'Made by the portal from the timesheet (before November 2026)'
}

// ── The builder's lines ─────────────────────────────────────────────────────

export interface BuilderLine {
  /** What it covers, in their words: "i7 Marketing, October 2026". */
  description: string
  /** The client the hours are for, when the line came from their timesheet (or they named one). */
  client: string | null
  /** Hours on the line; null for an amount with no hours (a fixed amount). */
  hours: number | null
  /** Their rate an hour; null with no hours. */
  rate: number | null
  /** An amount with no hours (a fixed monthly amount, say); ignored when hours and rate are given. */
  amount: number | null
}

const cents = (n: number) => Math.round(n * 100) / 100

/** A line's amount: hours times rate, or the amount they wrote. Null when it cannot be read. */
export function lineAmount(l: BuilderLine): number | null {
  if (l.hours != null || l.rate != null) {
    if (l.hours == null || l.rate == null || !(l.hours > 0) || !(l.rate >= 0)) return null
    return cents(l.hours * l.rate)
  }
  return l.amount != null && l.amount > 0 ? cents(l.amount) : null
}

/** What is wrong with the builder's lines, in their words; null when they can be sent. */
export function builderProblem(lines: readonly BuilderLine[]): string | null {
  if (!lines.length) return 'Add at least one line.'
  if (lines.length > 60) return 'An invoice holds up to 60 lines.'
  for (const [i, l] of lines.entries()) {
    if (l.description.trim().length < 2) return `Line ${i + 1}: say what it covers.`
    if (l.hours != null && l.hours > 744) return `Line ${i + 1}: the hours look too many for one month.`
    if (lineAmount(l) == null) return `Line ${i + 1}: write the hours and your rate, or an amount.`
  }
  return null
}

/** "Use my timesheet hours": one line a client, hours as on the timesheet, the rate left for them to write. */
export function linesFromTimesheet(byClient: readonly { client: string; seconds: number }[], periodName: string): BuilderLine[] {
  return byClient.filter(c => c.seconds > 0).map(c => ({
    description: `${c.client}, ${periodName}`,
    client: c.client,
    hours: Math.round(c.seconds / 36) / 100,
    rate: null,
    amount: null,
  }))
}

// ── The check: the invoice beside the timesheet ─────────────────────────────

export interface CompareInput {
  /** The hours the timesheet holds, by client. Empty with no timesheet. */
  timesheet: readonly { client: string; seconds: number }[]
  /** Their rate on file (Rates & Costs), for hourly; the fixed amount, for fixed. */
  pay: { kind: 'hourly'; rate: number | null } | { kind: 'fixed'; amount: number | null }
  /** Approved reimbursements on this invoice, by number or id, with the amount. */
  reimbursements: readonly { label: string; amount: number }[]
  /** What the invoice says. */
  invoice: {
    madeBy: MadeBy | null
    /** Builder lines with hours, by client (own file: none). */
    byClient: readonly { client: string; seconds: number }[]
    /** Hours it says in all (own file: what they typed; builder: the lines). */
    hours: number | null
    total: number
    /** Reimbursements it includes, by label. */
    reimbursements: readonly string[]
  }
}

export type Check = 'match' | 'differs' | 'only-timesheet' | 'only-invoice' | 'on-file'

export interface CompareRow {
  label: string
  /** "96h 00m" or "$84.20". */
  timesheet: string
  invoice: string
  /** "+2h 00m", "-$50.00", or "" when it matches. */
  difference: string
  check: Check
}

export interface Comparison {
  rows: CompareRow[]
  total: CompareRow
  /** Everything that can be checked matches. */
  matches: boolean
  /** One line for the banner when it does not: "It bills 2h more on COE Group and comes to $50.00 more...". */
  summary: string | null
}

const hm = (seconds: number) => {
  const m = Math.round(Math.abs(seconds) / 60)
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number, f: (x: number) => string) => (n > 0 ? `+${f(n)}` : `-${f(n)}`)
/** A minute either way is the same hour (lines are typed to two decimals). */
const sameSeconds = (a: number, b: number) => Math.abs(a - b) < 60
const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005

/** The invoice beside the timesheet, row by row: what the approver reads before deciding. */
export function compareInvoice(x: CompareInput): Comparison {
  const rows: CompareRow[] = []
  const diffs: string[] = []
  const own = x.invoice.madeBy === 'own_file'

  if (x.pay.kind === 'hourly') {
    const clients = [...new Set([...x.timesheet.map(c => c.client), ...x.invoice.byClient.map(c => c.client)])]
    for (const client of clients) {
      const t = x.timesheet.find(c => c.client === client)?.seconds ?? 0
      const iv = x.invoice.byClient.find(c => c.client === client)?.seconds
      if (own) { rows.push({ label: client, timesheet: hm(t), invoice: 'On their file', difference: '', check: 'on-file' }); continue }
      if (iv === undefined) { rows.push({ label: client, timesheet: hm(t), invoice: '-', difference: signed(-t, hm), check: 'only-timesheet' }); diffs.push(`leaves out ${hm(t)} on ${client}`); continue }
      if (!t) { rows.push({ label: client, timesheet: '-', invoice: hm(iv), difference: signed(iv, hm), check: 'only-invoice' }); diffs.push(`bills ${hm(iv)} on ${client}, which is not on the timesheet`); continue }
      const same = sameSeconds(t, iv)
      rows.push({ label: client, timesheet: hm(t), invoice: hm(iv), difference: same ? '' : signed(iv - t, hm), check: same ? 'match' : 'differs' })
      if (!same) diffs.push(`bills ${hm(iv - t)} ${iv > t ? 'more' : 'less'} on ${client}`)
    }
    if (own && x.invoice.hours != null) {
      const t = x.timesheet.reduce((n, c) => n + c.seconds, 0)
      const iv = Math.round(x.invoice.hours * 3600)
      const same = sameSeconds(t, iv)
      rows.push({ label: 'Hours in all', timesheet: hm(t), invoice: hm(iv), difference: same ? '' : signed(iv - t, hm), check: same ? 'match' : 'differs' })
      if (!same) diffs.push(`says ${hm(iv - t)} ${iv > t ? 'more' : 'fewer'} hours than the timesheet`)
    }
  }

  for (const r of x.reimbursements) {
    const on = x.invoice.reimbursements.includes(r.label)
    rows.push({ label: `Reimbursement ${r.label}`, timesheet: usd(r.amount), invoice: on ? usd(r.amount) : '-', difference: on ? '' : signed(-r.amount, usd), check: on ? 'match' : 'only-timesheet' })
    if (!on) diffs.push(`leaves out reimbursement ${r.label}`)
  }

  const reimb = x.reimbursements.filter(r => x.invoice.reimbursements.includes(r.label)).reduce((n, r) => n + r.amount, 0)
  const tSeconds = x.timesheet.reduce((n, c) => n + c.seconds, 0)
  const expected = x.pay.kind === 'hourly'
    ? (x.pay.rate == null ? null : cents(tSeconds / 3600 * x.pay.rate + reimb))
    : (x.pay.amount == null ? null : cents(x.pay.amount + reimb))
  const sameTotal = expected != null && sameMoney(expected, x.invoice.total)
  const total: CompareRow = {
    label: x.pay.kind === 'hourly' ? `Total${x.pay.rate != null ? ` (rate on file ${usd(x.pay.rate)})` : ''}` : 'Total (amount on file)',
    timesheet: expected == null ? 'No rate on file' : usd(expected),
    invoice: usd(x.invoice.total),
    difference: expected == null || sameTotal ? '' : signed(x.invoice.total - expected, usd),
    check: expected == null ? 'on-file' : sameTotal ? 'match' : 'differs',
  }
  if (expected != null && !sameTotal) diffs.push(`comes to ${usd(x.invoice.total - expected)} ${x.invoice.total > expected ? 'more' : 'less'} than ${x.pay.kind === 'hourly' ? 'the approved hours at the rate on file' : 'the amount on file'}`)
  const matches = !diffs.length && expected != null
  const summary = diffs.length ? `It ${diffs.join(', and ')}.` : expected == null ? 'There is no rate or amount on file to check the total against.' : null
  return { rows, total, matches, summary }
}

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
