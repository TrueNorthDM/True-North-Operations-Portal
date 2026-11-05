/**
 * An invoice's record: who made it, how it checks against the timesheet, and
 * everything that happened to it (owner, 4 November 2026). It is the second
 * page of the invoice's PDF, the one copied to Google Drive for Finance, so
 * the copy carries who made the invoice and its history inside the file: page
 * 1 is the contractor's invoice (the builder's sheet, or their own PDF exactly
 * as they sent it), page 2 is what True North adds to its copy. The invoice's
 * page shows the same "Who made it" card and history versions.
 *
 *   buildInvoiceRecord   pure: the page from what was read (tested)
 *   loadInvoiceRecord    reads the invoice, every version sent (invoice_sends,
 *                        migration 152), the check (invoice-check-data.ts) and
 *                        the decisions (tc_approval_events)
 *
 * Money: call it only for someone who sees this person's pay (seesMoney), or
 * from the server's own jobs. Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { madeByLine, type Check, type Comparison, type CompareRow, type MadeBy } from './contractor-invoice'
import { loadInvoiceCheck, loadInvoiceSends, type InvoiceSendRow } from './invoice-check-data'
import { dateLabel, initials as initialsOf, localDate, stampLabel, timeLabel } from './format'
import { usd } from './invoice-doc'
import { periodLabel } from './periods'

// ── The page, as drawn ──────────────────────────────────────────────────────

/** One row of "Who made it": a label and its value, the name in bold when there is one. */
export interface RecordFact { label: string; strong?: string; text: string }

export interface RecordCheckRow { label: string; timesheet: string; invoice: string; check: Check; word: string }

export interface RecordWho {
  /** The sender (the contractor), or the portal for an invoice it made. */
  name: string
  initials: string
  /** "Sent by the contractor, Jordan Lee" */
  headline: string
  /** "Nov 2, 2026 at 9:14 AM (New York)" */
  sentOn: string | null
  /** The address they were signed in with, or the one the invoice form was sent with. */
  email: { label: string; value: string } | null
  /** madeByLine: "Built by Jordan Lee with the portal's invoice builder", "Their own file, "x.pdf"". */
  how: string
  /** The sentence they ticked, word for word. */
  confirmed: string | null
  /** "Invoice 0142 · 160.50 hours · $4,096.70": what their invoice says. */
  numbers: string | null
}

export interface InvoiceRecordView {
  number: string
  /** The contractor whose invoice it is. */
  name: string
  madeBy: MadeBy | null
  /** Their own file's name, as they sent it (own_file). */
  ownFileName: string | null
  who: RecordWho
  /** "Who made it" as the PDF's two columns. */
  facts: RecordFact[]
  check: { rows: RecordCheckRow[]; total: RecordCheckRow; matches: boolean; summary: string | null; note?: string | null } | null
  /** Oldest first, as a record reads. */
  history: { when: string; text: string }[]
  /** "Nov 10, 2026, 2:30 PM": the last thing that happened to it. */
  asOf: string
  /** Page 1's footer, under the builder's sheet. */
  footLine: string
}

// ── Pure ────────────────────────────────────────────────────────────────────

export const RECORD_ZONE = 'America/New_York'

/** "New York" from "America/New_York": the zone a time on the record is in. */
export const zoneCity = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

/** "Nov 2, 2026 at 9:14 AM (New York)" */
export const sentOnLabel = (t: string, zone: string): string => `${dateLabel(localDate(t, zone))} at ${timeLabel(t, zone)} (${zoneCity(zone)})`

/** "Nov 1, 6:02 PM": a history time, the year left out (the record's own year says it). */
export const shortStamp = (t: string, zone: string): string => `${dateLabel(localDate(t, zone)).replace(/, \d{4}$/, '')}, ${timeLabel(t, zone)}`

