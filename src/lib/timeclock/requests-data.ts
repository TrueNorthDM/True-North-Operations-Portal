/**
 * Reimbursements and extra hours (Clocky part 2, Requests.dc.html 9A to 9D,
 * 10C, 10E) as their viewer may see them.
 *
 *   Reimbursements   the person's own requests with where each one is (on an
 *                    invoice, on a reimbursement document, paid, denied); an
 *                    employee's open document is a card that opens it
 *   RMB document     one reimbursement document (9D): the person, Super
 *                    Admins, Admins and Finance; Finance marks it paid
 *   Extra hours      the allowance this period and the requests; a Team Leader
 *                    also asks for, and sees, the people of their teams
 */

import type { Access } from '@/lib/access/resolve'
import { db, loadCatalog, loadClockySettings, loadDirectory, oneOf, rowsOf, type Directory } from './clocky-context'
import { allowanceRange } from './allowance'
import { loadAllowanceUse, loadApprovedExtra } from './allowance-data'
import { dateLabel, localDate, monthYear, stampLabel } from './format'
import { INVOICE_STATE, stateKey } from './invoices-view'
import { money, moneyTotal } from './invoice-doc'
import { isFinance, loadInvoiceSettings, loadPayTerms, loadRouteSettings, loadRoutes, seesMoney } from './pay-terms'
import { addDays } from './periods'
import { formatDuration } from './rounding'
import { clientFolder } from './invoices-data'
import { reportTitle, totalsText } from './reimbursement-reports'
import { buildRmbDocList, type RmbDocItem, type RmbDocList, type RmbDocSource } from './rmb-docs-list'
import { teamColour } from '@/lib/directory/team-colour'

export type ReqTone = 'ok' | 'warn' | 'bad' | 'neu' | 'teal' | 'navy'

/** The clients and projects a request can name: the catalogue's top folders. */
export async function loadClients(): Promise<string[]> {
  const catalog = await loadCatalog()
  return [...new Set([...catalog.jobs.values()].filter(j => j.active && j.kind === 'regular').map(j => clientFolder(j.path)))].sort((a, b) => a.localeCompare(b))
}

// ── Reimbursements (9B) ─────────────────────────────────────────────────────

export interface RmbRow {
  id: number; date: string; category: string; what: string; amount: string; hasReceipt: boolean
  st: { label: string; tone: ReqTone }; info: string
  /** Sent with other receipts in one request (migration 122): the request, on its first row. */
  report?: { id: number; first: boolean; title: string; total: string }
  /** Everyone's view: who sent it. */
  who?: { name: string; initials: string; team: string | null; color: string }
}

export interface ReimbursementsPage {
  contractor: boolean
  rows: RmbRow[]
  /** Super Admins, Admins and Finance (owner, 2026-10-23): everyone's, with who sent each. Null for the rest. */
  everyone: RmbRow[] | null
  /** The same people: every reimbursement document, as the Invoices list (owner, 25 October 2026). Null for the rest. */
  documents: RmbDocList | null
  /** An employee's document waiting for Finance: the card that opens it. */
  doc: { id: number; number: string } | null
  clients: string[]
  today: string
}

type RRow = { id: number; person_id: string; spent_on: string; category: string; purpose: string; amount: number; currency: string; state: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; invoice_id: number | null; document_id: number | null; receipt_path: string; report_id: number | null }

/** A request's receipts stay together, where its latest one falls, oldest first inside it; the rest newest first. */
export function arrangeReimbursements<T extends Pick<RRow, 'id' | 'spent_on' | 'report_id'>>(list: readonly T[]): T[] {
  const latest = new Map<number, string>()
  for (const r of list) if (r.report_id != null && (latest.get(r.report_id) ?? '') < r.spent_on) latest.set(r.report_id, r.spent_on)
  const key = (r: T) => (r.report_id != null ? latest.get(r.report_id)! : r.spent_on)
  return [...list].sort((a, b) => key(b).localeCompare(key(a)) || (a.report_id ?? 0) - (b.report_id ?? 0) || (a.report_id != null ? a.spent_on.localeCompare(b.spent_on) || a.id - b.id : b.id - a.id))
}

