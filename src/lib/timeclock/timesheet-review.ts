/**
 * The 6C page of Clocky part 2 (Approvals.dc.html, frames 6C, 6C-t, 6C-i,
 * 6C-d, 6C-j, 6C-f, 6C-n, 6C-e, 6C-b, 6D, 6D-s, 6D-x): one timesheet and its
 * invoice (or payroll summary) side by side, as its viewer may see it.
 *
 * Everything the page shows is worked out here, on the server: the step
 * tracker, the banners, the three tabs (Summary, Time entries, Combined), the
 * invoice and its history, and what this viewer may do. Team Leaders never get
 * money: no invoice, no rate, no amount.
 *
 * Not a "use server" file: approvals/actions.ts serves it.
 */

import type { AccessLevel } from '@/lib/access/catalogue'
import type { Viewer } from './clocky-context'
import { db, loadDirectory, oneOf, rowsOf } from './clocky-context'
import { loadPeriodViews } from './clocky-entries'
import { allowanceStatus } from './allowance'
import { loadApprovedExtra } from './allowance-data'
import { clientFolder } from './invoices-data'
import { loadPayTerms, loadRouteSettings, seesMoney, type PayTerms } from './pay-terms'
import { periodLabel } from './periods'
import { currentStep, hoursApprover, invoiceApprover, oneStep, type RoutePerson, type RouteSettings, type TimesheetState } from './routing'
import { dateLabel, dayLabel, localDate, rangeLabel, stampLabel, timeLabel } from './format'
import { formatDuration } from './rounding'
import { INV_COLS, LINE_COLS, invoiceDocOf, usd, type InvRow, type InvoiceDocView, type LineRow } from './invoice-doc'
import type { EntryView } from './clocky-types'

export type ReviewTone = 'ok' | 'warn' | 'bad' | 'neu' | 'teal'
export type StepState = 'done' | 'now' | 'bad' | 'later'

/** Client colours (README_PART2 "Design tokens"); any other client is grey. A 2026 client takes its TSheets folder's. */
export const CLIENT_COLOR: Record<string, string> = {
  'True North Internal': '#012358', 'i7 Marketing': '#1E7D7F', 'COE Group': '#F2C40A',
  '1 - True North': '#012358', '2 - i7 Marketing': '#1E7D7F', 'Adventist Messengers/HFA': '#F2C40A', GNA: '#1E9E6A', 'A.org Job': '#6D5EF5', DDI: '#F0A35E',
}
const clientColor = (c: string) => CLIENT_COLOR[c] ?? '#a3aebb'
/** The client an entry bills, as its invoice lines name it: the 2026 client where its job has one (invoices-data.ts). */
const billedClient = (e: Pick<ReviewView, 'client2026' | 'path'>) => e.client2026 ?? clientFolder(e.path)
const hm = (sec: number) => formatDuration(sec)
const hmShort = (sec: number) => hm(sec).replace(' 00m', '')
const noYear = (s: string) => s.replace(/, \d{4}/, '')

export interface ReviewEntry {
  gap?: string
  time?: string
  dur?: string
  job?: string
  act?: string
  cp?: string
  code?: string
  meta?: string
  billable?: boolean
  note?: string
  color?: string
  client?: string
  flag?: { text: string; tone: ReviewTone } | null
}

export interface TimesheetReview {
  id: number
  /** 'timesheet' (a submission) or 'invoice' (fixed, no timesheet). */
  kind: 'timesheet' | 'invoice'
  personId: string
  who: string
  initials: string
  team: { name: string; color: string | null } | null
  zoneCity: string
  title: string
  state: { label: string; tone: ReviewTone }
  submitted: string
  steps: { n: string; label: string; sub: string; state: StepState }[]
  result: { text: string; tone: ReviewTone; icon: 'check' | 'undo' | 'alert'; retry: boolean } | null
  readOnly: string | null
  cadenceLine: string
  isContractor: boolean
  // Summary
  stats: { label: string; val: string; tone: 'ink' | 'warn' | 'ok'; size: 22 | 16 | 14 }[]
  allowance: { line: string; w1: number; w2: number; w3: number; cap: string; pre: string; over: string } | null
  clients: { label: string; val: string; billable: boolean }[]
  calendar: { iso: string | null; n: string; v: string; kind: 'work' | 'pto' | 'skip' | 'empty' | 'none'; tip: string }[]
  attention: { text: string; dot: string }[]
  // Time entries and Combined
  days: { iso: string; day: string; total: string; rows: ReviewEntry[] }[]
  entryClients: { client: string; color: string; count: number }[]
  entryCount: number
  totalText: string
  // Fixed, no timesheet
  noTimesheet: string[] | null
  // Money (invoice approvers, Super Admins, Admins, Finance, the person)
  invoice: InvoiceDocView | null
  previous: { title: string; rows: { per: string; hrs: string; amt: string; st: string; stTone: ReviewTone; current: boolean }[]; diff: string } | null
  history: { text: string; when: string; dot: string }[]
  payroll: { rows: { day: string; w: string; o: string; pto: boolean; worked: boolean }[]; total: string; worked: string; off: string; period: string; st: { label: string; tone: ReviewTone }; rip: { text: string; tone: ReviewTone; icon: 'check' | 'alert' | 'send' }; line: string } | null
  // What this viewer may do
  act: {
    kind: 'hours' | 'invoice' | 'both' | 'payroll' | null
    label: string
    barNote: string
    overWarn: string | null
    overInfo: string | null
    returnTitle: string
    returnText: string
    canReopen: boolean
    /** Reopening after Rippling got the hours: the portal cannot take them back there. */
    reopenWarn: string | null
  }
}

