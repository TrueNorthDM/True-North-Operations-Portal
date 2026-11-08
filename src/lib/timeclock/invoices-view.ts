/**
 * The Invoices pages (Clocky part 2, Invoices.dc.html 6E and 6F) as their
 * viewer may see them.
 *
 *   mine   a contractor (any level, Team Leaders included): their own invoices
 *   all    Super Admins (ck-inv-all with ck-money) and Finance: every
 *          invoice, with filters, the totals strip and "where it is"; only
 *          Finance marks one paid
 *   none   an employee: no invoices, a line saying why
 *
 * Nobody else sees anyone else's money (owner, 5 November 2026: not Team
 * Leaders, not Admins unless Finance), so an Admin who is not Finance gets
 * their own list, or none.
 * The list and its history are built by pure functions (buildInvoiceList,
 * buildInvoiceDetail) so the tests hold them to the prototype.
 */

import type { Access } from '@/lib/access/resolve'
import { db, loadDirectory, oneOf, rowsOf } from './clocky-context'
import { dateLabel, initials as initialsOf, localDate, monthLong, monthYear, stampLabel } from './format'
import { INV_COLS, LINE_COLS, invoiceDocOf, paidText, usd, type DocTone, type InvRow, type InvoiceDocView, type LineRow } from './invoice-doc'
import { isFinance, loadRouteSettings, loadRoutes, seesAllMoney, seesMoney, type InvoiceSettings } from './pay-terms'
import { periodLabel } from './periods'
import { hoursApprover, invoiceApprover, loneInvoiceApprover, oneStep, type RoutePerson } from './routing'
import { cameFrom } from '@/lib/invoice-form/rules'
import { csvDate } from '@/lib/format/csv'
import { driveShow, folderText, historyLines, wantInvoice, type DriveBoxData, type DriveShow } from '@/lib/drive/copy-plan'
import { copyFrom, copyRow, driveShows } from '@/lib/drive/copies'
import { docFileName } from '@/lib/drive/file-names'
import { loadInvoiceSends, type InvoiceSendRow } from './invoice-check-data'
import { loadInvoiceRecord, RECORD_ZONE } from './invoice-record'
import { recordPages } from '@/lib/pdf/invoice-pages'

export type InvoiceMode = 'mine' | 'all' | 'none'
export type InvoiceStateKey = 'draft' | 'hrs' | 'wait' | 'appr' | 'paid'

/** Invoices.dc.html ST: the label and tone of each state. */
export const INVOICE_STATE: Record<InvoiceStateKey, { label: string; tone: DocTone }> = {
  draft: { label: 'Draft', tone: 'neu' },
  hrs: { label: 'Waiting for hours', tone: 'warn' },
  wait: { label: 'Waiting for approval', tone: 'warn' },
  appr: { label: 'Approved', tone: 'teal' },
  paid: { label: 'Paid', tone: 'ok' },
}

export interface InvoiceListRow {
  id: number
  number: string
  personId: string
  who: string
  initials: string
  team: string
  teamColor: string
  /** "October 2026" */
  period: string
  /** "$20.00/h", "Fixed monthly", "Fixed, no timesheet" */
  pays: string
  total: string
  amount: number
  st: InvoiceStateKey
  /** The Paid column: paid date and reference, or where it is now. */
  where: string
  /** "Oct 12, 2026": when it was paid, for the strip. */
  paidOn: string | null
  /** The Paid column in the CSV: its day as numbers, "10/12/2026 · ref" (owner, 5 November 2026). */
  csvWhere?: string
  canPay: boolean
  /** Its copy in Google Drive (owner, 31 October 2026), on the everyone list only. */
  drive?: DriveShow
}