export async function loadReimbursements(v: Pick<Access, 'personId' | 'isAdmin'>, zone: string, now = new Date()): Promise<ReimbursementsPage | null> {
  if (!v.personId) return null
  const me = v.personId
  const c = db()
  const [dir, clients, settings] = await Promise.all([loadDirectory(), loadClients(), loadRouteSettings()])
  const seesAll = v.isAdmin || isFinance(v, settings)
  let q = c.from('reimbursements').select('id, person_id, spent_on, category, purpose, amount, currency, state, decided_by, decided_at, decision_note, invoice_id, document_id, receipt_path, report_id').order('spent_on', { ascending: false })
  q = seesAll ? q.limit(1000) : q.eq('person_id', me).limit(200)
  const { data, error } = await q
  if (error) throw new Error(`Reimbursements could not be read: ${error.message}`)
  const loaded = (data ?? []) as RRow[]
  const people = [...new Set([me, ...loaded.map(r => r.person_id)])]
  const reportIds = [...new Set(loaded.map(r => r.report_id).filter((x): x is number => x != null))]
  const invIds = [...new Set(loaded.map(r => r.invoice_id).filter((x): x is number => x != null))]
  const docIds = [...new Set(loaded.map(r => r.document_id).filter((x): x is number => x != null))]
  // A failed read throws: a missing invoice or document would say "It goes on your next invoice" of one already on it.
  const [routes, reports, invs, docs] = await Promise.all([
    loadRoutes(people),
    reportIds.length ? c.from('reimbursement_reports').select('id, name').in('id', reportIds).then(r => rowsOf(r, 'Reimbursement requests could not be read')) : Promise.resolve([] as { id: number; name: string | null }[]),
    invIds.length ? c.from('invoices').select('id, number, state, paid_on, submission_id').in('id', invIds).then(r => rowsOf(r, 'Invoices could not be read')) : Promise.resolve([] as { id: number; number: string; state: string; paid_on: string | null; submission_id: number | null }[]),
    docIds.length ? c.from('reimbursement_documents').select('id, number, state, paid_on').in('id', docIds).then(r => rowsOf(r, 'Reimbursement documents could not be read')) : Promise.resolve([] as { id: number; number: string; state: string; paid_on: string | null }[]),
  ])
  const subIds = invs.map(i => i.submission_id).filter((x): x is number => x != null)
  const subs = subIds.length ? rowsOf(await c.from('tc_submissions').select('id, state').in('id', subIds), 'Timesheets could not be read') : []
  const inv = new Map(invs.map(i => [i.id, i]))
  const doc = new Map(docs.map(d => [d.id, d]))
  const subState = new Map(subs.map(s => [s.id, s.state]))
  const day = (t: string | null) => (t ? dateLabel(localDate(t, zone)).replace(/, \d{4}$/, '') : '')
  const whoOf = (id: string): RmbRow['who'] => {
    const p = dir.people.get(id), t = p?.teamId ? dir.teams.get(p.teamId) : undefined
    const name = dir.nameOf(id)
    return { name, initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), team: t?.name ?? null, color: teamColour(t?.color, t?.name) }
  }
  const build = (list: RRow[], withWho: boolean): RmbRow[] => list.map(r => {
    const i = r.invoice_id != null ? inv.get(r.invoice_id) : undefined
    const d = r.document_id != null ? doc.get(r.document_id) : undefined
    const mine = r.person_id === me
    let st: RmbRow['st'], info: string
    if (r.state === 'pending') { st = { label: 'Waiting', tone: 'warn' }; info = 'Waiting for a Super Admin.' }
    else if (r.state === 'denied') { st = { label: 'Denied', tone: 'bad' }; info = `Denied by ${dir.nameOf(r.decided_by)}${r.decision_note ? `: "${r.decision_note}"` : '.'}` }
    else if (r.state === 'paid') {
      st = { label: 'Paid', tone: 'ok' }
      info = i ? `Paid with ${i.number}${i.paid_on ? ` on ${dateLabel(i.paid_on)}` : ''}.` : d ? `Paid with ${d.number}${d.paid_on ? ` on ${dateLabel(d.paid_on)}` : ''}.` : 'Paid.'
    } else if (r.state === 'on_invoice' && i) {
      st = { label: 'On invoice', tone: 'navy' }
      const k = stateKey(i, i.submission_id != null ? { id: i.submission_id, state: subState.get(i.submission_id) ?? '' } : undefined, routes.get(r.person_id), settings)
      info = `Approved ${day(r.decided_at)}. On invoice ${i.number}, ${INVOICE_STATE[k].label.toLowerCase()}.`
    } else if (d) {
      st = { label: 'Approved', tone: 'teal' }
      info = `Approved ${day(r.decided_at)}. On reimbursement document ${d.number}, ${d.state === 'paid' ? 'paid' : 'waiting for Finance'}.`
    } else { st = { label: 'Approved', tone: 'teal' }; info = `Approved ${day(r.decided_at)}. It goes on ${mine ? 'your' : 'their'} next invoice by itself.` }
    const mates = r.report_id != null ? list.filter(x => x.report_id === r.report_id) : []
    const report = r.report_id != null ? {
      id: r.report_id, first: mates[0]?.id === r.id,
      title: reportTitle(reports.find(x => x.id === r.report_id)?.name, mates.length),
      total: totalsText(mates.map(x => ({ amount: Number(x.amount), currency: x.currency }))),
    } : undefined
    return { id: r.id, date: dateLabel(r.spent_on), category: r.category, what: r.purpose, amount: money(Number(r.amount), r.currency), hasReceipt: !!r.receipt_path, st, info, report, ...(withWho ? { who: whoOf(r.person_id) } : {}) }
  })
  const route = routes.get(me)
  const documents = seesAll ? await loadRmbDocList(isFinance(v, settings), settings.finance.map(dir.nameOf).join(' and '), dir, zone, localDate(now, zone)) : null
  const open = docs.find(d => d.state !== 'paid' && loaded.some(r => r.document_id === d.id && r.person_id === me))
  return {
    contractor: !!route?.isContractor,
    rows: build(arrangeReimbursements(loaded.filter(r => r.person_id === me)), false),
    everyone: seesAll ? build(arrangeReimbursements(loaded), true) : null,
    documents,
    doc: !route?.isContractor && open ? { id: open.id, number: open.number } : null, clients, today: localDate(now, zone),
  }
}