/** The entry fields the page reads (a subset of Time entries' EntryView). */
export type ReviewView = Pick<EntryView, 'kind' | 'seconds' | 'date' | 'billable' | 'path' | 'client2026' | 'short' | 'start' | 'end' | 'activity' | 'activityShown' | 'company' | 'project' | 'code' | 'notes' | 'autoOut'>

/** Everything the page is built from: read by gatherReview, or made up by a design check. */
export interface ReviewSource {
  viewer: { personId: string; level: AccessLevel; isSuperAdmin: boolean; ledTeamIds: ReadonlySet<string>; zone: string }
  sub: SubRow | null
  inv: InvRow | null
  invLines: LineRow[]
  /** The two invoices before this one, with their hours and reimbursements. */
  prev: { id: number; total: number; state: string; period_start: string; period_end: string; paid_on: string | null; seconds: number; rmb: number }[]
  /** This invoice's reimbursements, in dollars. */
  rmb: number
  settings: RouteSettings & { finance: readonly string[] }
  terms: Pick<PayTerms, 'paysAs' | 'hourlyRate' | 'fixedAmount' | 'allowance'> & { route: RoutePerson }
  person: { name: string; teamId: string | null; team: { name: string; color: string | null } | null; zone: string }
  /** Names by person id, for the approvers and deciders. */
  names: Readonly<Record<string, string>>
  views: ReviewView[]
  /** Extra hours approved for the period. */
  extraHours: number
  /** The Rippling job of an employee's approved pay period. */
  job: { state: string; last_error: string | null; done_at: string | null } | null
  now: Date
}

export type SubRow = {
  id: number; person_id: string; state: TimesheetState; submitted_at: string | null; approved_at: string | null; approved_by: string | null
  hours_approved_at: string | null; hours_approved_by: string | null; note: string | null; tc_periods: { start_date: string; end_date: string; kind: string } | null
}

/** A timesheet (?kind=timesheet) or a fixed, no timesheet invoice (?kind=invoice), as the viewer may see it; null when closed to them. */
export async function loadReview(v: Viewer, kind: 'timesheet' | 'invoice', id: number, now = new Date()): Promise<TimesheetReview | null> {
  const src = await gatherReview(v, kind, id, now)
  return src ? buildReview(src) : null
}

