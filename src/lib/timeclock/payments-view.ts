/**
 * A person's Payments tab (Clocky part 2, Company Settings.dc.html 10P-1 and
 * 10P-2): what they were paid and what waits.
 *
 *   contractor   their invoices (paid date and reference, PDF) and their
 *                reimbursements, which go on the next invoice by themselves
 *   employee     the pay periods sent to Rippling (worked, time off, the
 *                payroll summary PDF) and their reimbursement documents
 *
 * Open to the person, Super Admins, Admins and Finance; never Team Leaders
 * (README_PART2). Pure builders (buildContractorPayments,
 * buildEmployeePayments) so the tests hold them to the prototype.
 */

import type { Access } from '@/lib/access/resolve'
import { db, loadCatalog, loadDirectory, rowsOf } from './clocky-context'
import { dateLabel, dayLabel, localDate } from './format'
import { INV_COLS, paidText, usd, type InvRow } from './invoice-doc'
import { loadRouteSettings, loadRoutes, seesMoney } from './pay-terms'
import { sentToRippling, weeksOf, type DocKind } from './pay-docs'
import { periodLabel } from './periods'
import { formatDuration } from './rounding'
import { hoursApprover, invoiceApprover, oneStep, type RoutePerson, type RouteSettings } from './routing'
import { INVOICE_STATE, stateKey } from './invoices-view'

export type PayTone = 'ok' | 'warn' | 'bad' | 'neu' | 'teal' | 'navy'

export interface PaymentsRow {
  key: string
  c1: string; c2: string; c3: string; c4: string; c5: string
  st: { label: string; tone: PayTone }
  /** The PDF the row opens: an invoice, a payroll summary or a reimbursement document. */
  doc: { kind: 'invoice' | DocKind; id: number } | null
}

export interface PaymentsData {
  kind: 'contractor' | 'employee'
  first: string
  cards: { label: string; val: string; sub: string; fg: string }[]
  tables: { title: string; sub: string; heads: { label: string; right?: boolean }[]; rows: PaymentsRow[]; empty: string }[]
  note: string
}

const heads = (h: string[], right: number) => h.map((label, i) => ({ label, right: i === right }))

// ── Contractor ──────────────────────────────────────────────────────────────

type InvLite = Pick<InvRow, 'id' | 'number' | 'state' | 'total' | 'period_start' | 'period_end' | 'paid_on' | 'paid_ref' | 'approved_at' | 'submission_id' | 'kind'> & { seconds: number | null; subState?: string }
type RmbRow = { id: number; purpose: string; spent_on: string; category: string; amount: number; state: string; decision_note: string | null; invoice_id: number | null }

