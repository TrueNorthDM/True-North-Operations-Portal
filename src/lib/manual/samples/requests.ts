/**
 * The System manual's Requests pictures (owner, 4 November 2026: the guides
 * show the real screens with made-up data). Everyone here is invented, and so
 * is every amount. "Now" is Tue, Nov 10, 2026, in New York. Chris Taylor is the
 * approver Company settings names; Maria Gomez is an employee, Jordan Lee and
 * Sam Patel are contractors, Ben Carter an employee with a reimbursement
 * document. Time off rows are built through the real helpers (time-off.ts).
 */

import { checksOf, countText, daysText, historyOf, offDays, pillOf, stepsOf, type OffRequest } from '@/lib/timeclock/time-off'
import type { TimeOffPage, TimeOffRow } from '@/lib/timeclock/time-off-data'
import type { ExtraPage, ReimbursementsPage, RmbDocPage } from '@/lib/timeclock/requests-data'
import type { QueueData, QueueRow } from '@/lib/timeclock/approval-queue'
import type { RequestCard } from '@/lib/timeclock/request-cards'

const TODAY = '2026-11-10'
const APPROVER = 'Chris Taylor'
const HOL: Record<string, string> = { '2026-11-26': 'Thanksgiving', '2026-11-27': 'Day after Thanksgiving', '2026-12-24': 'Christmas Eve', '2026-12-25': 'Christmas Day', '2027-01-01': "New Year's Day" }
const HOLS = new Map(Object.entries(HOL))
const TEAMC: Record<string, string> = { Graphics: '#C026D3', Leadership: '#1E40AF', SEO: '#F4C24A', 'Social Media': '#DC2626', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }
const TEAM: Record<string, string> = { 'Alex Rivera': 'Writers', 'Jordan Lee': 'Web', 'Sam Patel': 'SEO', 'Maria Gomez': 'Social Media', 'Chris Taylor': 'Leadership', 'Priya Nair': 'Translation', 'Ben Carter': 'Graphics' }
const ini = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2)
const CLIENTS = ['1 - True North', '2 - Sample Client', 'Northwind Foods', 'Harbor Health', 'Summit Schools']

/**
 * A moment written as people read it ("Nov 9, 2026, 4:40 PM", New York), as an
 * instant; `stamp` reads it back the same way, so the pictures never depend on
 * the browser's own date formatting.
 */
const LABELS = new Map<string, string>()
function at(label: string): string {
  const m = /^([A-Z][a-z]{2}) (\d+), (\d{4}), (\d+):(\d+) (AM|PM)$/.exec(label)
  if (!m) throw new Error(`Bad sample time: ${label}`)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[1])
  const h = (Number(m[4]) % 12) + (m[6] === 'PM' ? 12 : 0)
  // New York is 4 hours behind UTC until Nov 1, 2026, then 5.
  const off = mon > 10 || (mon === 10 && Number(m[2]) >= 1) || mon < 2 ? 5 : 4
  const iso = new Date(Date.UTC(Number(m[3]), mon, Number(m[2]), h + off, Number(m[5]))).toISOString()
  LABELS.set(iso, label)
  return iso
}
const stamp = (iso: string) => LABELS.get(iso) ?? ''

// ── Time off ────────────────────────────────────────────────────────────────

type Off = { id: number; who: string; type: string; a: string; b: string; st: 'pending' | 'approved'; note: string | null; asked: string; decided?: string }
const OFFS: Off[] = [
  { id: 1, who: 'Maria Gomez', type: 'Vacation', a: '2026-11-23', b: '2026-11-25', st: 'pending', note: 'Family trip for Thanksgiving.', asked: 'Nov 9, 2026, 4:40 PM' },
  { id: 2, who: 'Maria Gomez', type: 'Vacation', a: '2026-12-28', b: '2026-12-31', st: 'approved', note: 'End of the year with family.', asked: 'Oct 20, 2026, 2:10 PM', decided: 'Oct 21, 2026, 9:15 AM' },
  { id: 3, who: 'Maria Gomez', type: 'Sick', a: '2026-10-06', b: '2026-10-06', st: 'approved', note: null, asked: 'Oct 6, 2026, 7:05 AM', decided: 'Oct 6, 2026, 9:00 AM' },
]
/** Approved time off of other people, for Who else is off and the calendar dots. */
const OTHERS = [
  { personId: 'Priya Nair', who: 'Priya Nair', team: 'Translation', color: TEAMC.Translation, start: '2026-11-19', end: '2026-11-20' },
  { personId: 'Ben Carter', who: 'Ben Carter', team: 'Graphics', color: TEAMC.Graphics, start: '2026-11-24', end: '2026-11-25' },
]