/** Reads what the page needs. */
export async function gatherReview(v: Viewer, kind: 'timesheet' | 'invoice', id: number, now = new Date()): Promise<ReviewSource | null> {
  const c = db()
  let sub: SubRow | null = null
  let inv: InvRow | null = null
  if (kind === 'timesheet') {
    // A failed read throws: an unread invoice would show the timesheet as hours only, an unread timesheet as missing.
    sub = oneOf(await c.from('tc_submissions').select('id, person_id, state, submitted_at, approved_at, approved_by, hours_approved_at, hours_approved_by, note, tc_periods(start_date, end_date, kind)').eq('id', id).maybeSingle(), 'The timesheet could not be read') as unknown as SubRow | null
    if (!sub?.tc_periods) return null
    inv = oneOf(await c.from('invoices').select(INV_COLS).eq('submission_id', sub.id).maybeSingle(), 'The invoice could not be read') as unknown as InvRow | null
  } else {
    inv = oneOf(await c.from('invoices').select(INV_COLS).eq('id', id).maybeSingle(), 'The invoice could not be read') as unknown as InvRow | null
    if (!inv || inv.kind !== 'fixed_no_timesheet') return null
  }
  const personId = sub?.person_id ?? inv!.person_id
  const start = sub?.tc_periods?.start_date ?? inv!.period_start
  const end = sub?.tc_periods?.end_date ?? inv!.period_end
  const [dir, settings, terms] = await Promise.all([loadDirectory(), loadRouteSettings(), loadPayTerms([personId])])
  const t = terms.get(personId)
  if (!t) return null
  const p = dir.people.get(personId)
  const team = p?.teamId ? dir.teams.get(p.teamId) : undefined
  const [views, extra, job, invLines, prevData] = await Promise.all([
    sub ? loadPeriodViews(v, personId, start, end, now) : Promise.resolve([] as EntryView[]),
    loadApprovedExtra([personId], start, end),
    sub && !t.route.isContractor
      ? c.from('integration_jobs').select('state, last_error, done_at').eq('ref_table', 'tc_submissions').eq('ref_id', sub.id).eq('kind', 'rippling_hours').maybeSingle().then(r => oneOf(r, "Rippling's answer could not be read"))
      : Promise.resolve(null),
    inv ? linesOf(inv.id) : Promise.resolve([] as LineRow[]),
    inv ? c.from('invoices').select('id, total, state, period_start, period_end, paid_on').eq('person_id', personId).lt('period_start', inv.period_start).order('period_start', { ascending: false }).limit(2).then(r => rowsOf(r, 'The last invoices could not be read')) : Promise.resolve([]),
  ])
  const prevIds = prevData.map(x => x.id)
  const prevLines = prevIds.length ? rowsOf(await c.from('invoice_lines').select('invoice_id, kind, hours_seconds, amount').in('invoice_id', prevIds), 'The last invoices could not be read') : []
  const ids = [personId, t.route.reportsTo, settings.defaultApprover, ...settings.invoiceApprovers, sub?.approved_by, sub?.hours_approved_by, inv?.approved_by].filter((x): x is string => !!x)
  return {
    viewer: { personId: v.personId, level: v.level, isSuperAdmin: v.isSuperAdmin, ledTeamIds: v.ledTeamIds, zone: v.zone },
    sub, inv, invLines,
    prev: prevData.map(x => ({
      ...x, total: Number(x.total),
      seconds: prevLines.filter(l => l.invoice_id === x.id).reduce((n, l) => n + (l.hours_seconds ?? 0), 0),
      rmb: prevLines.filter(l => l.invoice_id === x.id && l.kind === 'reimbursement').reduce((n, l) => n + Number(l.amount), 0),
    })),
    rmb: invLines.filter(l => l.kind === 'reimbursement').reduce((n, l) => n + Number(l.amount), 0),
    settings, terms: t,
    person: { name: dir.nameOf(personId), teamId: p?.teamId ?? null, team: team ? { name: team.name, color: team.color } : null, zone: dir.zoneOf(personId) },
    names: Object.fromEntries([...new Set(ids)].map(x => [x, dir.nameOf(x)])),
    views, extraHours: extra(personId, start, end), job, now,
  }
}