export function buildContractorPayments(x: { name: string; invoices: InvLite[]; reimbursements: RmbRow[]; route: RoutePerson | undefined; settings: RouteSettings; nameOf: (id: string | null) => string; today: string }): PaymentsData {
  const first = x.name.split(' ')[0]
  const where = (i: InvLite) => {
    const st = stateKey(i, i.subState ? { id: i.submission_id ?? 0, state: i.subState } : undefined, x.route, x.settings)
    const hb = x.route ? hoursApprover(x.route, x.settings) : null
    const ib = x.route ? invoiceApprover(x.route, x.settings) : x.settings.defaultApprover
    const text = st === 'paid' ? paidText(i.paid_on!, i.paid_ref)
      : st === 'appr' ? `Approved ${i.approved_at ? dateLabel(i.approved_at.slice(0, 10)) : ''}, waiting for Finance`
        : st === 'hrs' ? `Hours with ${x.nameOf(hb)}`
          : st === 'wait' ? (!i.submission_id || (x.route && oneStep(x.route, x.settings)) ? `With ${x.nameOf(ib)}` : `Hours approved · with ${x.nameOf(ib)}`)
            : 'Draft: submit the timesheet again'
    return { st, text }
  }
  const rows = x.invoices.map(i => {
    const w = where(i)
    return { key: `i${i.id}`, c1: i.number, c2: periodLabel({ start: i.period_start, end: i.period_end }).full, c3: i.seconds ? formatDuration(i.seconds) : '–', c4: usd(Number(i.total)), st: INVOICE_STATE[w.st], c5: w.text, doc: { kind: 'invoice' as const, id: i.id } }
  })
  const [y, m, d] = x.today.split('-').map(Number)
  const since = new Date(Date.UTC(y, m - 4, d)).toISOString().slice(0, 10)
  const paid = x.invoices.filter(i => i.state === 'paid' && i.paid_on && i.paid_on > since).sort((a, b) => b.paid_on!.localeCompare(a.paid_on!))
  const last = x.invoices.filter(i => i.state === 'paid' && i.paid_on).sort((a, b) => b.paid_on!.localeCompare(a.paid_on!))[0]
  const wait = x.invoices.find(i => i.state === 'waiting')
  const byId = new Map(x.invoices.map(i => [i.id, i]))
  const rmbRows = x.reimbursements.map(r => {
    const inv = r.invoice_id ? byId.get(r.invoice_id) : undefined
    const st: PaymentsRow['st'] = r.state === 'on_invoice' ? { label: 'On invoice', tone: 'navy' } : r.state === 'paid' ? { label: 'Paid', tone: 'ok' }
      : r.state === 'approved' ? { label: 'Approved', tone: 'teal' } : r.state === 'denied' ? { label: 'Denied', tone: 'bad' } : { label: 'Waiting', tone: 'warn' }
    // "INV-2026-0143, waiting for approval": the invoice and its state.
    const c5 = r.state === 'on_invoice' && inv ? `${inv.number}, ${INVOICE_STATE[where(inv).st].label.toLowerCase()}`
      : r.state === 'paid' && inv ? `Paid with ${inv.number}`
        : r.state === 'approved' ? 'Goes on your next invoice'
          : r.state === 'denied' ? `Denied${r.decision_note ? `: ${r.decision_note}` : ''}` : 'Waiting for a decision'
    return { key: `r${r.id}`, c1: r.purpose, c2: dateLabel(r.spent_on), c3: r.category, c4: usd(Number(r.amount)), st, c5, doc: inv ? { kind: 'invoice' as const, id: inv.id } : null }
  })
  return {
    kind: 'contractor', first,
    cards: [
      { label: 'Paid, last 3 months', val: usd(paid.reduce((n, i) => n + Number(i.total), 0)), sub: `${paid.length} invoice${paid.length === 1 ? '' : 's'}, paid outside Rippling`, fg: '#0d7a4f' },
      { label: 'Waiting', val: wait ? usd(Number(wait.total)) : '–', sub: wait ? `${wait.number}, ${where(wait).text.replace(/^With/, 'with').replace(/^Hours/, 'hours')}` : 'Nothing waiting', fg: '#8a6d1a' },
      { label: 'Last payment', val: last ? dateLabel(last.paid_on!) : '–', sub: last?.paid_ref ? `Ref. ${last.paid_ref}` : '', fg: '#012358' },
    ],
    tables: [
      { title: 'Invoices', sub: 'One a month, made when the timesheet is submitted.', heads: heads(['Number', 'Period', 'Hours', 'Total', 'State', 'Paid', ''], 3), rows, empty: 'No invoices yet. The first one is made when the timesheet is submitted.' },
      { title: 'Reimbursements', sub: 'Approved ones go on the next invoice by themselves.', heads: heads(['Item', 'Date', 'Category', 'Amount', 'State', 'Where it is', ''], 3), rows: rmbRows, empty: 'No reimbursements.' },
    ],
    note: `Only ${first}, Super Admins, Admins and Finance see this tab. Every PDF opens in a preview first.`,
  }
}

// ── Employee ────────────────────────────────────────────────────────────────

type PeriodLite = { id: number; start: string; end: string; state: string; worked: number; off: number; offText: string; sent: { at: string | null; state: string; error: string | null } | undefined }
type DocLite = { id: number; number: string; created_at: string; total: number; state: string; paid_on: string | null; paid_ref: string | null; items: number }