/** The Check column's word for a row of the comparison. */
export function checkWord(r: Pick<CompareRow, 'check' | 'invoice' | 'timesheet'>): string {
  switch (r.check) {
    case 'match': return 'Matches'
    case 'differs': return 'Differs'
    case 'only-timesheet': return 'Not on invoice'
    case 'only-invoice': return 'Not on timesheet'
    default: return r.invoice === 'On their file' ? 'On their file' : r.timesheet === 'No rate on file' ? 'No rate on file' : 'Not checked'
  }
}

/** "160.50 hours" */
const hoursText = (h: number) => `${h.toFixed(2)} hours`

/** "Invoice 0142 · 160.50 hours · $4,096.70": their number, hours and total, the parts that are there. */
export function numbersLine(x: { theirNumber: string | null; hours: number | null; total: number | null }): string | null {
  const parts = [x.theirNumber ? `Invoice ${x.theirNumber}` : null, x.hours != null && x.hours > 0 ? hoursText(x.hours) : null, x.total != null ? usd(x.total) : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** "Who made it" as the PDF's rows. */
export function recordFacts(w: RecordWho, madeBy: MadeBy | null, contractor: string, madeOn?: string): RecordFact[] {
  if (!madeBy) return [{ label: 'Made by', text: w.how }, ...(madeOn ? [{ label: 'Made on', text: madeOn }] : [])]
  const facts: RecordFact[] = [{ label: 'Made and sent by', strong: w.name, text: w.name === contractor ? ', the contractor' : `, for ${contractor}` }]
  if (w.sentOn) facts.push({ label: 'Sent on', text: w.sentOn })
  if (w.email) facts.push({ label: w.email.label, text: w.email.value })
  facts.push({ label: 'How', text: w.how })
  if (w.confirmed) facts.push({ label: 'Confirmed', text: `"${w.confirmed}"` })
  if (w.numbers) facts.push({ label: 'Their numbers', text: w.numbers })
  return facts
}

export interface RecordInvoice {
  number: string
  person_id: string
  submission_id: number | null
  kind: string
  state: string
  source: string | null
  period_start: string
  period_end: string
  created_at: string
  total: number
  paid_on: string | null
  paid_ref: string | null
  made_by: string | null
  sent_by: string | null
  sent_at: string | null
  sent_from: string | null
  confirmed_text: string | null
  their_number: string | null
  stated_hours: number | null
  stated_total: number | null
  own_pdf_name: string | null
}

export type RecordEvent = { step: string; action: string; by_person: string | null; at: string; note: string | null }

export interface RecordSource {
  inv: RecordInvoice
  /** The contractor's name (the invoice's From, else the Directory). */
  name: string
  sends: readonly InvoiceSendRow[]
  events: readonly RecordEvent[]
  /** Hours on the builder's lines, in hours (the own file's are what they typed). */
  lineHours: number | null
  check: Comparison | null
  nameOf: (id: string | null | undefined) => string
  zone: string
}

const quoted = (note: string | null) => (note ? `: "${note}"` : '')
/** A sentence's full stop, unless a quoted note already ends with one. */
const end = (t: string) => (/[.!?]"$/.test(t) ? t : `${t}.`)

/** The record of one invoice. Pure. */
export function buildInvoiceRecord(src: RecordSource): InvoiceRecordView {
  const { inv, zone } = src
  const madeBy = (inv.made_by === 'own_file' || inv.made_by === 'builder' ? inv.made_by : null) as MadeBy | null
  const latest = src.sends.at(-1)
  const period = periodLabel({ start: inv.period_start, end: inv.period_end })
  const who = (id: string | null | undefined) => (id ? src.nameOf(id) : src.name)

  // ── Who made it
  const sender = madeBy ? who(inv.sent_by ?? latest?.sentBy) : 'The True North Operations Portal'
  const viaForm = (inv.sent_from ?? latest?.sentFrom) === 'form'
  const email = latest?.sentEmail ? { label: viaForm ? 'Email on the form' : 'Signed in as', value: latest.sentEmail } : null
  const sentAt = inv.sent_at ?? latest?.at ?? null
  const legacyHow = inv.source ? `Sent through the invoice form${inv.own_pdf_name ? `, with their own file "${inv.own_pdf_name}"` : ''} (before November 2026)`
    : inv.kind === 'fixed_no_timesheet' ? 'Made by the portal by itself, fixed monthly (before November 2026)'
      : madeByLine(null, src.name)
  const ownHours = inv.stated_hours ?? latest?.statedHours ?? null
  const w: RecordWho = {
    name: sender,
    initials: madeBy ? initialsOf(sender) : 'TN',
    headline: !madeBy ? legacyHow : sender === src.name ? `Sent by the contractor, ${sender}` : `Sent by ${sender}, for ${src.name}`,
    sentOn: madeBy && sentAt ? sentOnLabel(sentAt, zone) : null,
    email: madeBy ? email : null,
    how: madeBy ? madeByLine(madeBy, sender, inv.own_pdf_name ?? latest?.ownPdfName) : legacyHow,
    confirmed: madeBy ? inv.confirmed_text ?? latest?.confirmed ?? null : null,
    numbers: madeBy
      ? numbersLine({
        theirNumber: inv.their_number ?? latest?.theirNumber ?? null,
        hours: madeBy === 'own_file' ? ownHours : src.lineHours,
        total: madeBy === 'own_file' ? (inv.stated_total ?? latest?.statedTotal ?? Number(inv.total)) : Number(inv.total),
      })
      : null,
  }

  // ── The history, oldest first
  const hist: { t: string; text: string; i: number }[] = []
  const add = (t: string, text: string) => hist.push({ t, text, i: hist.length })
  const legacy = !madeBy && !src.sends.length
  const made = Date.parse(inv.created_at)
  if (legacy) {
    add(inv.created_at, inv.source ? `${src.name} sent it through the invoice form.`
      : inv.kind === 'fixed_no_timesheet' ? `The portal made it by itself for ${period.full} (fixed monthly).`
        : `The portal made it from the ${period.label} timesheet.`)
  }
  src.sends.forEach((s, i) => {
    const what = s.theirNumber ? `invoice ${s.theirNumber}` : `invoice ${inv.number}`
    const how = s.madeBy === 'own_file' ? `, their own file${s.ownPdfName ? ` "${s.ownPdfName}"` : ''}` : ', made with the invoice builder'
    add(s.at, `${who(s.sentBy)} sent ${what}${i ? ' again' : ''}${how}${s.sentFrom === 'form' ? ', through the invoice form' : ''}.`)
  })
  for (const e of src.events) {
    const by = e.by_person ? src.nameOf(e.by_person) : null
    if (e.action === 'submit' || e.action === 'record' || e.action === 'sent') {
      // The invoice's own sends are the versions above; the one that made a legacy invoice is its first line.
      if (src.sends.length && (e.step === 'invoice' || e.action === 'sent')) continue
      if (legacy && Math.abs(Date.parse(e.at) - made) < 60_000) continue
      if (e.action === 'sent') add(e.at, `${by ?? src.name} sent the invoice.`)
      else if (inv.submission_id != null && e.step !== 'invoice') add(e.at, `${by ?? src.name} sent the ${period.label} timesheet.`)
      else add(e.at, by ? `${by} sent it again.` : `${src.name} sent it again through the invoice form.`)
    } else if (e.action === 'approve') {
      const what = e.step === 'hours' ? 'the hours' : e.step === 'both' ? 'the hours and the invoice' : 'the invoice'
      add(e.at, end(`${by ?? 'The portal'} approved ${what}${quoted(e.note)}`))
    } else if (e.action === 'return') {
      const what = e.step === 'hours' ? 'the hours' : e.step === 'both' ? (inv.submission_id != null ? 'the timesheet and the invoice' : 'the invoice') : 'the invoice'
      add(e.at, end(`${by ?? 'The portal'} sent ${what} back${quoted(e.note)}`))
    } else if (e.action === 'reopen') {
      add(e.at, end(`${by ?? 'The portal'} reopened it${quoted(e.note)}`))
    } else if (e.action === 'paid') {
      const day = inv.paid_on ?? localDate(e.at, zone)
      add(e.at, `${by ?? 'Finance'} (Finance) marked it paid on ${dateLabel(day).replace(/, \d{4}$/, '')}${inv.paid_ref ? `, reference ${inv.paid_ref}` : ''}.`)
    }
  }
  hist.sort((a, b) => a.t.localeCompare(b.t) || a.i - b.i)
  const last = [inv.created_at, sentAt, ...src.sends.map(s => s.at), ...src.events.map(e => e.at)].filter((x): x is string => !!x).sort().at(-1)!

  const row = (r: CompareRow): RecordCheckRow => ({ label: r.label, timesheet: r.timesheet, invoice: r.invoice, check: r.check, word: checkWord(r) })
  return {
    number: inv.number,
    name: src.name,
    madeBy,
    ownFileName: inv.own_pdf_name ?? latest?.ownPdfName ?? null,
    who: w,
    facts: recordFacts(w, madeBy, src.name, sentOnLabel(inv.created_at, zone)),
    check: src.check ? { rows: src.check.rows.map(row), total: row(src.check.total), matches: src.check.matches, summary: src.check.summary, note: src.check.note ?? null } : null,
    history: hist.map(h => ({ when: shortStamp(h.t, zone), text: h.text })),
    asOf: stampLabel(last, zone),
    footLine: madeBy === 'builder' ? `Invoice by ${src.name}, made with the True North portal's invoice builder.` : 'Made by the True North Operations Portal',
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

const REC_COLS = 'number, person_id, submission_id, kind, state, source, period_start, period_end, created_at, total, paid_on, paid_ref, made_by, sent_by, sent_at, sent_from, confirmed_text, their_number, stated_hours, stated_total, own_pdf_name, from_snapshot'

/**
 * One invoice's record; null when there is no such invoice. Throws when the
 * history cannot be read (a record with a gap would be wrong in Finance's copy).
 */
export async function loadInvoiceRecord(invoiceId: number, opts: { zone?: string; nameOf: (id: string | null | undefined) => string; now?: Date }): Promise<InvoiceRecordView | null> {
  const c = createAdminClient()
  const { data, error } = await c.from('invoices').select(REC_COLS).eq('id', invoiceId).maybeSingle()
  if (error) throw new Error(`The invoice could not be read: ${error.message}`)
  if (!data) return null
  const inv = data as unknown as RecordInvoice & { from_snapshot: { name?: string } | null }
  const evQ = c.from('tc_approval_events').select('step, action, by_person, at, note')
  const [sends, check, events, lines] = await Promise.all([
    loadInvoiceSends(invoiceId),
    loadInvoiceCheck(invoiceId, opts.now),
    // The timesheet's decisions and the invoice's own; one row may carry both ids.
    inv.submission_id != null ? evQ.or(`submission_id.eq.${inv.submission_id},invoice_id.eq.${invoiceId}`).order('at') : evQ.eq('invoice_id', invoiceId).order('at'),
    c.from('invoice_lines').select('hours_seconds').eq('invoice_id', invoiceId).eq('kind', 'hours'),
  ])
  if (events.error) throw new Error(`The invoice history could not be read: ${events.error.message}`)
  let evs = (events.data ?? []) as RecordEvent[]
  // A legacy invoice was made again with the timesheet: what came before it is the timesheet's, not the invoice's (as its page reads it).
  if (!inv.made_by && !sends.length && inv.submission_id != null) evs = evs.filter(e => Date.parse(e.at) >= Date.parse(inv.created_at) - 60_000)
  const seconds = (lines.data ?? []).reduce((n, l) => n + (l.hours_seconds ?? 0), 0)
  return buildInvoiceRecord({
    inv: { ...inv, total: Number(inv.total), stated_hours: inv.stated_hours == null ? null : Number(inv.stated_hours), stated_total: inv.stated_total == null ? null : Number(inv.stated_total) },
    name: inv.from_snapshot?.name || opts.nameOf(inv.person_id),
    sends, events: evs, lineHours: seconds ? seconds / 3600 : null, check,
    nameOf: opts.nameOf, zone: opts.zone ?? RECORD_ZONE,
  })
}
