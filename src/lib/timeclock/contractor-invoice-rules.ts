/**
 * The contractor makes and sends their own invoice (leadership, 4 November
 * 2026, David's answers to the rules; migration 152). The portal no longer
 * makes an invoice from a timesheet: under US labor law making and submitting
 * the invoice is part of being a contractor. Two ways, both on record:
 *
 *   own_file   their own PDF, with the number, hours and total they type so
 *              it can be checked against the timesheet
 *   builder    the invoice builder: it opens with the lines of their sent
 *              timesheet, one a client, at the rate in their contract (the
 *              rate on file, Rates & Costs; owner, 5 November 2026), or one
 *              line with their fixed amount on file. They may change the hours,
 *              the descriptions and the lines, never the rate or the amount;
 *              the portal adds them up and makes the PDF in their name
 *
 * Every send is kept (invoice_sends): who sent it, when, how, the sentence
 * they confirmed, what they typed, their file and their lines. The invoice row
 * holds the latest. The approver sees the invoice beside the timesheet with
 * the differences marked (compareInvoice); approving both in one step only
 * goes ahead when they match, or with a reason.
 *
 * Pure, and safe in the browser: the screens that send an invoice read it.
 * The writers are in contractor-invoice.ts.
 */


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
  /** The rate an hour on file (never typed: linesAtFileRate puts it back); null with no hours. */
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
    if (l.rate != null && !(l.hours != null && l.hours > 0)) return `Line ${i + 1}: write the hours.`
    if (lineAmount(l) == null) return `Line ${i + 1}: write the hours and your rate, or an amount.`
  }
  return null
}

// ── The rate and the amount on file (owner, 5 November 2026) ───────────────

/**
 * What the builder bills at: the rate in their contract (people.internal_rate,
 * Rates & Costs "Rate / cost") for hourly, the amount on file
 * (people.monthly_salary) for fixed monthly and fixed with no timesheet. Never
 * what they type: the builder shows it read only and the server puts it back.
 * Zero or nothing on file is no rate.
 */
export type PayOnFile = { kind: 'hourly'; rate: number | null } | { kind: 'fixed'; amount: number | null }

const onFile = (n: number | null | undefined): number | null => (n != null && Number.isFinite(n) && n > 0 ? n : null)

export function payOnFile(kind: 'hourly' | 'fixed_monthly' | 'fixed_no_timesheet', rate: number | null, fixedAmount: number | null): PayOnFile {
  return kind === 'hourly' ? { kind: 'hourly', rate: onFile(rate) } : { kind: 'fixed', amount: onFile(fixedAmount) }
}

/** Said on the form and by the server when there is nothing on file to bill at. */
export function missingOnFile(pay: PayOnFile): string | null {
  if (pay.kind === 'hourly') return pay.rate == null ? 'There is no hourly rate on file for you yet, so the invoice cannot be built here. Ask whoever approves your invoice to add it, or upload your own invoice.' : null
  return pay.amount == null ? 'There is no fixed amount on file for you yet, so the invoice cannot be built here. Ask whoever approves your invoice to add it, or upload your own invoice.' : null
}

/** The note under the builder's lines. */
export const RATE_NOTE = 'The rate is the one in your contract (Rates & Costs). To change it, talk to whoever approves your invoice.'
export const AMOUNT_NOTE = 'The amount is the one in your contract (Rates & Costs). To change it, talk to whoever approves your invoice.'

/** A fixed amount's one line: the period and the amount on file. */
export function fixedLine(periodName: string, amount: number | null, description?: string): BuilderLine {
  return { description: description ?? `Fixed monthly amount, ${periodName}`, client: null, hours: null, rate: null, amount: onFile(amount) }
}

/**
 * The builder's lines as they are billed: any rate or amount they carry is
 * dropped for the one on file. Hourly: every line is hours at the rate on
 * file (no free amounts). Fixed: one line, the amount on file. An error when
 * there is nothing on file, or a fixed invoice has more than one line.
 */
export function linesAtFileRate(lines: readonly BuilderLine[], pay: PayOnFile): { lines: BuilderLine[] } | { error: string } {
  const missing = missingOnFile(pay)
  if (missing) return { error: missing }
  if (pay.kind === 'hourly') return { lines: lines.map(l => ({ description: l.description, client: l.client, hours: l.hours, rate: pay.rate, amount: null })) }
  if (lines.length !== 1) return { error: 'A fixed amount invoice has one line: the amount on file.' }
  return { lines: [{ description: lines[0].description, client: null, hours: null, rate: null, amount: pay.amount }] }
}

/** The lines the builder opens with: one a client from the sent timesheet at the rate on file. */
export function linesFromTimesheet(byClient: readonly { client: string; seconds: number }[], periodName: string, rate: number | null): BuilderLine[] {
  return byClient.filter(c => c.seconds > 0).map(c => ({
    description: `${c.client}, ${periodName}`,
    client: c.client,
    hours: Math.round(c.seconds / 36) / 100,
    rate: onFile(rate),
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
  /**
   * A neutral line in place of the client rows: an invoice the portal made from
   * the timesheet itself (made_by null, before 4 November 2026). Those lines
   * carry the old TSheets client names ("1 - True North"), so a client by
   * client check would mark every row; only the total is checked.
   */
  note?: string | null
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
  // Made by the portal from this timesheet (before 4 November 2026): the hours are the timesheet's.
  const portal = x.invoice.madeBy == null

  if (x.pay.kind === 'hourly' && !portal) {
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

  for (const r of portal ? [] : x.reimbursements) {
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
  const note = portal ? `Made by the portal from this timesheet before November 4, 2026: the hours are the timesheet's. Total ${usd(x.invoice.total)}.` : null
  return { rows, total, matches, summary, note }
}