function offRow(o: Off): TimeOffRow {
  const decided = o.decided ? at(o.decided) : null
  const req: OffRequest = {
    id: o.id, personId: o.who, who: o.who, type: o.type, start: o.a, end: o.b, hoursPerDay: 8, state: o.st, note: o.note,
    askedAt: at(o.asked), decidedAt: decided, decidedBy: decided ? APPROVER : null, decisionNote: null,
    // Rippling is not connected yet: approved days wait for it; the team calendar and the time entries are done.
    rippling: decided ? 'waiting_connection' : null, ripplingError: null, ripplingSentAt: null,
    calendar: decided ? 'done' : null, entriesWrittenAt: decided, cancelAskedAt: null, cancelReason: null,
  }
  const days = offDays(o.a, o.b, HOLS).days.length
  const seconds = days * 8 * 3600
  const pill = pillOf(req)
  return {
    id: o.id, personId: o.who, who: o.who, initials: ini(o.who), type: o.type, start: o.a, end: o.b,
    dates: daysText(o.a, o.b), count: countText(days, seconds), checks: checksOf(req, APPROVER), pill, seconds, waiting: o.st === 'pending',
    group: o.st === 'pending' ? 'pending' : o.a >= TODAY ? 'upcoming' : 'past',
    cancel: o.st === 'pending' ? 'direct' : o.a > TODAY ? 'ask' : null,
    drawer: {
      dates: `${daysText(o.a, o.b)}, ${o.b.slice(0, 4)}`, note: o.note,
      steps: stepsOf(req, { days, seconds, stamp, canRetry: false, who: APPROVER }), hist: historyOf(req, { stamp, nameOf: id => id ?? 'North Time' }),
      stateLabel: pill.label, stateTone: pill.tone,
    },
  }
}

/** Time off as Maria Gomez (Social Media, an employee) sees it. `asking`: the request she is about to send is not on the list yet. */
export function timeOffSample(asking = false): TimeOffPage {
  return {
    employee: true, canAll: false, me: { personId: 'Maria Gomez', name: 'Maria Gomez', team: 'Social Media' }, today: TODAY,
    types: [['Jury duty', true], ['Sick', true], ['Unpaid', false], ['Vacation', true]].map(([label, paid], i) => ({ id: i + 1, label: label as string, paid: paid as boolean })),
    mine: OFFS.filter(o => !asking || o.id !== 1).map(offRow),
    everyone: [],
    holidays: HOL,
    offs: OTHERS,
    teamLeader: null,
    decider: APPROVER,
  }
}

/** The request the time off form shows filled in. */
export const TIME_OFF_FORM = { type: 4, a: '2026-11-23', b: '2026-11-25', note: 'Family trip for Thanksgiving.', month: '2026-11' }

// ── Reimbursements ──────────────────────────────────────────────────────────

const waiting = { label: 'Waiting', tone: 'warn' as const }

/** Reimbursements as Jordan Lee (Web, a contractor) sees them: approved ones go on the next invoice. */
export function reimbursementsSample(): ReimbursementsPage {
  const trip: ReimbursementsPage['rows'] = [
    { id: 11, date: 'Nov 3, 2026', category: 'Travel', what: 'Flight to the client, round trip', amount: '$286.40', hasReceipt: true, st: waiting, info: `Waiting for ${APPROVER}.` },
    { id: 12, date: 'Nov 3, 2026', category: 'Meals while travelling', what: 'Dinner on the trip', amount: '$22.50', hasReceipt: true, st: waiting, info: `Waiting for ${APPROVER}.` },
    { id: 13, date: 'Nov 4, 2026', category: 'Mileage', what: 'Home to the airport and back (42 mi at $0.76 a mile)', amount: '$31.92', hasReceipt: false, st: waiting, info: `Waiting for ${APPROVER}.` },
  ].map((r, i) => ({ ...r, report: { id: 1, first: i === 0, title: 'Northwind Foods visit, Nov 3 to 4, 3 receipts', total: '$340.82' } }))
  return {
    contractor: true,
    rows: [
      ...trip,
      { id: 4, date: 'Oct 30, 2026', category: 'Internet', what: 'Home internet, October', amount: '$39.00', hasReceipt: true, st: { label: 'On invoice', tone: 'navy' }, info: 'Approved Nov 2. On invoice INV-2026-0207, waiting for approval.' },
      { id: 5, date: 'Sep 29, 2026', category: 'Software', what: 'Design software, September', amount: '$14.99', hasReceipt: true, st: { label: 'Paid', tone: 'ok' }, info: 'Paid with INV-2026-0188 on Oct 12, 2026.' },
      { id: 6, date: 'Sep 18, 2026', category: 'Meals with a client', what: 'Lunch with the client', amount: '$48.20', hasReceipt: true, st: { label: 'Denied', tone: 'bad' }, info: `Denied by ${APPROVER}: "Send it again with the client's name and the meeting."` },
    ],
    everyone: null, documents: null, doc: null, clients: CLIENTS, today: TODAY, mileageRate: 0.76,
  }
}