/** Builds the page from its source: pure. */
export function buildReview(src: ReviewSource): TimesheetReview | null {
  const { viewer: v, sub, inv, settings, terms: t, now } = src
  const personId = sub?.person_id ?? inv!.person_id
  const start = sub?.tc_periods?.start_date ?? inv!.period_start
  const end = sub?.tc_periods?.end_date ?? inv!.period_end
  const route = t.route
  const me = v.personId
  const isLead = v.level === 'team_leader'
  const hb = hoursApprover(route, settings)
  const ib = invoiceApprover(route, settings)
  // Who opens it: the person, whoever decides it, Admins and Super Admins, and a Team Leader of the person's team.
  const ledHere = !!src.person.teamId && v.ledTeamIds.has(src.person.teamId)
  const isAdmin = v.level === 'super_admin' || v.level === 'admin'
  if (!(isAdmin || me === personId || me === hb || me === ib || ledHere || settings.finance.includes(me))) return null
  const money = !isLead && seesMoney({ isAdmin, personId: me }, personId, settings) || (!isLead && me === ib)
  const nameOf = (pid: string | null) => (pid ? src.names[pid] ?? 'Someone' : 'Nobody yet')
  const youOr = (pid: string | null) => (pid && pid === me ? 'you' : nameOf(pid))
  const who = nameOf(personId)
  const first = who.split(' ')[0]
  const team = src.person.team
  const zone = src.person.zone
  const zoneCity = (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
  const period = periodLabel({ start, end })
  const ratePart = money ? (t.paysAs === 'hourly' ? (t.hourlyRate ? ` · ${usd(t.hourlyRate)}/h` : '') : t.fixedAmount ? ` · fixed ${usd(t.fixedAmount)} a month` : '') : ''

  // ── Fixed, no timesheet: the invoice alone ────────────────────────────────
  if (!sub) {
    const i = inv!
    const st: TimesheetState | 'approved' | 'returned' = i.state === 'waiting' ? 'submitted' : i.state === 'draft' ? 'returned' : 'approved'
    const done = st !== 'submitted'
    const canBoth = !done && me === ib && me !== personId
    const invoiceView = money ? invoiceDocOf(i, src.invLines, period.full) : null
    const result = st === 'approved'
      ? { text: `Approved by ${youOr(i.approved_by)}, ${noYear(stampLabel(i.approved_at!, v.zone))}. ${i.number} waits for Finance to pay it.`, tone: 'ok' as const, icon: 'check' as const, retry: false }
      : st === 'returned' ? { text: `Returned: the invoice is back to Draft.`, tone: 'bad' as const, icon: 'undo' as const, retry: false } : null
    return {
      id: i.id, kind: 'invoice', personId, who, initials: initialsOf(who), team, zoneCity,
      title: `${who}, ${period.full}`,
      state: { label: st === 'approved' ? 'Approved' : st === 'returned' ? 'Returned' : 'Waiting for approval', tone: st === 'approved' ? 'ok' : st === 'returned' ? 'bad' : 'warn' },
      submitted: `Created by itself, ${dateLabel(localDate(i.created_at, v.zone))}`,
      steps: [{ n: st === 'approved' ? '✓' : '1', label: `Invoice · ${nameOf(ib)}`, sub: st === 'approved' ? `Approved ${noYear(stampLabel(i.approved_at!, v.zone))}` : st === 'returned' ? 'Returned' : 'Waiting. No hours to approve', state: st === 'approved' ? 'done' : st === 'returned' ? 'bad' : 'now' }],
      result, readOnly: !canBoth && !done ? `Read only. Invoice: ${nameOf(ib)}.` : null,
      cadenceLine: `Contractor · fixed monthly, no timesheet · reports to ${nameOf(route.reportsTo)}`,
      isContractor: true, stats: [], allowance: null, clients: [], calendar: [], attention: [], days: [], entryClients: [], entryCount: 0, totalText: '',
      noTimesheet: [
        `${who} is paid a fixed amount every month and does not track time in North Time.`,
        `This invoice was made by itself on ${dateLabel(localDate(i.created_at, v.zone)).replace(/, \d{4}$/, '')} for ${period.label} and went straight to approval. Nobody submitted anything.`,
        invoiceView?.reimb.length ? 'Approved reimbursements are on the invoice as lines.' : 'Approved reimbursements would show here as lines on the invoice; there are none this month.',
      ],
      invoice: invoiceView,
      previous: money ? previousOf(src, invoiceView!, first, 0, true) : null,
      history: [
        st === 'approved' ? { text: 'Approved', when: noYear(dateLabel(localDate(i.approved_at!, v.zone))), dot: '#1E9E6A' } : { text: `Waiting for ${youOr(ib)}`, when: 'Now', dot: '#F2C40A' },
        { text: `Created by itself for ${period.label} (fixed monthly)`, when: noYear(dateLabel(localDate(i.created_at, v.zone))), dot: '#1E7D7F' },
      ],
      payroll: null,
      act: { kind: canBoth ? 'invoice' : null, label: 'Approve invoice', barNote: 'No timesheet: approving sends the invoice to Finance. Return sends it back to Draft, with your reason.', overWarn: null, overInfo: null, returnTitle: `Return ${period.label} to ${first}?`, returnText: `${i.number} goes back to Draft. ${first} sees your reason.`, canReopen: false, reopenWarn: null },
    }
  }

  // ── A timesheet ───────────────────────────────────────────────────────────
  const s = sub
  const views = src.views
  const work = views.filter(e => e.kind !== 'absence')
  const off = views.filter(e => e.kind === 'absence')
  const tot = work.reduce((n, e) => n + e.seconds, 0)
  const bill = work.filter(e => e.billable === 'yes').reduce((n, e) => n + e.seconds, 0)
  const pre = src.extraHours
  const over = t.allowance && t.allowance.period === 'month' ? allowanceStatus(tot, t.allowance.hours, pre).over : 0

  // By day, Monday first, the weeks around the period.
  const byDay = new Map<string, number>()
  for (const e of work) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.seconds)
  const ptoDay = new Map<string, { type: string; seconds: number }>()
  for (const e of off) ptoDay.set(e.date, { type: e.short || 'Time off', seconds: (ptoDay.get(e.date)?.seconds ?? 0) + e.seconds })
  const today = localDate(now, zone)
  const skip: string[] = []
  const calendar: TimesheetReview['calendar'] = []
  let g0 = start
  while (dow(g0) !== 1) g0 = addDay(g0, -1)
  let g1 = end
  while (dow(g1) !== 0) g1 = addDay(g1, 1)
  for (let d = g0; d <= g1; d = addDay(d, 1)) {
    const inP = d >= start && d <= end
    const w = dow(d)
    if (!inP) { calendar.push({ iso: null, n: '', v: '', kind: 'empty', tip: '' }); continue }
    const n = String(Number(d.slice(8)))
    const p = ptoDay.get(d)
    if (p) { calendar.push({ iso: d, n, v: `${p.type} ${hmShort(p.seconds)}`, kind: 'pto', tip: `${dayLabel(d)}: ${p.type}, ${hm(p.seconds)}` }); continue }
    const sec = byDay.get(d)
    if (sec) { calendar.push({ iso: d, n, v: hm(sec), kind: 'work', tip: `${dayLabel(d)}: ${hm(sec)}` }); continue }
    if (w > 0 && w < 6 && d <= today) { skip.push(d); calendar.push({ iso: d, n, v: 'No time', kind: 'skip', tip: `${dayLabel(d)}: weekday with no time` }); continue }
    calendar.push({ iso: d, n, v: '–', kind: 'none', tip: '' })
  }

  // By client.
  const cl = new Map<string, { s: number; b: number }>()
  for (const e of work) {
    const k = billedClient(e)
    const x = cl.get(k) ?? { s: 0, b: 0 }
    x.s += e.seconds
    if (e.billable === 'yes') x.b += e.seconds
    cl.set(k, x)
  }
  const clients = [...cl.entries()].sort((a, b) => b[1].s - a[1].s).map(([label, x]) => ({ label, val: hm(x.s), billable: x.b >= x.s / 2 }))

  // Needs attention: over the allowance, and every clock Clocky stopped.
  const attention: TimesheetReview['attention'] = []
  if (over > 0) attention.push({ text: `${hm(over)} over the allowance without advance approval.`, dot: '#c8323d' })
  for (const e of work.filter(x => x.autoOut)) {
    attention.push(e.autoOut!.confirmed
      ? { text: `${dayLabel(e.date)}: the clock stopped by itself. End time confirmed, ${e.end ? timeLabel(e.end, zone) : ''}.`, dot: '#a3aebb' }
      : { text: `${dayLabel(e.date)}: the clock stopped by itself and the end time was never confirmed.`, dot: '#d4a017' })
  }

  // Time entries, by day, with the time off the clock between them.
  const days: TimesheetReview['days'] = []
  for (const date of [...new Set(work.map(e => e.date))].sort()) {
    const list = work.filter(e => e.date === date).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    const rows: ReviewEntry[] = []
    let lastEnd: string | null = null
    for (const e of list) {
      if (lastEnd && e.start && Date.parse(e.start) - Date.parse(lastEnd) >= 60_000) rows.push({ gap: `Off the clock, ${timeLabel(lastEnd, zone)} to ${timeLabel(e.start, zone)}` })
      rows.push(entryRow(e, zone))
      if (e.end) lastEnd = e.end
    }
    days.push({ iso: date, day: dayLabel(date), total: hm(list.reduce((n, e) => n + e.seconds, 0)), rows })
  }
  const entryClients = [...cl.keys()].map(client => ({ client, color: clientColor(client), count: work.filter(e => billedClient(e) === client).length }))

  // The step, the state and what this viewer may do.
  const one = oneStep(route, settings)
  const step = currentStep(route, settings, s.state)
  const done = s.state === 'approved' || s.state === 'returned' || s.state === 'recorded'
  const hoursDone = s.state === 'hours_approved'
  const mine = !!step && step.owner === me && me !== personId
  const canHours = mine && step!.step === 'hours'
  const canBoth = mine && (step!.step === 'both' || step!.step === 'payroll')
  const canInv = mine && step!.step === 'invoice'
  const stLabel = s.state === 'approved' || s.state === 'recorded' ? (s.state === 'recorded' ? 'Recorded' : 'Approved') : s.state === 'returned' ? 'Returned' : hoursDone ? 'Hours approved' : 'Waiting for approval'
  const stTone: ReviewTone = s.state === 'approved' ? 'ok' : s.state === 'returned' ? 'bad' : s.state === 'recorded' ? 'neu' : hoursDone ? 'teal' : 'warn'
  const at = (iso: string | null) => (iso ? noYear(stampLabel(iso, v.zone)) : '')
  const ret = s.state === 'returned'
  const steps: TimesheetReview['steps'] = one
    ? [{ n: s.state === 'approved' || s.state === 'recorded' ? '✓' : '1', label: route.isContractor ? `Hours and invoice · ${nameOf(ib)}` : `Hours · ${nameOf(hb)}, then Rippling`, sub: s.state === 'approved' ? `Approved ${at(s.approved_at)}` : s.state === 'recorded' ? 'Recorded, no approval' : ret ? 'Returned' : 'Waiting. One step, one decision', state: s.state === 'approved' || s.state === 'recorded' ? 'done' : ret ? 'bad' : 'now' }]
    : [
      { n: s.hours_approved_at && !ret ? '✓' : '1', label: `Hours · ${nameOf(hb)}`, sub: s.hours_approved_at && !ret ? `Approved ${at(s.hours_approved_at)}` : ret ? 'Returned' : 'Waiting', state: s.hours_approved_at && !ret ? 'done' : ret ? 'bad' : 'now' },
      { n: s.state === 'approved' ? '✓' : '2', label: isLead ? `Then · ${nameOf(ib)}` : `Invoice · ${nameOf(ib)}`, sub: s.state === 'approved' ? `Approved ${at(s.approved_at)}` : ret ? 'Returned' : hoursDone ? 'Waiting' : 'After the hours', state: s.state === 'approved' ? 'done' : ret ? 'bad' : hoursDone ? 'now' : 'later' },
    ]

  // Rippling, for an employee's approved pay period.
  const job = src.job
  const offTotal = off.reduce((n, e) => n + e.seconds, 0)
  const offType = off[0]?.short || 'Time off'
  const ripWhat = `${hm(tot)} regular${offTotal ? ` and ${hm(offTotal)} ${offType}` : ''}`

  let result: TimesheetReview['result'] = null
  if (ret) result = { text: `Returned, ${at(s.approved_at)}: "${s.note ?? ''}". The timesheet is open again${route.isContractor ? ` and ${money && inv ? inv.number : 'the rest'} is back to Draft` : ' and nothing went to Rippling'}.`, tone: 'bad', icon: 'undo', retry: false }
  else if (s.state === 'recorded') result = { text: `Recorded, ${at(s.submitted_at)}. The Deputy Director's timesheet needs no approval.`, tone: 'neu', icon: 'check', retry: false }
  else if (s.state === 'approved' && route.isContractor) result = { text: `Approved by ${youOr(s.approved_by)}, ${at(s.approved_at)}${one ? '' : ` (hours by ${youOr(s.hours_approved_by)}, ${at(s.hours_approved_at)})`}. ${period.label} is locked${money && inv ? ` and ${inv.number} is ${inv.state === 'paid' ? 'Paid' : 'Approved, waiting for Finance'}` : ''}.${s.note ? ` Note: "${s.note}"` : ''}`, tone: 'ok', icon: 'check', retry: false }
  else if (s.state === 'approved') {
    result = job?.state === 'failed'
      ? { text: `Approved, but Rippling refused it: "${job.last_error ?? 'no reason given'}" Fix it in Rippling, then try again.`, tone: 'bad', icon: 'alert', retry: v.isSuperAdmin || me === hb }
      : job?.state === 'done' ? { text: `Approved and sent to Rippling, ${at(job.done_at)}. The pay period is locked.`, tone: 'ok', icon: 'check', retry: false }
        : { text: `Approved, ${at(s.approved_at)}. The pay period is locked; it goes to Rippling ${job?.state === 'waiting_connection' ? 'when Rippling is connected in Company settings' : 'in a moment'}.`, tone: 'ok', icon: 'check', retry: false }
  } else if (hoursDone && !one) result = { text: `Hours approved by ${youOr(s.hours_approved_by)}, ${at(s.hours_approved_at)}. ${ib === me ? 'The invoice is yours to approve.' : isLead ? `${nameOf(ib)} finishes the approval.` : `The invoice is with ${nameOf(ib)}.`}`, tone: 'teal', icon: 'check', retry: false }

  const act = canHours || canBoth || canInv
  const roText = isLead && hoursDone
    ? `Hours approved. ${nameOf(ib)} finishes the approval; invoices are not shown to Team Leaders.`
    : `Read only. ${one ? `${route.isContractor ? 'Hours and invoice' : 'Hours'}: ${route.isContractor ? nameOf(ib) : nameOf(hb)}.` : `Hours: ${nameOf(hb)}. Invoice: ${nameOf(ib)}.`}`
  const readOnly = !act && !done && !(hoursDone && (me === hb || isLead)) && s.state !== 'recorded' ? roText : null

  const invoiceView = money && inv ? invoiceDocOf(inv, src.invLines, period.full) : null
  const history: TimesheetReview['history'] = []
  if (s.state === 'approved') history.push({ text: `Approved by ${youOr(s.approved_by)}`, when: noYear(stampLabel(s.approved_at!, v.zone)), dot: '#1E9E6A' })
  else if (ret) history.push({ text: 'Returned, back to Draft', when: noYear(stampLabel(s.approved_at ?? now.toISOString(), v.zone)), dot: '#c8323d' })
  else history.push({ text: `Waiting for ${youOr(ib)}`, when: 'Now', dot: '#F2C40A' })
  if (s.hours_approved_at && !one) history.push({ text: `Hours approved by ${youOr(s.hours_approved_by)}`, when: noYear(stampLabel(s.hours_approved_at, v.zone)), dot: '#1E9E6A' })
  if (s.submitted_at) history.push({ text: `Created when ${first} submitted ${period.label}`, when: noYear(stampLabel(s.submitted_at, v.zone)), dot: '#1E7D7F' })

  const payroll: TimesheetReview['payroll'] = route.isContractor ? null : (() => {
    const rows: NonNullable<TimesheetReview['payroll']>['rows'] = []
    for (let d = start; d <= end; d = addDay(d, 1)) {
      const w = dow(d)
      if (w === 0 || w === 6) continue
      const p = ptoDay.get(d)
      const sec = byDay.get(d)
      rows.push({ day: dayLabel(d), w: sec ? hm(sec) : '–', worked: !!sec, o: p ? `${hm(p.seconds)} ${p.type}` : '–', pto: !!p })
    }
    const rip: NonNullable<TimesheetReview['payroll']>['rip'] = s.state !== 'approved'
      ? { text: `Sent to Rippling when approved: ${ripWhat}, by day.`, tone: 'neu', icon: 'send' }
      : job?.state === 'failed' ? { text: `Rippling refused it: "${job.last_error ?? 'no reason given'}" Try again.`, tone: 'bad', icon: 'alert' }
        : job?.state === 'done' ? { text: `Sent to Rippling, ${at(job.done_at)}: ${ripWhat}.`, tone: 'ok', icon: 'check' }
          : { text: `Approved: ${ripWhat} wait for Rippling to be connected in Company settings.`, tone: 'neu', icon: 'send' }
    return {
      rows, total: `Total, ${hm(tot + offTotal)}`, worked: hm(tot), off: offTotal ? `${hm(offTotal)} ${offType}` : '–', period: rangeLabel(start, end) + `, ${end.slice(0, 4)}`,
      st: s.state === 'approved' ? (job?.state === 'failed' ? { label: 'Rippling refused it', tone: 'bad' } : { label: job?.state === 'done' ? 'Sent to Rippling' : 'Approved', tone: 'ok' }) : ret ? { label: 'Returned', tone: 'bad' } : { label: 'Waiting for approval', tone: 'warn' },
      rip,
      line: `${team?.name ?? 'No team'} · US Employee · paid through Rippling payroll`,
    }
  })()

  return {
    id: s.id, kind: 'timesheet', personId, who, initials: initialsOf(who), team, zoneCity,
    title: route.isContractor ? `${who}, ${period.full}` : `${who}, pay period ${rangeLabel(start, end)}`,
    state: { label: stLabel, tone: stTone },
    // Their own clock too, when it reads differently from the viewer's (Approvals.dc.html 6C-j).
    submitted: s.submitted_at
      ? `Submitted ${stampLabel(s.submitted_at, v.zone)}${timeLabel(s.submitted_at, zone) !== timeLabel(s.submitted_at, v.zone) ? ` (${timeLabel(s.submitted_at, zone)} in ${zoneCity})` : ''}`
      : '',
    steps, result, readOnly,
    cadenceLine: route.isContractor
      ? `Contractor · submits ${period.label.includes(' to ') ? 'every 2 weeks' : 'monthly'}${ratePart} · reports to ${nameOf(route.reportsTo)}`
      : `US Employee · submits every 2 weeks · reports to ${nameOf(route.reportsTo)}`,
    isContractor: route.isContractor,
    stats: [
      { label: 'Total', val: hm(tot), tone: 'ink', size: 22 },
      { label: 'Billable', val: `${hm(bill)} (${tot ? Math.round((bill / tot) * 100) : 0}%)`, tone: 'ink', size: 16 },
      { label: 'Weekdays with no time', val: skip.length ? skip.map(dayLabel).join(', ') : 'None', tone: skip.length ? 'warn' : 'ok', size: 14 },
    ],
    allowance: t.allowance && t.allowance.period === 'month' && tot > t.allowance.hours * 3600 ? (() => {
      const cap = t.allowance!.hours * 3600
      const preS = Math.round(pre * 3600)
      return {
        line: `${hmShort(cap)} allowance · ${hm(tot)} worked · ${hm(tot - cap)} over, ${hmShort(preS)} approved in advance`,
        w1: (cap / tot) * 100, w2: (Math.min(preS, tot - cap) / tot) * 100, w3: (over / tot) * 100,
        cap: hm(cap), pre: hm(preS), over: hm(over),
      }
    })() : null,
    clients, calendar, attention,
    days, entryClients, entryCount: work.length, totalText: hm(tot),
    noTimesheet: null,
    invoice: invoiceView,
    previous: invoiceView && inv ? previousOf(src, invoiceView, first, tot, t.paysAs !== 'hourly') : null,
    history,
    payroll,
    act: {
      kind: canHours ? 'hours' : canInv ? 'invoice' : canBoth ? (route.isContractor ? 'both' : 'payroll') : null,
      label: canHours ? 'Approve hours' : canInv ? 'Approve invoice' : route.isContractor ? 'Approve both' : 'Approve and send to Rippling',
      barNote: canHours ? `You approve the hours only. Then ${nameOf(ib)} finishes it; invoices are not shown to Team Leaders. Return sends it back to ${first}, with your reason.`
        : canInv ? `${nameOf(s.hours_approved_by)} approved the hours. Approve the invoice to lock both. Return sends both back to ${first}, with your reason.`
          : route.isContractor ? 'One decision for both. Approve locks the timesheet and approves the invoice. Return sends both back, with your reason.'
            : 'Approve locks the pay period and sends the hours and the PTO to Rippling. Return reopens it, with your reason.',
      overWarn: over > 0 && (canBoth || canInv) ? `${hm(over)} over the allowance were not approved in advance. Approve still works, with a note.` : null,
      overInfo: over > 0 && canHours ? `${hm(over)} over the allowance, not approved in advance. ${nameOf(ib)} decides these hours with the invoice.` : null,
      returnTitle: route.isContractor ? `Return ${period.label} to ${first}?` : `Return the pay period to ${first}?`,
      returnText: route.isContractor
        ? (canHours ? `The timesheet unlocks. ${first} sees your reason, fixes the hours and submits again.` : `The timesheet unlocks and ${money && inv ? inv.number : 'the invoice'} goes back to Draft. ${first} sees your reason, fixes the hours and submits again; the invoice is made again.${canInv ? ` ${nameOf(s.hours_approved_by)} is told too.` : ''}`)
        : `The pay period unlocks and nothing goes to Rippling. ${first} sees your reason, fixes the hours and submits again.`,
      canReopen: v.isSuperAdmin && (s.state === 'approved' || s.state === 'recorded') && inv?.state !== 'paid',
      reopenWarn: payroll?.st.label === 'Sent to Rippling' ? 'These hours were already sent to Rippling. Reopening here does not change Rippling; fix it there too.' : null,
    },
  }
}