/** Every reimbursement document and its items' amounts. Only after the caller's check that the viewer sees everyone's money. */
async function loadRmbDocList(finance: boolean, financeNames: string, dir: Directory, zone: string, today: string): Promise<RmbDocList> {
  const c = db()
  const docs = rowsOf(await c.from('reimbursement_documents').select('id, number, person_id, state, total, paid_on, paid_ref, created_at').order('number', { ascending: false }).limit(1000), 'Reimbursement documents could not be read') as RmbDocSource[]
  // A failed read throws: a document with no items would show its total in dollars only.
  const items = docs.length ? rowsOf(await c.from('reimbursements').select('document_id, amount, currency, decided_at').in('document_id', docs.map(d => d.id)), 'The documents\' items could not be read') as RmbDocItem[] : []
  const person = (id: string) => {
    const p = dir.people.get(id), t = p?.teamId ? dir.teams.get(p.teamId) : undefined
    return { name: dir.nameOf(id), team: t?.name ?? '', color: teamColour(t?.color, t?.name) }
  }
  return buildRmbDocList({ finance, docs, items, person, financeNames, zone, today })
}

// ── One reimbursement document (9D) ─────────────────────────────────────────

export interface RmbDocPage {
  id: number
  number: string
  paid: boolean
  st: { label: string; tone: ReqTone }
  date: string
  personId: string
  who: string
  team: string
  first: string
  items: { id: number; date: string; category: string; what: string; amount: string; file: string }[]
  total: string
  billing: { name: string; line1: string; line2: string }
  canPay: boolean
  payNote: string
  history: { text: string; when: string; dot: string }[]
  pay: { who: string; line: string; total: string }
}

