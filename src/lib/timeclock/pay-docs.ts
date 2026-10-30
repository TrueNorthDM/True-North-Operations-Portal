/**
 * The portal's other pay documents, drawn like the invoice (Company
 * Settings.dc.html docOf, 10P-2): an employee's payroll summary (a pay period
 * as it goes to Rippling) and a reimbursement document (RMB-YYYY-NNNN, paid by
 * Finance outside payroll). The builders are pure; the loaders open them to
 * the person, Super Admins, Admins and Finance only, never Team Leaders.
 */

import type { Access } from '@/lib/access/resolve'
import { allRows, db, loadDirectory } from './clocky-context'
import { entrySeconds } from './clocky-panel'
import { dateLabel, localDate, stampLabel } from './format'
import { money, moneyTotal } from './invoice-doc'
import { loadInvoiceSettings, seesMoney } from './pay-terms'
import { addDays, periodLabel } from './periods'
import { formatDuration } from './rounding'
import { receiptShow, type DocReceipt } from './receipt-pages'
import { pdfPageCount, receiptBytes } from './receipt-files'

export type DocKind = 'payroll' | 'rmb'

/** The page that opens a document, and the access item its PDF and print page are guarded with. */
export const docSurface = (kind: DocKind): string => (kind === 'rmb' ? 'rq-reimbursements' : 'clocky-hours')

export interface DocSheetData {
  /** "Payroll summary", "Reimbursement": the gold word in the band. */
  kind: string
  /** The big line in the band: the person (payroll) or the number (RMB). */
  title: string
  titleSize: 24 | 28
  meta: { k: string; v: string; gold?: boolean }[]
  parties: { k: string; name: string; l1: string; l2: string }[]
  heads: [string, string, string, string]
  rows: { a: string; b: string; c: string; d: string }[]
  totalLabel: string
  total: string
  stamp: string | null
  /** The file Download saves. */
  file: string
  /** A reimbursement document's receipts, a page or more each after it (9D-p); none on a payroll summary. */
  receipts: DocReceipt[]
}

// ── Payroll summary ─────────────────────────────────────────────────────────

export function payrollDocOf(x: {
  name: string; team: string; start: string; end: string; submittedOn: string | null
  weeks: { worked: number; off: number }[]; sentAt: string | null
}): DocSheetData {
  const p = periodLabel({ start: x.start, end: x.end })
  const worked = x.weeks.reduce((n, w) => n + w.worked, 0)
  const off = x.weeks.reduce((n, w) => n + w.off, 0)
  return {
    kind: 'Payroll summary', title: x.name, titleSize: 24,
    meta: [{ k: 'Pay period', v: p.full }, { k: 'Submitted', v: x.submittedOn ? dateLabel(x.submittedOn) : '–' }, { k: 'Rippling', v: x.sentAt ? 'Sent' : 'After approval', gold: true }],
    parties: [
      { k: 'Employee', name: x.name, l1: `${x.team} · US Employee`, l2: 'Paid through Rippling payroll' },
      { k: 'Approved hours go to', name: 'Rippling payroll', l1: 'Hours and PTO by day', l2: x.sentAt ? `Sent ${x.sentAt}` : 'Waiting for approval' },
    ],
    heads: ['Week', 'Worked', 'Time off', 'Paid hours'],
    rows: x.weeks.map((w, i) => ({ a: i === 0 ? 'First week' : i === 1 ? 'Second week' : `Week ${i + 1}`, b: formatDuration(w.worked), c: w.off ? formatDuration(w.off) : '–', d: formatDuration(w.worked + w.off) })),
    totalLabel: 'Paid hours', total: formatDuration(worked + off),
    stamp: x.sentAt ? `Sent to Rippling ${x.sentAt.replace(/, \d+:\d+ [AP]M$/, '')}` : null,
    file: `payroll-${x.name.split(' ')[0].toLowerCase()}-${p.label.toLowerCase().replace(/ /g, '-')}.pdf`,
    receipts: [],
  }
}

// ── Reimbursement document ──────────────────────────────────────────────────