export function buildEmployeePayments(x: { name: string; periods: PeriodLite[]; docs: DocLite[]; hoursBy: string | null; zone: string }): PaymentsData {
  const first = x.name.split(' ')[0]
  const rows = x.periods.map(p => {
    const sentNow = p.sent?.state === 'done'
    const st: PaymentsRow['st'] = sentNow ? { label: 'Sent', tone: 'ok' }
      : p.sent?.state === 'failed' ? { label: 'Not sent', tone: 'bad' }
        : p.state === 'approved' || p.state === 'recorded' ? { label: 'Approved', tone: 'teal' }
          : p.state === 'returned' ? { label: 'Returned', tone: 'bad' } : { label: 'Waiting for approval', tone: 'warn' }
    const c5 = sentNow ? (p.sent!.at ?? 'Sent')
      : p.sent?.state === 'failed' ? `Rippling refused it${p.sent.error ? `: "${p.sent.error}"` : ''}`
        : p.state === 'approved' || p.state === 'recorded' ? (p.sent?.state === 'waiting_connection' ? 'Waits for the Rippling connection' : 'Queued for Rippling')
          : p.state === 'returned' ? 'Returned: change it and submit again'
            : `With ${x.hoursBy ?? 'the approver'}${p.offText ? ` · ${p.offText}` : ''}`
    return { key: `p${p.id}`, c1: periodLabel({ start: p.start, end: p.end }).label, c2: formatDuration(p.worked), c3: p.off ? formatDuration(p.off) : '–', c4: formatDuration(p.worked + p.off), st, c5, doc: { kind: 'payroll' as const, id: p.id } }
  })
  const sent = x.periods.filter(p => p.sent?.state === 'done').slice(0, 3)
  const wait = x.periods.find(p => p.state === 'submitted')
  return {
    kind: 'employee', first,
    cards: [
      { label: 'Sent to Rippling, last 3 periods', val: formatDuration(sent.reduce((n, p) => n + p.worked + p.off, 0)), sub: `${formatDuration(sent.reduce((n, p) => n + p.off, 0))} of it PTO`, fg: '#0d7a4f' },
      { label: 'Waiting', val: wait ? periodLabel({ start: wait.start, end: wait.end }).label : '–', sub: wait ? `With ${x.hoursBy ?? 'the approver'}` : 'Nothing waiting', fg: '#8a6d1a' },
      { label: 'Pay', val: 'In Rippling', sub: 'Salary and pay stubs live in Rippling', fg: '#012358' },
    ],
    tables: [
      { title: 'Pay periods sent to payroll', sub: 'Approved hours and PTO go to Rippling, by day.', heads: heads(['Pay period', 'Worked', 'Time off', 'Paid hours', 'State', 'Sent to Rippling', ''], 3), rows, empty: 'No pay periods sent yet.' },
      {
        title: 'Reimbursement documents', sub: 'Paid by Finance, outside Rippling payroll.', heads: heads(['Number', 'Date', 'Items', 'Total', 'State', 'Paid', ''], 3), empty: 'No reimbursement documents.',
        rows: x.docs.map(d => ({ key: `d${d.id}`, c1: d.number, c2: dateLabel(localDate(d.created_at, x.zone)), c3: String(d.items), c4: usd(Number(d.total)), st: d.state === 'paid' ? { label: 'Paid', tone: 'ok' as const } : { label: 'Approved', tone: 'teal' as const }, c5: d.state === 'paid' && d.paid_on ? paidText(d.paid_on, d.paid_ref) : 'Waiting for Finance', doc: { kind: 'rmb' as const, id: d.id } })),
      },
    ],
    note: `No invoices for employees. Only ${first}, Super Admins, Admins and Finance see this tab. Every PDF opens in a preview first.`,
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** The tab for this viewer, or null when it is not theirs to see (Team Leaders, everyone else). */
export async function loadPayments(personId: string, v: Pick<Access, 'personId' | 'isAdmin'>, zone: string, now = new Date()): Promise<PaymentsData | null> {
  const settings = await loadRouteSettings()
  if (!seesMoney(v, personId, settings)) return null
  const c = db()
  const [routes, dir] = await Promise.all([loadRoutes([personId]), loadDirectory()])
  const route = routes.get(personId)
  const name = dir.people.get(personId)?.name ?? 'Someone'
  const today = localDate(now, zone)
  if (route?.isContractor) {
    const [{ data: inv, error }, { data: rmb, error: rErr }] = await Promise.all([
      c.from('invoices').select(INV_COLS).eq('person_id', personId).order('period_start', { ascending: false }),
      c.from('reimbursements').select('id, purpose, spent_on, category, amount, state, decision_note, invoice_id').eq('person_id', personId).order('spent_on', { ascending: false }).limit(50),
    ])
    if (error || rErr) throw new Error(`Payments could not be read: ${(error ?? rErr)!.message}`)
    const invoices = (inv ?? []) as unknown as InvRow[]
    const ids = invoices.map(i => i.id)
    const subIds = invoices.map(i => i.submission_id).filter((s): s is number => s != null)
    const [lines, subs] = await Promise.all([
      ids.length ? c.from('invoice_lines').select('invoice_id, hours_seconds').in('invoice_id', ids).then(r => rowsOf(r, 'Payments could not be read')) : Promise.resolve([] as { invoice_id: number; hours_seconds: number | null }[]),
      subIds.length ? c.from('tc_submissions').select('id, state').in('id', subIds).then(r => rowsOf(r, 'Payments could not be read')) : Promise.resolve([] as { id: number; state: string }[]),
    ])
    const secs = new Map<number, number>()
    for (const l of lines) if (l.hours_seconds) secs.set(l.invoice_id, (secs.get(l.invoice_id) ?? 0) + l.hours_seconds)
    const subState = new Map(subs.map(s => [s.id, s.state]))
    return buildContractorPayments({
      name, route, settings, nameOf: dir.nameOf, today,
      invoices: invoices.map(i => ({ ...i, seconds: secs.get(i.id) ?? null, subState: i.submission_id != null ? subState.get(i.submission_id) : undefined })),
      reimbursements: (rmb ?? []) as RmbRow[],
    })
  }
  const [{ data: subs, error }, { data: docs, error: dErr }] = await Promise.all([
    c.from('tc_submissions').select('id, state, tc_periods(start_date, end_date)').eq('person_id', personId).neq('state', 'draft').order('id', { ascending: false }).limit(12),
    c.from('reimbursement_documents').select('id, number, created_at, total, state, paid_on, paid_ref').eq('person_id', personId).order('created_at', { ascending: false }).limit(24),
  ])
  if (error || dErr) throw new Error(`Payments could not be read: ${(error ?? dErr)!.message}`)
  const list = ((subs ?? []) as unknown as { id: number; state: string; tc_periods: { start_date: string; end_date: string } | null }[])
    .filter(s => s.tc_periods).sort((a, b) => b.tc_periods!.start_date.localeCompare(a.tc_periods!.start_date))
  const [sent, weeks, items] = await Promise.all([
    sentToRippling(list.map(s => s.id), zone),
    Promise.all(list.map(s => weeksOf(personId, s.tc_periods!.start_date, s.tc_periods!.end_date, now))),
    (docs ?? []).length ? c.from('reimbursements').select('document_id').in('document_id', (docs ?? []).map(d => d.id)).then(r => rowsOf(r, 'Payments could not be read')) : Promise.resolve([] as { document_id: number | null }[]),
  ])
  const [offs, catalog] = await Promise.all([
    list.length ? c.from('tc_absence_requests').select('start_date, end_date, jobcode_id').eq('person_id', personId).eq('state', 'approved').then(r => rowsOf(r, 'Payments could not be read')) : Promise.resolve([] as { start_date: string; end_date: string; jobcode_id: number }[]),
    loadCatalog(),
  ])
  const kindOf = (jobcodeId: number) => { const j = catalog.jobs.get(jobcodeId); return j?.short || j?.path || 'Time off' }
  const count = new Map<number, number>()
  for (const r of items) if (r.document_id) count.set(r.document_id, (count.get(r.document_id) ?? 0) + 1)
  return buildEmployeePayments({
    name, zone, hoursBy: route ? dir.nameOf(hoursApprover(route, settings)) : null,
    periods: list.map((s, i) => {
      const p = s.tc_periods!
      const off = offs.filter(o => o.start_date <= p.end_date && o.end_date >= p.start_date)
      return {
        id: s.id, start: p.start_date, end: p.end_date, state: s.state,
        worked: weeks[i].reduce((n, w) => n + w.worked, 0), off: weeks[i].reduce((n, w) => n + w.off, 0),
        offText: off.map(o => `${kindOf(o.jobcode_id)}, ${o.start_date === o.end_date ? dayLabel(o.start_date) : `${dayLabel(o.start_date)} to ${dayLabel(o.end_date)}`}`).join(', '), sent: sent.get(s.id),
      }
    }),
    docs: (docs ?? []).map(d => ({ ...d, total: Number(d.total), items: count.get(d.id) ?? 0 })),
  })
}