/** Reimbursements as Ben Carter (Graphics, an employee) sees them, with his document waiting for Finance. */
export function employeeReimbursementsSample(): ReimbursementsPage {
  return {
    contractor: false,
    rows: [
      { id: 21, date: 'Nov 5, 2026', category: 'Equipment', what: 'Drawing tablet pen, replacement', amount: '$39.99', hasReceipt: true, st: { label: 'Approved', tone: 'teal' }, info: 'Approved Nov 6. On reimbursement document RMB-2026-0042, waiting for Finance.' },
      { id: 22, date: 'Oct 28, 2026', category: 'Software', what: 'Font license for a client project', amount: '$25.00', hasReceipt: true, st: { label: 'Approved', tone: 'teal' }, info: 'Approved Oct 29. On reimbursement document RMB-2026-0042, waiting for Finance.' },
      { id: 23, date: 'Sep 30, 2026', category: 'Internet', what: 'Home internet, September', amount: '$45.00', hasReceipt: true, st: { label: 'Paid', tone: 'ok' }, info: 'Paid with RMB-2026-0035 on Oct 9, 2026.' },
    ],
    everyone: null, documents: null, doc: { id: 42, number: 'RMB-2026-0042' }, clients: CLIENTS, today: TODAY, mileageRate: 0.76,
  }
}

/** Ben Carter's reimbursement document, as he sees it. */
export function rmbDocSample(): RmbDocPage {
  return {
    id: 42, number: 'RMB-2026-0042', paid: false, st: { label: 'Approved, waiting for Finance', tone: 'teal' }, date: 'Oct 29, 2026', personId: 'Ben Carter', who: 'Ben Carter', team: 'Graphics', first: 'Ben',
    items: [
      { id: 22, date: 'Oct 28', category: 'Software', what: 'Font license for a client project', amount: '$25.00', file: 'RCT-2026-118 · font-license.pdf' },
      { id: 21, date: 'Nov 5', category: 'Equipment', what: 'Drawing tablet pen, replacement', amount: '$39.99', file: 'RCT-2026-131 · pen-receipt.jpg' },
    ],
    total: '$64.99', billing: { name: 'True North Digital Marketing', line1: '100 Sample Street, Suite 200', line2: 'Anytown, USA' },
    canPay: false, payNote: 'Only Finance marks it paid.',
    history: [
      { text: `Item added by itself: Drawing tablet pen, replacement ($39.99), approved by ${APPROVER}`, when: 'Nov 6, 2026, 10:12 AM', dot: '#012358' },
      { text: `Created when Font license for a client project ($25.00) was approved by ${APPROVER}`, when: 'Oct 29, 2026, 3:40 PM', dot: '#1E7D7F' },
    ],
    pay: { who: 'Ben Carter', line: '2 items · approved Nov 6, 2026', total: '$64.99' },
  }
}

// ── Extra hours ─────────────────────────────────────────────────────────────