export interface InvoiceList {
  mode: InvoiceMode
  finance: boolean
  rows: InvoiceListRow[]
  people: string[]
  periods: string[]
  /** The period shown first: the latest one. */
  defaultPeriod: string
  /** "October": the month of the "Paid in" card (the month before this one). */
  paidMonth: { label: string; ym: string }
  /** Clicking "Paid in <month>" shows the period paid in it (the one before). */
  paidPeriod: string
  /** "Tina Gennette": who marks invoices paid (Company settings, Invoices). */
  financeNames: string
  /** The Drive column (the everyone list); `retry` when the viewer may try a failed copy again (Super Admins). */
  drive?: { retry: boolean }
}

type SubState = { id: number; state: string }

export interface ListSource {
  mode: InvoiceMode
  finance: boolean
  invoices: InvRow[]
  rates: Map<number, number>
  subs: Map<number, SubState>
  routes: Map<string, RoutePerson>
  settings: Pick<InvoiceSettings, 'invoiceApprovers' | 'defaultApprover' | 'deputyDirector' | 'finance'>
  person: (id: string) => { name: string; team: string; color: string }
  nameOf: (id: string | null | undefined) => string
  /** Today, YYYY-MM-DD in the viewer's zone. */
  today: string
}

export function stateKey(i: Pick<InvRow, 'state'>, sub: SubState | undefined, route: RoutePerson | undefined, s: Pick<InvoiceSettings, 'invoiceApprovers' | 'defaultApprover' | 'deputyDirector'>): InvoiceStateKey {
  if (i.state === 'paid') return 'paid'
  if (i.state === 'approved') return 'appr'
  if (i.state === 'draft') return 'draft'
  // Two steps and the hours not approved yet: the invoice waits for the hours.
  if (sub && sub.state === 'submitted' && route && !oneStep(route, s)) return 'hrs'
  return 'wait'
}

const paysOf = (kind: string, rate: number | undefined, source?: string | null) =>
  source ? 'Invoice form' : kind === 'fixed_no_timesheet' ? 'Fixed, no timesheet' : kind === 'fixed_monthly' ? 'Fixed monthly' : rate != null ? `${usd(rate)}/h` : 'By the hour'