export async function loadRmbDocPage(v: Pick<Access, 'personId' | 'isAdmin'>, id: number, zone: string): Promise<RmbDocPage | null> {
  const c = db()
  const d = oneOf(await c.from('reimbursement_documents').select('id, number, person_id, state, total, paid_on, paid_ref, paid_by, created_at').eq('id', id).maybeSingle(), 'The reimbursement document could not be read')
  if (!d) return null
  const settings = await loadInvoiceSettings()
  if (!seesMoney(v, d.person_id, settings)) return null
  const [items, dir] = await Promise.all([
    c.from('reimbursements').select('id, spent_on, category, purpose, amount, currency, decided_by, decided_at, receipt_name').eq('document_id', d.id).order('decided_at').then(r => rowsOf(r, 'The document\'s items could not be read')),
    loadDirectory(),
  ])
  const p = dir.people.get(d.person_id)
  const team = (p?.teamId && dir.teams.get(p.teamId)?.name) || 'No team'
  const who = p?.name ?? 'Someone'
  const at = (t: string) => stampLabel(t, zone)
  const list = items
  const lines = (settings.billingAddress ?? '').split('\n')
  const paid = d.state === 'paid'
  const finance = isFinance(v, settings)
  const hist: { text: string; when: string; dot: string }[] = []
  list.forEach((i, n) => hist.push(n === 0
    ? { text: `Created when ${i.purpose} (${money(Number(i.amount), i.currency)}) was approved by ${dir.nameOf(i.decided_by)}`, when: i.decided_at ? at(i.decided_at) : at(d.created_at), dot: '#1E7D7F' }
    : { text: `Item added by itself: ${i.purpose} (${money(Number(i.amount), i.currency)}), approved by ${dir.nameOf(i.decided_by)}`, when: i.decided_at ? at(i.decided_at) : '', dot: '#012358' }))
  if (paid && d.paid_on) hist.push({ text: `Paid by ${dir.nameOf(d.paid_by)}${d.paid_ref ? `, ref. ${d.paid_ref}` : ''}`, when: dateLabel(d.paid_on), dot: '#1E9E6A' })
  const first = who.split(' ')[0]
  return {
    id: d.id, number: d.number, paid, st: paid ? { label: 'Paid', tone: 'ok' } : { label: 'Approved, waiting for Finance', tone: 'teal' },
    date: dateLabel(localDate(d.created_at, zone)), personId: d.person_id, who, team, first,
    items: list.map(i => ({ id: i.id, date: dateLabel(i.spent_on).replace(/, \d{4}$/, ''), category: i.category, what: i.purpose, amount: money(Number(i.amount), i.currency), file: i.receipt_name || 'receipt' })),
    total: moneyTotal(list.map(i => ({ amount: Number(i.amount), currency: i.currency }))),
    billing: { name: settings.billingName ?? 'True North Digital Marketing', line1: lines[0] ?? '', line2: lines.slice(1).join(', ') },
    canPay: finance && !paid,
    payNote: paid ? `Paid on ${d.paid_on ? dateLabel(d.paid_on) : ''}${d.paid_ref ? `, ref. ${d.paid_ref}` : ''} by ${dir.nameOf(d.paid_by)}.`
      : finance ? `You are Finance. Pay ${first} outside Rippling payroll, then mark it paid here.` : 'Only Finance marks it paid.',
    history: hist.reverse(),
    pay: { who, line: `${list.length} item${list.length === 1 ? '' : 's'}${list.length && list[list.length - 1].decided_at ? ` · approved ${dateLabel(localDate(list[list.length - 1].decided_at!, zone))}` : ''}`, total: moneyTotal(list.map(i => ({ amount: Number(i.amount), currency: i.currency }))) },
  }
}

// ── Extra hours (10E) ───────────────────────────────────────────────────────

export interface ExtraPage {
  /** The person's allowance this period, or null when they have none. */
  allowance: { period: string; used: string; cap: string; share: number; note: string } | null
  rows: { id: number; hours: string; when: string; client: string; why: string; st: { label: string; tone: ReqTone }; by: string; who: string | null }[]
  /** Team Leaders ask for someone on their teams; the others for themselves. */
  forOthers: boolean
  people: { id: string; name: string; context: string; cap: number | null; period: 'week' | 'month' | null }[]
  whens: { value: string; label: string; period: 'week' | 'month'; start: string; end: string }[]
  clients: string[]
  me: string
}