/** Extra hours as Sam Patel (SEO, a contractor with 120h a month) sees them. */
export function extraSample(asking = false): ExtraPage {
  const rows: ExtraPage['rows'] = [
    { id: 1, hours: '10h 00m', when: 'November 2026', client: 'Northwind Foods', why: 'Site audit and fixes before their holiday sale, asked by the client.', st: { label: 'Waiting', tone: 'warn' }, by: 'Asked Nov 9, 2026, 5:20 PM', who: null },
    { id: 2, hours: '6h 00m', when: 'September 2026', client: 'Harbor Health', why: 'Keyword research for the new service pages.', st: { label: 'Approved', tone: 'ok' }, by: `Approved by ${APPROVER}, Sep 14, 2026`, who: null },
  ]
  return {
    allowance: { period: 'November 2026', used: '41h 30m', cap: '120h', share: 0.35, note: 'October: 118h 15m of 120h, nothing over the allowance.' },
    rows: asking ? rows.filter(r => r.id !== 1) : rows,
    forOthers: false,
    people: [{ id: 'sp', name: 'Sam Patel', context: 'Allowance: 120h a month. November so far: 41h 30m, so 78h 30m left before extra hours.', cap: 120, period: 'month' }],
    whens: [
      { value: 'month:2026-11-01', label: 'November 2026', period: 'month', start: '2026-11-01', end: '2026-11-30' },
      { value: 'month:2026-12-01', label: 'December 2026', period: 'month', start: '2026-12-01', end: '2026-12-31' },
      { value: 'week:2026-11-08', label: 'Week of Nov 8', period: 'week', start: '2026-11-08', end: '2026-11-14' },
      { value: 'week:2026-11-15', label: 'Week of Nov 15', period: 'week', start: '2026-11-15', end: '2026-11-21' },
    ],
    clients: CLIENTS,
    me: 'sp',
  }
}

/** What the extra hours form shows filled in. */
export const EXTRA_FORM = { hours: '10', when: 'month:2026-11-01', client: 'Northwind Foods', why: 'Site audit and fixes before their holiday sale, asked by the client.' }

// ── Approvals ───────────────────────────────────────────────────────────────

const OFF_CARD: RequestCard = {
  kind: 'off', id: 1, type: 'Time off', title: 'Vacation, 24h 00m', width: 720, twoCols: false, receipt: null,
  facts: [
    { k: 'Dates', v: 'Mon, Nov 23 to Wed, Nov 25, 2026' },
    { k: 'Counted', v: '3 working days, 8h a day, 24h 00m' },
    { k: 'Balance in Rippling', v: 'Vacation: the balance shows here once Rippling is connected.' },
    { k: 'Note', v: '"Family trip for Thanksgiving."' },
  ],
  allow: null,
  cal: { label: 'Team calendar, Nov 23 to 27', days: ['Mon 23', 'Tue 24', 'Wed 25', 'Thu 26', 'Fri 27'], rows: [
    { name: 'Maria Gomez', sub: 'This request', color: TEAMC['Social Media'], cells: ['req', 'req', 'req', null, null] },
    { name: 'Thanksgiving', sub: 'Company holiday', color: '#e4e7ec', cells: [null, null, null, 'hol', null] },
    { name: 'Day after Thanksgiving', sub: 'Company holiday', color: '#e4e7ec', cells: [null, null, null, null, 'hol'] },
  ] },
  after: 'On approval, by itself: Rippling gets 24h 00m of Vacation, the team calendar gets "Maria Gomez, out" on Mon, Nov 23 to Wed, Nov 25, and North Time writes 8h a day into their time entries.',
  canDecide: true, roText: null, approveLabel: 'Approve', denyLabel: 'Deny',
}

const RMB_ITEMS: NonNullable<RequestCard['items']> = [
  { id: 11, date: 'Nov 3', category: 'Travel', purpose: 'Flight to the client, round trip', amount: '$286.40', value: { amount: 286.4, currency: 'USD' }, client: 'Northwind Foods, billable', receipt: { id: 11, file: 'flight-receipt.pdf', sub: 'RCT-2026-140 · PDF, 180 KB' }, state: 'pending', note: null },
  { id: 12, date: 'Nov 3', category: 'Meals while travelling', purpose: 'Dinner on the trip', amount: '$22.50', value: { amount: 22.5, currency: 'USD' }, client: 'Northwind Foods, billable', receipt: { id: 12, file: 'dinner.jpg', sub: 'RCT-2026-141 · Photo, 640 KB' }, state: 'pending', note: null },
  { id: 13, date: 'Nov 4', category: 'Mileage', purpose: 'Home to the airport and back (42 mi at $0.76 a mile)', amount: '$31.92', value: { amount: 31.92, currency: 'USD' }, client: 'Northwind Foods, billable', receipt: null, state: 'pending', note: null },
]
const RMB_CARD: RequestCard = {
  kind: 'rmb-report', id: 1, type: 'Reimbursement', title: 'Northwind Foods visit, Nov 3 to 4, 3 receipts, $340.82', width: 760, twoCols: false, receipt: null, items: RMB_ITEMS,
  facts: [{ k: 'Client or project', v: 'Northwind Foods' }], allow: null, cal: null,
  after: 'Jordan Lee is a contractor. Each receipt you approve goes on their next invoice by itself, as its own line.',
  canDecide: true, roText: null, approveLabel: 'Approve all 3', denyLabel: 'Deny all',
}

