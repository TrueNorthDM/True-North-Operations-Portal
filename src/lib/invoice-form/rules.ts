/**
 * The invoice form's rules (owner, 1 November 2026, forms mockup v3,
 * decisions A to G), pure: the code a sender proves their email with, the
 * Monday items and the one rule against sending one twice, one invoice a
 * month, the deliverable rates, the invoice's lines and total, and the check
 * of everything a sender types. The public page and the route that stores an
 * invoice decide with these, so they never disagree; the tests hold them.
 *
 * Money in cents, so totals never drift. Every invoice is in US dollars.
 */

import { dateLabel } from '@/lib/timeclock/format'
import { CATEGORIES, MEAL_REASON_ERROR, MILEAGE, mealReasonMissing, mileageAmount, mileageNote, milesOf, needsReceipt } from '@/lib/timeclock/reimbursement-rules'
// Types only: the page imports this file, and contractor-invoice.ts reaches the database.
import type { BuilderLine, MadeBy, SendRecord } from '@/lib/timeclock/contractor-invoice'

// ── The code (decision A) ──────────────────────────────────────────────────

/** A code works for 10 minutes. */
export const CODE_LIFE_MS = 10 * 60_000
/** Five wrong tries and that code is done: a new one is needed. */
export const MAX_TRIES = 5
/** "Send it again" only after a minute. */
export const RESEND_AFTER_MS = 60_000
/** At most five codes an hour for one email, and for one network address. */
export const CODES_PER_HOUR = 5
/** The device remembers the email for 30 days. */
export const DEVICE_DAYS = 30

export type CodeVerdict = 'ok' | 'none' | 'expired' | 'used' | 'locked'

/** Whether the newest code of an email can still be tried. */
export function codeVerdict(row: { tries: number; expires_at: string; used_at: string | null } | null, now = Date.now()): CodeVerdict {
  if (!row) return 'none'
  if (row.used_at) return 'used'
  if (row.tries >= MAX_TRIES) return 'locked'
  if (Date.parse(row.expires_at) <= now) return 'expired'
  return 'ok'
}

/** Seconds left before "send it again" works (0: now). */
export function resendWait(lastSentAt: string | null, now = Date.now()): number {
  if (!lastSentAt) return 0
  return Math.max(0, Math.ceil((Date.parse(lastSentAt) + RESEND_AFTER_MS - now) / 1000))
}

/** Too many codes in the last hour, for the email or for the network address. */
export const overCodeCap = (forEmail: number, forClient: number): boolean => forEmail >= CODES_PER_HOUR || forClient >= CODES_PER_HOUR

/** Six digits, as typed (spaces allowed); else null. */
export function codeOf(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, '')
  return /^\d{6}$/.test(s) ? s : null
}

/**
 * An email as typed: trimmed, lower case, not too long, and in the plain
 * address shape the Directory is searched with (lib/auth/mailbox-filter.ts),
 * so it can never carry filter syntax; else null.
 */
export function emailOf(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  return s.length <= 200 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null
}

// ── How they are paid, and the Monday items ────────────────────────────────

export type FormKind = 'fixed' | 'deliverables'
export type FormSource = 'form_fixed' | 'form_deliverables'
export type Deliverable = 'page' | 'asset'

export const sourceOf = (k: FormKind): FormSource => (k === 'fixed' ? 'form_fixed' : 'form_deliverables')
export const kindOfSource = (s: string | null | undefined): FormKind | null => (s === 'form_fixed' ? 'fixed' : s === 'form_deliverables' ? 'deliverables' : null)

/** The choice on a line ("Translated page · $30") and the line's tag ("Page"). */
export const DELIVERABLE_LABEL: Record<Deliverable, string> = { page: 'Translated page', asset: 'Design asset' }
export const DELIVERABLE_TAG: Record<Deliverable, string> = { page: 'Page', asset: 'Design asset' }
/** In a sentence: "was already sent as a design asset". */
const DELIVERABLE_WORD: Record<Deliverable, string> = { page: 'translated page', asset: 'design asset' }