export async function loadExtraHours(v: Pick<Access, 'personId'> & { ledTeamIds: ReadonlySet<string> }, zone: string, now = new Date()): Promise<ExtraPage | null> {
  if (!v.personId) return null
  const c = db()
  const [dir, settings, clients] = await Promise.all([loadDirectory(), loadClockySettings(), loadClients()])
  const team = [...dir.people.values()].filter(p => p.active && p.id !== v.personId && p.teamIds.some(t => v.ledTeamIds.has(t))).map(p => p.id)
  const ids = [v.personId, ...team]
  const today = localDate(now, zone)
  const terms = await loadPayTerms(ids)
  const range = (p: 'week' | 'month') => allowanceRange(today, p, settings.weekStart)
  const extra = await loadApprovedExtra(ids, addDays(today, -40), addDays(today, 40))
  const use = await loadAllowanceUse(terms, now, extra)
  const { data, error } = await c.from('extra_hours_requests').select('id, person_id, asked_by, hours, period, period_start, period_end, client, reason, state, asked_at, decided_by, decided_at, decision_note')
    .in('person_id', ids).order('asked_at', { ascending: false }).limit(100)
  if (error) throw new Error(`Extra hours could not be read: ${error.message}`)
  const whenLabel = (r: { period: string; period_start: string }) => (r.period === 'month' ? monthYear(r.period_start) : `Week of ${dateLabel(r.period_start).replace(/, \d{4}$/, '')}`)
  const mine = use.get(v.personId)
  const contextOf = (id: string) => {
    const u = use.get(id)
    if (!u) return 'No allowance: hours are never flagged as over.'
    return `Allowance: ${u.hours}h a ${u.period}. ${u.period === 'month' ? monthYear(u.from).split(' ')[0] : 'This week'} so far: ${formatDuration(u.used)}, so ${formatDuration(u.left)} left before extra hours.`
  }
  const whens: ExtraPage['whens'] = []
  for (let i = 0; i < 2; i++) {
    const [y, m] = today.split('-').map(Number)
    const s = new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10)
    const r = allowanceRange(s, 'month', settings.weekStart)
    whens.push({ value: `month:${r.from}`, label: monthYear(r.from), period: 'month', start: r.from, end: r.to })
  }
  for (let i = 0; i < 3; i++) {
    const r = allowanceRange(addDays(range('week').from, i * 7), 'week', settings.weekStart)
    whens.push({ value: `week:${r.from}`, label: `Week of ${dateLabel(r.from).replace(/, \d{4}$/, '')}`, period: 'week', start: r.from, end: r.to })
  }
  return {
    allowance: mine ? {
      period: mine.period === 'month' ? monthYear(mine.from) : `Week of ${dateLabel(mine.from).replace(/, \d{4}$/, '')}`,
      used: formatDuration(mine.used), cap: `${mine.hours}h${mine.limit > mine.hours * 3600 ? ` + ${formatDuration(mine.limit - mine.hours * 3600)} approved` : ''}`,
      share: Math.min(1, mine.used / Math.max(1, mine.limit)),
      note: mine.over > 0 ? `${formatDuration(mine.over)} over the allowance without approval. They are flagged on the timesheet.` : `${formatDuration(mine.left)} left before extra hours. Going over needs approval before, not a surprise on the invoice.`,
    } : null,
    rows: (data ?? []).map(r => ({
      id: r.id, hours: formatDuration(Number(r.hours) * 3600), when: whenLabel(r), client: r.client ?? 'No client', why: r.reason,
      st: r.state === 'approved' ? { label: 'Approved', tone: 'ok' as const } : r.state === 'denied' ? { label: 'Denied', tone: 'bad' as const } : { label: 'Waiting', tone: 'warn' as const },
      by: r.state === 'pending' ? `Asked ${stampLabel(r.asked_at, zone)}${r.asked_by && r.asked_by !== r.person_id ? ` by ${dir.nameOf(r.asked_by)}` : ''}`
        : `${r.state === 'approved' ? 'Approved' : 'Denied'} by ${dir.nameOf(r.decided_by)}, ${r.decided_at ? dateLabel(localDate(r.decided_at, zone)) : ''}${r.state === 'denied' && r.decision_note ? `: "${r.decision_note}"` : ''}`,
      who: r.person_id === v.personId ? null : dir.nameOf(r.person_id),
    })),
    forOthers: team.length > 0,
    people: ids.map(id => ({ id, name: dir.nameOf(id), context: contextOf(id), cap: terms.get(id)?.allowance?.hours ?? null, period: terms.get(id)?.allowance?.period ?? null })),
    whens, clients, me: v.personId,
  }
}