export function buildInvoiceList(src: ListSource): InvoiceList {
  const rows: InvoiceListRow[] = src.invoices.map(i => {
    const route = src.routes.get(i.person_id)
    const sub = i.submission_id != null ? src.subs.get(i.submission_id) : undefined
    const st = stateKey(i, sub, route, src.settings)
    const hb = route ? hoursApprover(route, src.settings) : null
    const ib = route ? (sub ? invoiceApprover(route, src.settings) : loneInvoiceApprover(route, src.settings, i.source)) : src.settings.defaultApprover
    const where = st === 'paid' ? paidText(i.paid_on!, i.paid_ref)
      : st === 'appr' ? `Approved ${i.approved_at ? dateLabel(i.approved_at.slice(0, 10)) : ''}`.trim()
        : st === 'hrs' ? `Hours with ${src.nameOf(hb)}`
          : st === 'wait' ? (!sub || (route && oneStep(route, src.settings)) ? `With ${src.nameOf(ib)}` : `Hours approved · with ${src.nameOf(ib)}`)
            : '-'
    const csvWhere = st === 'paid' ? `${csvDate(i.paid_on)}${i.paid_ref ? ` · ${i.paid_ref}` : ''}`
      : st === 'appr' ? `Approved ${csvDate(i.approved_at?.slice(0, 10))}`.trim() : where
    const p = src.person(i.person_id)
    return {
      id: i.id, number: i.number, personId: i.person_id, who: p.name, initials: initialsOf(p.name), team: p.team, teamColor: p.color,
      period: periodLabel({ start: i.period_start, end: i.period_end }).full, pays: paysOf(i.kind, src.rates.get(i.id), i.source),
      total: usd(Number(i.total)), amount: Number(i.total), st, where, paidOn: i.paid_on, csvWhere,
      canPay: src.finance && st === 'appr',
    }
  })
  const periods = [...new Map(src.invoices.map(i => [i.period_start, periodLabel({ start: i.period_start, end: i.period_end }).full])).entries()]
    .sort((a, b) => b[0].localeCompare(a[0])).map(([, label]) => label)
  const [y, m] = src.today.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
  const before = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10)
  return {
    mode: src.mode, finance: src.finance, rows,
    people: [...new Set(rows.map(r => r.who))].sort((a, b) => a.localeCompare(b)),
    periods,
    defaultPeriod: periods[0] ?? 'All periods',
    paidMonth: { label: monthLong(`${prev}-01`), ym: prev },
    paidPeriod: monthYear(before),
    financeNames: src.settings.finance.map(src.nameOf).join(' and '),
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface InvoiceViewer { personId: string | null; can: (key: string) => boolean; zone: string }

/** Which list this viewer gets. */
export async function invoiceModeFor(v: InvoiceViewer, settings: Pick<InvoiceSettings, 'finance'>): Promise<{ mode: InvoiceMode; finance: boolean }> {
  const finance = isFinance({ personId: v.personId }, settings)
  // Every contractor's list: ck-inv-all with everyone's money (Super Admins), or Finance. An Admin
  // who is not Finance keeps their own list only, since every row carries its amount (owner, 5 November 2026).
  if (finance || (v.can('ck-inv-all') && seesAllMoney(v, settings))) return { mode: 'all', finance }
  if (!v.personId) return { mode: 'none', finance }
  const route = (await loadRoutes([v.personId])).get(v.personId)
  return { mode: route?.isContractor ? 'mine' : 'none', finance }
}

/** The 6E list for this viewer. */
export async function loadInvoiceList(v: InvoiceViewer, now = new Date()): Promise<InvoiceList> {
  const settings = await loadRouteSettings()
  const { mode, finance } = await invoiceModeFor(v, settings)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: v.zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const dir = await loadDirectory()
  const person = (id: string) => {
    const p = dir.people.get(id)
    const t = p?.teamId ? dir.teams.get(p.teamId) : null
    return { name: p?.name ?? 'Someone', team: t?.name ?? '', color: t?.color ?? '#9CA3AF' }
  }
  const empty = { mode, finance, invoices: [], rates: new Map(), subs: new Map(), routes: new Map(), settings, person, nameOf: dir.nameOf, today }
  if (mode === 'none') return buildInvoiceList(empty)
  const c = db()
  let q = c.from('invoices').select(INV_COLS).order('number', { ascending: false })
  if (mode === 'mine') q = q.eq('person_id', v.personId!)
  const { data, error } = await q
  if (error) throw new Error(`Invoices could not be read: ${error.message}`)
  const invoices = (data ?? []) as unknown as InvRow[]
  const ids = invoices.map(i => i.id)
  const subIds = invoices.map(i => i.submission_id).filter((x): x is number => x != null)
  const [lines, subs, routes] = await Promise.all([
    ids.length ? c.from('invoice_lines').select('invoice_id, rate').in('invoice_id', ids).eq('kind', 'hours').then(r => rowsOf(r, 'Invoice lines could not be read')) : Promise.resolve([]),
    subIds.length ? c.from('tc_submissions').select('id, state').in('id', subIds).then(r => rowsOf(r, 'Timesheets could not be read')) : Promise.resolve([]),
    loadRoutes([...new Set(invoices.map(i => i.person_id))]),
  ])
  const rates = new Map<number, number>()
  for (const l of lines as { invoice_id: number; rate: number | null }[]) if (l.rate != null && !rates.has(l.invoice_id)) rates.set(l.invoice_id, Number(l.rate))
  const list = buildInvoiceList({ ...empty, invoices, rates, subs: new Map((subs as SubState[]).map(s => [s.id, s])), routes })
  if (mode !== 'all') return list
  // The Drive column (owner, 31 October 2026); a list that cannot read it still shows, with no column.
  const shows = await driveShows('invoice', invoices, wantInvoice).catch(e => { console.error('[invoices] drive:', e instanceof Error ? e.message : e); return null })
  if (!shows) return list
  return { ...list, rows: list.rows.map(r => ({ ...r, drive: shows.get(r.id) })), drive: { retry: false } }
}

// ── One invoice (6F) ────────────────────────────────────────────────────────

export interface InvoiceDetail {
  doc: InvoiceDocView
  st: InvoiceStateKey
  who: string
  canPay: boolean
  /** Approved or paid: why it no longer changes (null while it can). */
  locked: string | null
  history: { text: string; when: string; dot: string }[]
  /** For the Mark paid dialog. */
  pay: { who: string; line: string; total: string }
  /** The "Google Drive" box (owner, 31 October 2026): for Super Admins and Finance. */
  drive?: DriveBoxData
  /** "The invoice form, deliverables, 3 lines" when it came from the invoice form (migration 147); null otherwise. */
  cameFrom: string | null
  /** Their own invoice PDF, sent with the form or as their invoice (made_by own_file, migration 152). */
  ownPdf: { href: string; name: string } | null
}

type EventRow = { step: string; action: string; by_person: string | null; at: string; note: string | null }

export interface DetailSource {
  inv: InvRow
  lines: LineRow[]
  events: EventRow[]
  sub: SubState | undefined
  route: RoutePerson | undefined
  settings: ListSource['settings']
  finance: boolean
  nameOf: (id: string | null | undefined) => string
  zone: string
  /**
   * Every version the contractor sent (invoice_sends, migration 152): each is
   * a line of the history, in place of "Created when the timesheet was
   * submitted" (owner, 4 November 2026: the contractor makes the invoice).
   */
  sends?: readonly InvoiceSendRow[]
}

/** "Sent by Jordan Lee: their own file "x.pdf", their number 0142, $4,096.70" */
export function sendLine(s: InvoiceSendRow, again: boolean, who: string): string {
  const how = s.madeBy === 'own_file' ? `their own file${s.ownPdfName ? ` "${s.ownPdfName}"` : ''}` : 'made with the invoice builder'
  const total = s.madeBy === 'own_file' ? s.statedTotal ?? s.total : s.total
  return `${again ? 'Sent again' : 'Sent'} by ${who}${s.sentFrom === 'form' ? ' through the invoice form' : ''}: ${how}${s.theirNumber ? `, their number ${s.theirNumber}` : ''}${total != null ? `, ${usd(total)}` : ''}`
}

export function buildInvoiceDetail(src: DetailSource): InvoiceDetail {
  const { inv, route, settings } = src
  const period = periodLabel({ start: inv.period_start, end: inv.period_end })
  const doc = invoiceDocOf(inv, src.lines, period.full)
  const st = stateKey(inv, src.sub, route, settings)
  doc.state = INVOICE_STATE[st]
  const at = (t: string) => stampLabel(t, src.zone)
  const one = route ? oneStep(route, settings) : true
  const hist: { text: string; when: string; dot: string; t: string }[] = []
  const sends = src.sends ?? []
  // Sent by the contractor (migration 152): each version they sent, the first and each after a return.
  sends.forEach((s, i) => hist.push({ text: sendLine(s, i > 0, s.sentBy ? src.nameOf(s.sentBy) : doc.from.name || src.nameOf(inv.person_id)), when: at(s.at), dot: '#1E7D7F', t: s.at }))
  if (!sends.length) hist.push({
    text: inv.source ? `Sent through the invoice form for ${period.full}` : inv.kind === 'fixed_no_timesheet' ? `Created by itself for ${period.full} (fixed monthly)` : `Created when the ${period.label} timesheet was submitted`,
    when: at(inv.created_at), dot: '#1E7D7F', t: inv.created_at,
  })
  for (const l of src.lines.filter(x => x.kind === 'reimbursement')) {
    if (inv.source || sends.length) continue
    hist.push({ text: `Reimbursement added by itself: ${l.description} (${usd(Number(l.amount))})`, when: dateLabel(inv.issued_on ?? localDate(inv.created_at, src.zone)), dot: '#a3aebb', t: inv.created_at })
  }
  for (const e of src.events) {
    const by = src.nameOf(e.by_person)
    if (sends.length && (e.action === 'submit' || e.action === 'sent' || e.action === 'record')) {
      // The invoice's own sends are the lines above; the timesheet's are its own lines.
      if (e.step !== 'invoice' && e.action !== 'sent' && inv.submission_id) hist.push({ text: `${period.label} timesheet sent by ${by}`, when: at(e.at), dot: '#a3aebb', t: e.at })
      continue
    }
    if (e.action === 'return') hist.push({ text: `Returned by ${by}${inv.submission_id ? ' with the timesheet' : ''}${e.note ? `: "${e.note}"` : '.'} Back to Draft.`, when: at(e.at), dot: '#c8323d', t: e.at })
    else if (e.action === 'reopen') hist.push({ text: `Reopened by ${by}${e.note ? `: "${e.note}"` : '.'} Back to Draft.`, when: at(e.at), dot: '#c8323d', t: e.at })
    // Submitted again after a return: the same invoice, made again with the new hours.
    else if (e.action === 'submit') hist.push({ text: inv.source ? 'Sent again through the invoice form, after the return' : `Made again when the ${period.label} timesheet was submitted again`, when: at(e.at), dot: '#1E7D7F', t: e.at })
    else if (e.action === 'approve' && e.step === 'hours') hist.push({ text: `Hours approved by ${by}`, when: at(e.at), dot: '#1E7D7F', t: e.at })
    else if (e.action === 'approve') hist.push({ text: one && inv.submission_id ? `Approved by ${by}, together with the hours` : `Invoice approved by ${by}`, when: at(e.at), dot: '#012358', t: e.at })
    else if (e.action === 'paid') hist.push({ text: `Paid on ${dateLabel(inv.paid_on ?? e.at.slice(0, 10))} by ${by}${inv.paid_ref ? `, ref. ${inv.paid_ref}` : ''}`, when: dateLabel(inv.paid_on ?? localDate(e.at, src.zone)), dot: '#1E9E6A', t: e.at })
  }
  // Newest first; at the same moment, the later line first (the prototype reverses the list).
  const order = hist.map((h, i) => ({ h, i })).sort((a, b) => b.h.t.localeCompare(a.h.t) || b.i - a.i).map(x => x.h)
  return {
    doc, st, who: doc.from.name || src.nameOf(inv.person_id),
    canPay: src.finance && st === 'appr',
    locked: st !== 'appr' && st !== 'paid' ? null
      : inv.kind === 'fixed_no_timesheet' ? 'Locked. An approved invoice with no timesheet does not change.'
      : 'Locked. A change means reopening the timesheet, which sends this invoice back to Draft.',
    history: order.map(({ text, when, dot }) => ({ text, when, dot })),
    pay: { who: doc.from.name || src.nameOf(inv.person_id), line: `${period.full} · approved ${inv.approved_at ? dateLabel(inv.approved_at.slice(0, 10)) : ''}`.trim(), total: doc.total },
    cameFrom: cameFrom(inv.source, src.lines.filter(l => l.kind === 'deliverable').length),
    ownPdf: inv.source && inv.own_pdf_name ? { href: `/clocky-hours/invoices/${inv.id}/own-pdf`, name: inv.own_pdf_name } : null,
  }
}

/** One invoice for this viewer: the person, Super Admins and Finance (seesMoney); null otherwise (closed and missing look the same). */
export async function loadInvoiceDetail(v: InvoiceViewer, id: number): Promise<InvoiceDetail | null> {
  const c = db()
  const { data, error } = await c.from('invoices').select(INV_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(`The invoice could not be read: ${error.message}`)
  const inv = data as unknown as InvRow | null
  if (!inv) return null
  const settings = await loadRouteSettings()
  if (!seesMoney(v, inv.person_id, settings)) return null
  const [lines, events, sub, routes, dir, sends] = await Promise.all([
    // A failed read throws: no lines would show a $0.00 invoice, no timesheet the wrong state.
    c.from('invoice_lines').select(LINE_COLS).eq('invoice_id', inv.id).order('sort').then(r => rowsOf(r, 'The invoice lines could not be read') as unknown as LineRow[]),
    eventsOf(inv),
    inv.submission_id != null ? c.from('tc_submissions').select('id, state').eq('id', inv.submission_id).maybeSingle().then(r => (oneOf(r, 'The timesheet could not be read') ?? undefined) as SubState | undefined) : Promise.resolve(undefined),
    loadRoutes([inv.person_id]),
    loadDirectory(),
    loadInvoiceSends(inv.id),
  ])
  // A contractor's invoice (migration 152): the hours may be approved before it is sent, so every decision on its timesheet counts.
  const evs = sends.length ? events.all : events.sinceMade
  const detail = buildInvoiceDetail({ inv, lines, events: evs, sub, route: routes.get(inv.person_id), settings, finance: isFinance({ personId: v.personId }, settings), nameOf: dir.nameOf, zone: v.zone, sends })
  await addRecord(detail, inv.id, dir.nameOf)
  // The Google Drive box: Finance's copy, so for those who see everyone's invoices, not the contractor's own page.
  if (!seesAllMoney(v, settings)) return detail
  try {
    const [from, row] = await Promise.all([copyFrom(), copyRow('invoice', inv.id)])
    detail.drive = {
      show: driveShow(wantInvoice(inv, from), row ?? undefined),
      file: row?.file_name ?? docFileName(inv.number, dir.people.get(inv.person_id)?.name ?? null, 'pdf'),
      folder: row?.folder_path ?? folderText('invoice'),
      history: historyLines(row?.history, v.zone),
    }
  } catch (e) {
    console.error('[invoice] drive:', e instanceof Error ? e.message : e)
  }
  return detail
}

/**
 * The decisions that touched this invoice: its own, and its timesheet's.
 * `sinceMade` is a portal-made invoice's (its timesheet's after it was made,
 * the submit that made it being the "Created" line); `all` a contractor's.
 */
async function eventsOf(inv: InvRow): Promise<{ all: EventRow[]; sinceMade: EventRow[] }> {
  const c = db()
  const cols = 'step, action, by_person, at, note'
  const { data, error } = inv.submission_id != null
    ? await c.from('tc_approval_events').select(cols).eq('submission_id', inv.submission_id)
    : await c.from('tc_approval_events').select(cols).eq('invoice_id', inv.id)
  if (error) throw new Error(`The invoice history could not be read: ${error.message}`)
  const all = (data ?? []) as EventRow[]
  const made = Date.parse(inv.created_at) + 60_000
  return { all, sinceMade: all.filter(e => Date.parse(e.at) >= Date.parse(inv.created_at)).filter(e => e.action !== 'submit' || Date.parse(e.at) > made) }
}

/**
 * The record (owner, 4 November 2026): the invoice's "Who made it" card, and
 * the PDF's second page with page 1's footer. In New York's time, as Finance's
 * copy in Drive reads it. A record that cannot be read leaves the page and
 * page 1 as they were; the Drive copy will not go without it.
 */
async function addRecord(detail: InvoiceDetail, id: number, nameOf: (id: string | null | undefined) => string): Promise<void> {
  try {
    const record = await loadInvoiceRecord(id, { zone: RECORD_ZONE, nameOf })
    if (!record) return
    detail.doc.record = record
    if (record.madeBy === 'own_file') {
      detail.ownPdf = { href: `/clocky-hours/invoices/${id}/own-pdf`, name: record.ownFileName ?? detail.ownPdf?.name ?? 'Their invoice' }
      detail.doc.ownFile = detail.ownPdf
    } else {
      detail.doc.foot = { line: record.footLine, page: recordPages(null).first }
    }
  } catch (e) {
    console.error('[invoice] record:', e instanceof Error ? e.message : e)
  }
}

/** The access a page already has, as the viewer these loaders take. */
export const invoiceViewer = (a: Pick<Access, 'personId' | 'can'>, zone: string): InvoiceViewer => ({ personId: a.personId, can: a.can, zone })