export const isDeliverable = (k: unknown): k is Deliverable => k === 'page' || k === 'asset'

/** A Monday item's name as it reads: trimmed, one space between words. */
export const itemName = (raw: string): string => raw.normalize('NFKC').trim().replace(/\s+/g, ' ')

/** The item as compared: its name as it reads, in lower case. "  Homepage  FAQ " and "homepage faq" are one item. */
export const itemKey = (raw: string): string => itemName(raw).toLowerCase()

/** "Oct 28", or "Oct 28, 2025" when it was another year. */
const sentDay = (iso: string, today: string) => (iso.slice(0, 4) === today.slice(0, 4) ? dateLabel(iso).replace(/, \d{4}$/, '') : dateLabel(iso))

/** The one message for an item sent before: the item and the day, nothing about who. */
export const alreadySentText = (name: string, kind: Deliverable, sentOn: string, today: string): string =>
  `"${itemName(name)}" was already sent as a ${DELIVERABLE_WORD[kind]} on ${sentDay(sentOn, today)}.`

/** What was sent before: an item's key and kind, and the day. */
export interface SentItem { key: string; kind: Deliverable; sentOn: string }

/**
 * The first line that cannot go: the same item and kind twice on this
 * invoice, or sent before by anyone (decision G and the owner's rule: one
 * Monday item is paid once a kind). Null when every line can go.
 */
export function firstDuplicate(items: readonly { name: string; kind: Deliverable }[], sent: readonly SentItem[], today: string): { index: number; error: string } | null {
  const seen = new Set<string>()
  for (const [index, it] of items.entries()) {
    const k = `${it.kind}:${itemKey(it.name)}`
    if (seen.has(k)) return { index, error: `"${itemName(it.name)}" is on this invoice twice as a ${DELIVERABLE_WORD[it.kind]}.` }
    seen.add(k)
    const before = sent.filter(s => s.kind === it.kind && s.key === itemKey(it.name)).sort((a, b) => a.sentOn.localeCompare(b.sentOn))[0]
    if (before) return { index, error: alreadySentText(it.name, it.kind, before.sentOn, today) }
  }
  return null
}

// ── The rates ──────────────────────────────────────────────────────────────

export interface Rates { page: number; asset: number }

/** The rate of a line: the person's own when set (Rates & Costs), else the company's. */
export function rateFor(kind: Deliverable, company: Rates, own?: { page: number | null; asset: number | null } | null): number {
  const mine = kind === 'page' ? own?.page : own?.asset
  return mine != null && mine > 0 ? mine : company[kind]
}

/** Both rates for one sender. */
export const ratesFor = (company: Rates, own?: { page: number | null; asset: number | null } | null): Rates =>
  ({ page: rateFor('page', company, own), asset: rateFor('asset', company, own) })

// ── The month (decision C) ─────────────────────────────────────────────────