export function rmbDocOf(x: {
  number: string; name: string; team: string; createdOn: string
  items: { spentOn: string; category: string; purpose: string; amount: number; currency?: string; receipt?: Omit<DocReceipt, 'line'> }[]
  billing: { name: string; address: string }
  paid: { on: string; ref: string | null } | null
}): DocSheetData {
  const lines = x.billing.address.split('\n')
  return {
    kind: 'Reimbursement', title: x.number, titleSize: 28,
    meta: [{ k: 'Date', v: dateLabel(x.createdOn) }, { k: 'Items', v: String(x.items.length) }],
    parties: [
      { k: 'Pay to', name: x.name, l1: `${x.team} · US Employee`, l2: 'Paid by Finance, outside Rippling payroll' },
      { k: 'From', name: x.billing.name, l1: lines[0] ?? '', l2: lines.slice(1).join(', ') },
    ],
    heads: ['What it was for', 'Date', 'Category', 'Amount'],
    rows: x.items.map(i => ({ a: i.purpose, b: dateLabel(i.spentOn).replace(/, \d{4}$/, ''), c: i.category, d: money(i.amount, i.currency) })),
    totalLabel: 'Total', total: moneyTotal(x.items),
    stamp: x.paid ? `Paid ${dateLabel(x.paid.on)}${x.paid.ref ? ` · ${x.paid.ref}` : ''}` : null,
    file: `${x.number}.pdf`,
    receipts: x.items.flatMap(i => (i.receipt ? [{ ...i.receipt, line: `${i.purpose}, ${money(i.amount, i.currency)}` }] : [])),
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

type Viewer = Pick<Access, 'personId' | 'isAdmin'>

/** The worked and time-off seconds of each week of a period. */
export async function weeksOf(personId: string, start: string, end: string, now = new Date()): Promise<{ worked: number; off: number }[]> {
  const data = await allRows<{ entry_date: string; started_at: string | null; ended_at: string | null; duration_seconds: number | null; kind: string }>((a, b) => db().from('tc_entries')
    .select('entry_date, started_at, ended_at, duration_seconds, kind').eq('person_id', personId).gte('entry_date', start).lte('entry_date', end).order('id').range(a, b), 'The hours could not be read')
  const weeks: { worked: number; off: number }[] = []
  for (let d = start, i = 0; d <= end; d = addDays(d, 7), i++) weeks.push({ worked: 0, off: 0 })
  for (const r of data) {
    const i = Math.floor((Date.parse(`${r.entry_date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 86_400_000))
    const s = entrySeconds(r as Parameters<typeof entrySeconds>[0], now)
    if (r.kind === 'absence') weeks[i].off += s
    else weeks[i].worked += s
  }
  return weeks
}

/** When Rippling took a pay period's hours, as a stamp in the viewer's zone; null until then. */
export async function sentToRippling(submissionIds: readonly number[], zone: string): Promise<Map<number, { at: string | null; state: string; error: string | null }>> {
  const out = new Map<number, { at: string | null; state: string; error: string | null }>()
  if (!submissionIds.length) return out
  const { data, error } = await db().from('integration_jobs').select('ref_id, state, done_at, last_error').eq('kind', 'rippling_hours').eq('ref_table', 'tc_submissions').in('ref_id', [...submissionIds])
  if (error) throw new Error(`Rippling's answers could not be read: ${error.message}`)
  for (const j of data ?? []) out.set(Number(j.ref_id), { at: j.done_at ? stampLabel(j.done_at, zone) : null, state: j.state, error: j.last_error })
  return out
}

export async function loadPayrollDoc(v: Viewer, submissionId: number, zone: string): Promise<DocSheetData | null> {
  const c = db()
  const { data: s, error } = await c.from('tc_submissions').select('id, person_id, submitted_at, tc_periods(start_date, end_date)').eq('id', submissionId).maybeSingle()
  if (error) throw new Error(`The timesheet could not be read: ${error.message}`)
  if (!s) return null
  const settings = await loadInvoiceSettings()
  if (!seesMoney(v, s.person_id, settings)) return null
  const period = s.tc_periods as unknown as { start_date: string; end_date: string } | null
  if (!period) return null
  const dir = await loadDirectory()
  const person = dir.people.get(s.person_id)
  const [weeks, sent] = await Promise.all([weeksOf(s.person_id, period.start_date, period.end_date), sentToRippling([s.id], zone)])
  return payrollDocOf({
    name: person?.name ?? 'Someone', team: (person?.teamId && dir.teams.get(person.teamId)?.name) || 'No team',
    start: period.start_date, end: period.end_date, submittedOn: s.submitted_at ? localDate(s.submitted_at, zone) : null,
    weeks, sentAt: sent.get(s.id)?.at ?? null,
  })
}

/** `keep`: the PDF receipts' bytes by reimbursement id, for the PDF maker to draw. */
export async function loadRmbDoc(v: Viewer, documentId: number, zone: string, keep?: Map<number, Uint8Array>): Promise<DocSheetData | null> {
  const c = db()
  const { data: d, error } = await c.from('reimbursement_documents').select('id, number, person_id, state, paid_on, paid_ref, created_at').eq('id', documentId).maybeSingle()
  if (error) throw new Error(`The reimbursement document could not be read: ${error.message}`)
  if (!d) return null
  const settings = await loadInvoiceSettings()
  if (!seesMoney(v, d.person_id, settings)) return null
  const [{ data: items, error: itemsErr }, dir] = await Promise.all([
    c.from('reimbursements').select('id, spent_on, category, purpose, amount, currency, receipt_path, receipt_name').eq('document_id', d.id).order('spent_on').order('id'),
    loadDirectory(),
  ])
  // An unread list would print the document empty, with a $0.00 total.
  if (itemsErr) throw new Error(`The document's items could not be read: ${itemsErr.message}`)
  const person = dir.people.get(d.person_id)
  // A PDF receipt brings its own pages; one that cannot be read keeps one page, with the line saying where to open it.
  const receipts = await Promise.all((items ?? []).map(async i => {
    // A Mileage line may have no receipt: it prints as a line, with no receipt page.
    if (!i.receipt_path) return undefined
    const show = receiptShow(i.receipt_path)
    if (show !== 'pdf') return { id: i.id, file: i.receipt_name || 'receipt', show, pages: 1 }
    const bytes = await receiptBytes(i.receipt_path)
    const pages = bytes && await pdfPageCount(bytes)
    if (bytes && pages) keep?.set(i.id, bytes)
    return { id: i.id, file: i.receipt_name || 'receipt.pdf', show: pages ? show : 'none' as const, pages: pages ?? 1 }
  }))
  return rmbDocOf({
    number: d.number, name: person?.name ?? 'Someone', team: (person?.teamId && dir.teams.get(person.teamId)?.name) || 'No team',
    createdOn: localDate(d.created_at, zone),
    items: (items ?? []).map((i, k) => ({ spentOn: i.spent_on, category: i.category, purpose: i.purpose, amount: Number(i.amount), currency: i.currency, receipt: receipts[k] })),
    billing: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '' },
    paid: d.state === 'paid' && d.paid_on ? { on: d.paid_on, ref: d.paid_ref } : null,
  })
}

export async function loadDoc(v: Viewer, kind: DocKind, id: number, zone: string): Promise<DocSheetData | null> {
  return kind === 'payroll' ? loadPayrollDoc(v, id, zone) : loadRmbDoc(v, id, zone)
}