function entryRow(e: ReviewView, zone: string): ReviewEntry {
  const client = billedClient(e)
  return {
    time: e.start ? `${timeLabel(e.start, zone)} to ${e.end ? timeLabel(e.end, zone) : 'now'}` : 'Duration only',
    dur: formatDuration(e.seconds), job: e.path, act: e.activityShown || e.activity || '–', cp: [e.company, e.project].filter(Boolean).join(' · ') || '–',
    code: e.code || '–', meta: [e.activityShown || e.activity, e.company, e.project, e.code].filter(Boolean).join(' · '),
    billable: e.billable === 'yes', note: e.notes, color: clientColor(client), client,
    flag: e.autoOut ? (e.autoOut.confirmed ? { text: 'Stopped by North Time, end time confirmed', tone: 'neu' } : { text: 'Stopped by North Time, end time not confirmed', tone: 'warn' }) : null,
  }
}

async function linesOf(invoiceId: number): Promise<LineRow[]> {
  const { data, error } = await db().from('invoice_lines').select(LINE_COLS).eq('invoice_id', invoiceId).order('sort')
  if (error) throw new Error(`The invoice lines could not be read: ${error.message}`)
  return (data ?? []) as LineRow[]
}

/** "<first>'s last invoices": this one and the two before, and how it compares with the last. */
function previousOf(src: ReviewSource, now: NonNullable<TimesheetReview['invoice']>, first: string, seconds: number, fixed: boolean): TimesheetReview['previous'] {
  const prev = src.prev
  if (!prev.length) return null
  const totalNow = Number(now.total.replace(/[$,]/g, ''))
  const p0 = prev[0]
  const d = (totalNow - src.rmb) - (p0.total - p0.rmb)
  const dh = seconds - p0.seconds
  const prevName = periodLabel({ start: p0.period_start, end: p0.period_end }).label
  const diff = fixed
    ? `Same fixed amount as ${prevName}.`
    : `${Math.abs(d) < 0.005 ? 'Same as' : `${usd(Math.abs(d))} ${d > 0 ? 'more than' : 'less than'}`} ${prevName}: ${dh === 0 ? 'same hours' : `${formatDuration(Math.abs(dh))} ${dh > 0 ? 'more' : 'less'}`}, same rate.${src.rmb ? ' Plus the reimbursement.' : ''}`
  return {
    title: `${first}'s last invoices`,
    rows: [
      { per: now.period, hrs: seconds ? formatDuration(seconds) : '–', amt: now.total, st: now.state.label === 'Approved' || now.state.label === 'Paid' ? now.state.label : 'This one', stTone: now.state.label === 'Approved' || now.state.label === 'Paid' ? 'ok' : 'warn', current: true },
      ...prev.map(p => ({
        per: periodLabel({ start: p.period_start, end: p.period_end }).full, hrs: p.seconds ? formatDuration(p.seconds) : '–', amt: usd(p.total),
        st: p.state === 'paid' && p.paid_on ? `Paid ${dateLabel(p.paid_on).replace(/, \d{4}$/, '')}` : p.state === 'approved' ? 'Approved' : p.state === 'draft' ? 'Draft' : 'Waiting',
        stTone: (p.state === 'paid' || p.state === 'approved' ? 'ok' : 'warn') as ReviewTone, current: false,
      })),
    ],
    diff,
  }
}

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const addDay = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const initialsOf = (n: string) => n.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