/** "2026-10", the month that just ended, from today's "2026-11-01". */
export function lastMonth(today: string): string {
  const [y, m] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

/** The first and last day of a month. */
export function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  return { start: `${ym}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
}

/** A month that can be invoiced: this month or one of the twelve before it. */
export function monthOk(ym: string, today: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return false
  const now = today.slice(0, 7)
  const [y, m] = now.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 13, 1)).toISOString().slice(0, 7)
  return ym <= now && ym >= first
}

export type MonthState = { kind: 'free' } | { kind: 'again'; invoiceId: number; number: string } | { kind: 'taken' }

/**
 * One invoice a sender a month, for both kinds: a month with a form invoice
 * waiting, approved or paid (or a submission waiting for the Directory) is
 * taken; one that was returned (Draft) is sent again, as the same invoice.
 */
export function monthState(invoices: readonly { id: number; number: string; state: string }[], submissionWaiting: boolean): MonthState {
  if (submissionWaiting) return { kind: 'taken' }
  if (invoices.some(i => i.state !== 'draft')) return { kind: 'taken' }
  const back = invoices.find(i => i.state === 'draft')
  return back ? { kind: 'again', invoiceId: back.id, number: back.number } : { kind: 'free' }
}

/** The refusal for a month already sent, with where to write. */
export const monthTakenText = (monthName: string, financeEmail: string | null): string =>
  `You already sent an invoice for ${monthName}. One invoice a month: to change it, write to Finance${financeEmail ? ` at ${financeEmail}` : ''}.`

// ── The lines ──────────────────────────────────────────────────────────────

/** A reimbursement on the invoice, as checked (the receipt is stored apart). */
export interface FormReimbursement {
  event: string | null
  spentOn: string
  category: string
  amount: number
  currency: 'USD'
  purpose: string
  client: string | null
  billable: boolean
  miles: number | null
  mileageRate: number | null
  /** Which uploaded file is its receipt (receipt_<n>); null for mileage without one. */
  file: number | null
}

export type FormWork =
  | { kind: 'fixed'; covers: string; amount: number }
  | { kind: 'deliverables'; items: { name: string; kind: Deliverable }[] }

/** One line of the invoice, as invoice_lines keeps it. `reimbursement` is its index in the reimbursements. */
export interface FormLine {
  kind: 'fixed' | 'deliverable' | 'reimbursement'
  client: string | null
  description: string
  rate: number | null
  amount: number
  deliverableKind: Deliverable | null
  deliverableKey: string | null
  reimbursement: number | null
  sort: number
}

const cents = (n: number) => Math.round(n * 100)
const money = (c: number) => c / 100

/** The work lines first, then each reimbursement as its own line (like approved ones on a timesheet invoice), and the total. */
export function buildFormLines(work: FormWork, rates: Rates, reimbursements: readonly Pick<FormReimbursement, 'category' | 'purpose' | 'amount'>[] = []): { lines: FormLine[]; total: number } {
  const lines: FormLine[] = []
  if (work.kind === 'fixed') {
    lines.push({ kind: 'fixed', client: null, description: work.covers.trim(), rate: null, amount: money(cents(work.amount)), deliverableKind: null, deliverableKey: null, reimbursement: null, sort: 0 })
  } else {
    for (const it of work.items) {
      const rate = rates[it.kind]
      lines.push({
        kind: 'deliverable', client: null, description: `${itemName(it.name)} (${DELIVERABLE_WORD[it.kind]})`, rate, amount: money(cents(rate)),
        deliverableKind: it.kind, deliverableKey: itemKey(it.name), reimbursement: null, sort: lines.length,
      })
    }
  }
  reimbursements.forEach((r, i) => {
    lines.push({ kind: 'reimbursement', client: r.category, description: r.purpose, rate: null, amount: money(cents(r.amount)), deliverableKind: null, deliverableKey: null, reimbursement: i, sort: lines.length })
  })
  return { lines, total: money(lines.reduce((s, l) => s + cents(l.amount), 0)) }
}

// ── Everything a sender types ──────────────────────────────────────────────

/** The most a form invoice can carry, so a typo never sends a fortune. */
export const MAX_FIXED = 100_000
/** The most the total on their own invoice can say (reimbursements included). */
export const MAX_STATED = 200_000
export const MAX_ITEMS = 200
export const MAX_RECEIPTS = 20
export const MAX_FILE = 10 * 1024 * 1024
/** The server takes bodies up to 50 MB; a send stays under it. */
export const MAX_TOTAL_FILES = 45 * 1024 * 1024

/** The receipt file types the portal keeps (the receipts bucket, migration 117). */
export const RECEIPT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'application/pdf': 'pdf' }

export interface SenderInput { name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string }

/** What the page sends with the files, as the browser sent it (unchecked). */
export interface RawSubmission {
  month?: unknown
  kind?: unknown
  sender?: Partial<Record<keyof SenderInput, unknown>> | null
  /** "Use these" on a found sender's details: they go on their record too. */
  saveToRecord?: unknown
  covers?: unknown
  amount?: unknown
  items?: unknown
  reimbursements?: unknown
  /** How they send it (leadership, 4 November 2026): 'own_file' or 'builder'. */
  madeBy?: unknown
  /** Own file: their invoice number (optional) and the total on it. */
  theirNumber?: unknown
  statedTotal?: unknown
  /** The box "This is my invoice..." ticked. Only true counts; the sentence is never taken from the page. */
  confirmed?: unknown
}

export interface CheckedSubmission {
  month: string
  kind: FormKind
  sender: SenderInput
  saveToRecord: boolean
  work: FormWork
  reimbursements: FormReimbursement[]
  madeBy: MadeBy
  /** Own file: what they typed beside their PDF. Null when it was filled in here. */
  own: { theirNumber: string | null; statedTotal: number } | null
}

export interface CheckContext {
  /** Today, YYYY-MM-DD. */
  today: string
  /** The clients a reimbursement may name (Requests' list). */
  clients: readonly string[]
  mileageRate: number
  /** The files sent, by their number (receipt_<n>). */
  files: ReadonlySet<number>
  /** Whether the country is one the address picker knows. */
  countryOk: (code: string) => boolean
  /** Their own PDF came with the send and passed the file checks (type, size, %PDF- header). */
  ownPdf: boolean
}

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const amountOf = (v: unknown) => Number(String(v ?? '').replace(/[$,\s]/g, ''))
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** Every field of a send, checked on the server. The first problem, in the sender's words. */
export function checkSubmission(raw: RawSubmission, ctx: CheckContext): { ok: true; value: CheckedSubmission } | { ok: false; error: string } {
  const no = (error: string) => ({ ok: false as const, error })
  const month = String(raw?.month ?? '')
  if (!monthOk(month, ctx.today)) return no('Pick the month the invoice is for: this month or one of the last twelve.')
  const kind = raw?.kind === 'fixed' || raw?.kind === 'deliverables' ? raw.kind : null
  if (!kind) return no('Choose how you are paid: Fixed amount or Deliverables.')

  const s = raw?.sender ?? {}
  const sender: SenderInput = {
    name: str(s.name, 120), line1: str(s.line1, 200), line2: str(s.line2, 200), city: str(s.city, 100),
    state: str(s.state, 100), zip: str(s.zip, 30), country: str(s.country, 2).toUpperCase(),
  }
  if (sender.name.length < 2) return no('Write your full name.')
  if (!sender.line1 || !sender.city) return no('Write your address: the street and the city.')
  if (!/^[A-Z]{2}$/.test(sender.country) || !ctx.countryOk(sender.country)) return no('Choose your country.')

  // Every contractor makes and sends their own invoice (leadership, 4 November
  // 2026): their own PDF, or the lines they write here. Either way it is theirs.
  const madeBy: MadeBy | null = raw?.madeBy === 'own_file' || raw?.madeBy === 'builder' ? raw.madeBy : null
  if (!madeBy) return no('Choose how you send your invoice: My own file or Fill it in here.')
  let own: CheckedSubmission['own'] = null
  if (madeBy === 'own_file') {
    if (!ctx.ownPdf) return no('Add your invoice: a PDF of up to 10 MB.')
    const statedTotal = amountOf(raw?.statedTotal)
    if (!(statedTotal > 0) || statedTotal > MAX_STATED) return no(`Write the total on your invoice in US dollars, more than 0 and up to $${MAX_STATED.toLocaleString('en-US')}.`)
    own = { theirNumber: str(raw?.theirNumber, 60) || null, statedTotal: money(cents(statedTotal)) }
  }

  let work: FormWork
  if (kind === 'fixed') {
    const covers = str(raw?.covers, 500)
    if (covers.length < 3) return no(own ? 'Say what your invoice covers.' : 'Say what the amount covers.')
    if (own) {
      // Their total holds everything on their invoice: the work is what is left after the reimbursements (read below).
      work = { kind, covers, amount: own.statedTotal }
    } else {
      const amount = amountOf(raw?.amount)
      if (!(amount > 0) || amount > MAX_FIXED) return no(`Write the amount in US dollars, more than 0 and up to $${MAX_FIXED.toLocaleString('en-US')}.`)
      work = { kind, covers, amount: money(cents(amount)) }
    }
  } else {
    const list = Array.isArray(raw?.items) ? raw.items : []
    if (!list.length) return no('Add at least one line: the Monday item and what it is.')
    if (list.length > MAX_ITEMS) return no(`Send up to ${MAX_ITEMS} lines on one invoice.`)
    const items: { name: string; kind: Deliverable }[] = []
    for (const [i, it] of list.entries()) {
      const o = (it ?? {}) as { name?: unknown; kind?: unknown }
      const name = itemName(String(o.name ?? '')).slice(0, 200)
      if (name.length < 2) return no(`Line ${i + 1}: paste the Monday item's name.`)
      if (!isDeliverable(o.kind)) return no(`Line ${i + 1}: choose Translated page or Design asset.`)
      items.push({ name, kind: o.kind })
    }
    work = { kind, items }
  }

  const rawR = Array.isArray(raw?.reimbursements) ? raw.reimbursements : []
  if (rawR.length > MAX_RECEIPTS) return no(`Add up to ${MAX_RECEIPTS} reimbursements to one invoice.`)
  const reimbursements: FormReimbursement[] = []
  const usedFiles = new Set<number>()
  for (const [i, r0] of rawR.entries()) {
    const r = (r0 ?? {}) as Record<string, unknown>
    const n = `Receipt ${i + 1}: `
    const category = String(r.category ?? '')
    if (!CATEGORIES.includes(category)) return no(`${n}pick a category.`)
    const file = r.file == null || r.file === '' ? null : Number(r.file)
    if (file != null && (!Number.isInteger(file) || !ctx.files.has(file) || usedFiles.has(file))) return no(`${n}add the receipt again.`)
    if (file != null) usedFiles.add(file)
    if (file == null && needsReceipt(category)) return no(`${n}add the receipt: a photo or a PDF.`)
    const spentOn = String(r.date ?? '')
    if (!isDay(spentOn)) return no(`${n}write the date of the expense.`)
    if (spentOn > ctx.today) return no(`${n}the expense date cannot be after today.`)
    let purpose = str(r.purpose, category === MILEAGE ? 440 : 500)
    if (!purpose) return no(`${n}write the description of the expense.`)
    let amount: number, miles: number | null = null, mileageRate: number | null = null
    if (category === MILEAGE) {
      miles = milesOf(String(r.miles ?? ''))
      if (miles == null) return no(`${n}write the miles, like 120.`)
      mileageRate = ctx.mileageRate
      amount = mileageAmount(miles, mileageRate)
      purpose += mileageNote(miles, mileageRate)
    } else {
      amount = amountOf(r.amount)
      if (!(amount > 0 && amount < 100_000)) return no(`${n}write the amount, like 35.00.`)
      if (String(r.currency ?? 'USD').toUpperCase() !== 'USD') return no(`${n}write the amount in US dollars: the invoice is in USD.`)
      // Over the $25 a meal: it goes, for review, when the description says why (owner, 5 November 2026).
      if (mealReasonMissing(category, amount, 'USD', purpose)) return no(`${n}${MEAL_REASON_ERROR}`)
    }
    const clientRaw = str(r.client, 200)
    const client = clientRaw && clientRaw !== 'None' ? clientRaw : null
    if (client && !ctx.clients.includes(client)) return no(`${n}pick a client or project from the list.`)
    reimbursements.push({
      event: str(r.event, 120) || null, spentOn, category, amount: money(cents(amount)), currency: 'USD', purpose,
      client, billable: !!client && (r.billable === true || r.billable === 'yes'), miles, mileageRate, file,
    })
  }

  if (own && work.kind === 'fixed') {
    const rest = cents(own.statedTotal) - reimbursements.reduce((n, r) => n + cents(r.amount), 0)
    if (rest <= 0) return no('The total on your invoice must be more than the reimbursements on it.')
    work = { ...work, amount: money(rest) }
  }

  // Never sent without the box ticked (the page asks the same; the route builds the sentence itself).
  if (raw?.confirmed !== true) return no('Tick the box to confirm this is your invoice.')

  return { ok: true, value: { month, kind, sender, saveToRecord: raw?.saveToRecord === true, work, reimbursements, madeBy, own } }
}