const XH_CARD: RequestCard = {
  kind: 'xh', id: 1, type: 'Extra hours', title: '10h 00m in November', width: 620, twoCols: false, receipt: null,
  facts: [{ k: 'When', v: 'November 2026' }, { k: 'Client or project', v: 'Northwind Foods' }, { k: 'Why', v: '"Site audit and fixes before their holiday sale, asked by the client."' }],
  allow: 'Allowance: 120h a month. November so far: 41h 30m.', cal: null,
  after: "Approved, their November allowance becomes 130h. Hours past that are flagged again, in the clock panel, Who's working and this queue.",
  canDecide: true, roText: null, approveLabel: 'Approve', denyLabel: 'Deny',
}

function qrow(key: string, type: QueueRow['type'], who: string, x: Partial<QueueRow>): QueueRow {
  const team = TEAM[who]
  return {
    key, type, id: Number(key.replace(/\D/g, '')) || 1, personId: who, name: who, initials: ini(who), team: team ? { name: team, color: TEAMC[team] ?? null } : null,
    main: '', sub: '', flag: null, why: null, asked: '', askedAt: '', ownerName: APPROVER, own: false, done: null, href: null, card: null, request: null, ...x,
  }
}

/** Approvals as the approver Company settings names (Chris Taylor) sees them. */
export function queueSample(): QueueData {
  return {
    level: 'super_admin',
    subtitle: 'Your decisions: hours of the people who report to you, and the invoices, time off, reimbursements and extra hours that come to you (Company settings, Invoices: Who approves what). "With others" shows, read only, what Team Leaders and the other approvers still have.',
    wait: [
      qrow('o1', 'off', 'Maria Gomez', { main: 'Vacation · 24h 00m', sub: 'Mon, Nov 23 to Wed, Nov 25', why: '"Family trip for Thanksgiving."', asked: 'Asked Mon, Nov 9, 4:40 PM', request: OFF_CARD }),
      qrow('rr1', 'rmb', 'Jordan Lee', { main: 'Northwind Foods visit, Nov 3 to 4 · $340.82', sub: '3 receipts: Flight to the client, round trip, Dinner on the trip, Home to the airport and back (42 mi at $0.76 a mile)', why: 'Contractor: each receipt goes on their next invoice.', asked: 'Asked Thu, Nov 5, 9:20 AM', request: RMB_CARD }),
      qrow('x1', 'xh', 'Sam Patel', { main: 'Extra hours · 10h 00m', sub: 'November 2026 · Northwind Foods', why: '"Site audit and fixes before their holiday sale, asked by the client."', asked: 'Asked Mon, Nov 9, 5:20 PM', request: XH_CARD }),
    ],
    others: [
      qrow('x2', 'xh', 'Priya Nair', { main: 'Extra hours · 4h 00m', sub: 'Week of Nov 8 · Harbor Health', why: '"Urgent translation of the patient guide."', asked: 'Asked Tue, Nov 10, 8:05 AM', ownerName: 'Alex Rivera' }),
    ],
    done: [
      qrow('o9', 'off', 'Ben Carter', { main: 'Vacation · 16h 00m', sub: 'Tue, Nov 24 to Wed, Nov 25', done: { label: 'Approved', tone: 'ok', by: `${APPROVER}, Nov 2.` } }),
      qrow('r9', 'rmb', 'Alex Rivera', { main: 'Meals with a client · $52.10', sub: 'Lunch, Thu, Oct 29', done: { label: 'Denied', tone: 'bad', by: `${APPROVER}, Oct 30: "Add who the client was and what the meeting was for."` } }),
    ],
    note: 'Hours go to the person each one reports to. Invoices, time off and extra hours follow the invoice approvers, and reimbursements their own list, both in Company settings > Invoices (Who approves what).',
  }
}

/** The card a row opens, by its key. */
export const QUEUE_CARDS = { off: 'o1', rmb: 'rr1', xh: 'x1' } as const