/**
 * Where the month goes in the sentence they tick: the page gets the sentence
 * from confirmText (contractor-invoice.ts, which the browser cannot load) with
 * this in place of the month, and puts the month in.
 */
export const MONTH_SLOT = '{month}'

/** The sentence with the month in: "...to True North for October 2026." */
export const withMonth = (template: string, monthName: string): string => template.split(MONTH_SLOT).join(monthName)

/**
 * The invoice a send makes: its lines and its total. Filled in here, the
 * total adds the lines up (the rates for deliverables). Their own file, the
 * total is the one on it (stated_total, leadership 4 November 2026); the
 * Monday items stay as lines at the rates so the approver can compare the two.
 */
export function formInvoice(sub: Pick<CheckedSubmission, 'work' | 'reimbursements' | 'own'>, rates: Rates): { lines: FormLine[]; total: number } {
  const built = buildFormLines(sub.work, rates, sub.reimbursements)
  return sub.own ? { lines: built.lines, total: sub.own.statedTotal } : built
}

/**
 * The record of one send from the form (contractor-invoice.ts keeps it on the
 * invoice and in invoice_sends). `confirmed` is the sentence the server built
 * from the way and the month, never text from the browser. The lines are the
 * ones they wrote here; an own file has none of its own (its items stay on
 * the invoice's lines).
 */
export function formRecord(
  sub: Pick<CheckedSubmission, 'madeBy' | 'own' | 'work' | 'reimbursements'>,
  x: { rates: Rates; sentBy: string | null; email: string; confirmed: string; ownPdf: { path: string; name: string } | null },
): SendRecord {
  const { lines, total } = formInvoice(sub, x.rates)
  const builderLines: BuilderLine[] = sub.madeBy === 'own_file' ? [] : lines.map(l => ({
    description: l.kind === 'reimbursement' ? `Reimbursement: ${l.client}, ${l.description}` : l.description,
    client: null, hours: null, rate: null, amount: l.amount,
  }))
  return {
    madeBy: sub.madeBy, sentFrom: 'form', sentBy: x.sentBy, sentEmail: x.email, confirmed: x.confirmed,
    theirNumber: sub.own?.theirNumber ?? null, statedHours: null, statedTotal: sub.own?.statedTotal ?? null,
    covers: sub.work.kind === 'fixed' ? sub.work.covers : null,
    ownPdf: sub.madeBy === 'own_file' ? x.ownPdf : null,
    lines: builderLines, total,
  }
}

/** "We keep it as you sent it, with a note that you sent it on Nov 4, 2026 at 3:12 PM." The thank-you page's line. */
export function keptText(madeBy: MadeBy, sentAt: string, zone: string): string {
  const d = new Date(sentAt)
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: zone })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
  return madeBy === 'own_file'
    ? `We keep your file as you sent it, with a note that you sent it on ${day} at ${time}.`
    : `We keep it as you sent it, with a note that you wrote it here and sent it on ${day} at ${time}.`
}

/** "The invoice form, fixed amount", "The invoice form, deliverables, 3 lines": the invoice view's "Came from". Null for any other invoice. */
export function cameFrom(source: string | null | undefined, deliverableLines: number): string | null {
  if (source === 'form_fixed') return 'The invoice form, fixed amount'
  if (source === 'form_deliverables') return `The invoice form, deliverables, ${deliverableLines} line${deliverableLines === 1 ? '' : 's'}`
  return null
}

/**
 * Who links a new sender's invoice to a person (decision B): the default
 * approver, and Super Admins and Admins, where Invoices is open to them. Who
 * may see one waiting: those, and Finance. Never Team Leaders (they never see
 * money).
 */
export function newSenderRights(a: { personId: string | null; isAdmin: boolean; level?: string; can: (k: string) => boolean }, s: { defaultApprover: string | null; finance: readonly string[] }): { see: boolean; link: boolean } {
  if (!a.can('clocky-invoices') || !a.personId || a.level === 'team_leader') return { see: false, link: false }
  const link = a.isAdmin || a.personId === s.defaultApprover
  return { see: link || s.finance.includes(a.personId), link }
}
