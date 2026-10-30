// The Requests pages with the prototype's data (Requests.dc.html: PTO0, RMB0,
// HOL, the extra hours, frame()), built through the real time off helpers
// where there is one. "Now" is Tue, Nov 3, 2026.

import { checksOf, countText, daysText, historyOf, offDays, pillOf, stepsOf, type OffRequest } from '@/lib/timeclock/time-off'
import type { TimeOffPage, TimeOffRow } from '@/lib/timeclock/time-off-data'
import type { ExtraPage, ReimbursementsPage, RmbDocPage } from '@/lib/timeclock/requests-data'
import { rmbDocOf, type DocSheetData } from '@/lib/timeclock/pay-docs'
import { buildRmbDocList } from '@/lib/timeclock/rmb-docs-list'

const TODAY = '2026-11-03'
const HOL: Record<string, string> = { '2026-11-26': 'Thanksgiving', '2026-11-27': 'Day after Thanksgiving', '2026-12-24': 'Christmas Eve', '2026-12-25': 'Christmas Day', '2027-01-01': "New Year's Day" }
const HOLS = new Map(Object.entries(HOL))
const MONTH: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
/** "Oct 22, 2026, 3:12 PM" in New York to an instant. */
function at(text: string): string {
  const m = /^([A-Z][a-z]{2}) (\d+), (\d{4}), (\d+):(\d+) (AM|PM)$/.exec(text)!
  const mon = MONTH[m[1]], d = +m[2]
  const offset = mon > 11 || (mon === 11 && d >= 1) || mon < 3 ? 5 : 4
  return new Date(Date.UTC(+m[3], mon - 1, d, (+m[4] % 12) + (m[6] === 'PM' ? 12 : 0) + offset, +m[5])).toISOString()
}
const stamp = (t: string) => {
  const d = new Date(t)
  const ny = new Date(d.getTime() - (d.getUTCMonth() > 9 || d.getUTCMonth() < 2 ? 5 : 4) * 3600_000)
  const h = ny.getUTCHours(), m = ny.getUTCMinutes()
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ny.getUTCMonth()]} ${ny.getUTCDate()}, ${ny.getUTCFullYear()}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

type P = { id: number; who: string; type: string; a: string; b: string; min: number; st: 'wait' | 'appr'; note: string; asked: string; dec?: string; rip?: 'sent' | 'fail' }
const PTO: P[] = [
  { id: 1, who: 'Tina Gennette', type: 'Vacation', a: '2026-11-23', b: '2026-11-25', min: 1440, st: 'wait', note: 'Family trip for Thanksgiving.', asked: 'Nov 2, 2026, 4:40 PM' },
  { id: 2, who: 'Tina Gennette', type: 'Vacation', a: '2026-12-28', b: '2026-12-31', min: 1920, st: 'appr', note: 'End of the year with family.', asked: 'Oct 22, 2026, 2:10 PM', dec: 'Oct 22, 2026, 3:12 PM', rip: 'sent' },
  { id: 8, who: 'Tina Gennette', type: 'Vacation', a: '2026-11-09', b: '2026-11-10', min: 960, st: 'appr', note: '', asked: 'Oct 5, 2026, 10:00 AM', dec: 'Oct 5, 2026, 1:30 PM', rip: 'sent' },
  { id: 3, who: 'Tina Gennette', type: 'Vacation', a: '2026-10-09', b: '2026-10-09', min: 480, st: 'appr', note: '', asked: 'Oct 1, 2026, 11:00 AM', dec: 'Oct 1, 2026, 4:20 PM', rip: 'sent' },
  { id: 4, who: 'Tina Gennette', type: 'Sick', a: '2026-09-08', b: '2026-09-08', min: 480, st: 'appr', note: '', asked: 'Sep 8, 2026, 7:05 AM', dec: 'Sep 8, 2026, 9:00 AM', rip: 'sent' },
  { id: 5, who: 'Dave Sharpe', type: 'Sick', a: '2026-10-29', b: '2026-10-29', min: 480, st: 'appr', note: 'Flu, back tomorrow.', asked: 'Oct 29, 2026, 7:40 AM', dec: 'Nov 2, 2026, 11:18 AM', rip: 'fail' },
  { id: 6, who: 'Wendy Cacka', type: 'Vacation', a: '2026-11-25', b: '2026-11-27', min: 480, st: 'appr', note: '', asked: 'Oct 20, 2026, 1:00 PM', dec: 'Oct 21, 2026, 10:30 AM', rip: 'sent' },
  { id: 9, who: 'Wendy Cacka', type: 'Vacation', a: '2026-10-16', b: '2026-10-16', min: 480, st: 'appr', note: '', asked: 'Oct 9, 2026, 11:00 AM', dec: 'Oct 15, 2026, 9:20 AM', rip: 'sent' },
  { id: 7, who: 'Dave Sharpe', type: 'Vacation', a: '2026-12-21', b: '2026-12-23', min: 1440, st: 'appr', note: '', asked: 'Oct 12, 2026, 9:00 AM', dec: 'Oct 12, 2026, 2:00 PM', rip: 'sent' },
]
const TEAM: Record<string, string> = { 'Tina Gennette': 'Operations', 'Wendy Cacka': 'Web', 'Dave Sharpe': 'Leadership' }
const COLOR: Record<string, string> = { Operations: '#92400E', Web: '#A99BD4', Leadership: '#1E40AF' }

function row(p: P, me: string, cancelAsked = false): TimeOffRow {
  const req: OffRequest = {
    id: p.id, personId: p.who, who: p.who, type: p.type, start: p.a, end: p.b, hoursPerDay: 8, state: p.st === 'wait' ? 'pending' : 'approved',
    note: p.note || null, askedAt: at(p.asked), decidedAt: p.dec ? at(p.dec) : null, decidedBy: p.dec ? 'Arnaldo Oliveira' : null, decisionNote: null,
    rippling: p.rip === 'sent' ? 'sent' : p.rip === 'fail' ? 'refused' : null, ripplingError: p.rip === 'fail' ? 'Sick balance is 0h.' : null,
    ripplingSentAt: p.rip === 'sent' && p.dec ? at(p.dec) : null, calendar: p.st === 'appr' ? 'done' : null, entriesWrittenAt: p.dec ? at(p.dec) : null,
    cancelAskedAt: cancelAsked ? at('Nov 3, 2026, 9:32 AM') : null, cancelReason: cancelAsked ? 'Plans changed.' : null,
  }
  const days = offDays(p.a, p.b, HOLS).days.length
  const pill = pillOf(req)
  const refused = req.rippling === 'refused'
  return {
    id: p.id, personId: p.who, who: p.who, initials: p.who.split(' ').map(w => w[0]).join(''), type: p.type, start: p.a, end: p.b,
    dates: daysText(p.a, p.b), count: countText(days, p.min * 60), checks: checksOf(req), pill, seconds: p.min * 60, waiting: req.state === 'pending',
    group: req.state === 'pending' || cancelAsked ? 'pending' : p.a >= TODAY ? 'upcoming' : 'past',
    cancel: p.who !== me ? null : req.state === 'pending' ? 'direct' : !cancelAsked && p.a > TODAY ? 'ask' : null,
    drawer: {
      dates: `${daysText(p.a, p.b)}, ${p.b.slice(0, 4)}`, note: req.note,
      steps: stepsOf(req, { days, seconds: p.min * 60, stamp, canRetry: me === 'Arnaldo Oliveira' }), hist: historyOf(req, { stamp, nameOf: id => id ?? 'North Time' }),
      stateLabel: refused ? 'Approved, Rippling refused it' : pill.label, stateTone: refused ? 'bad' : pill.tone,
    },
  }
}

/** 7A to 7E: Tina Gennette (Operations, employee); 7D-x as Arnaldo Oliveira, Everyone. */
export function timeOffFrame(frame: string): TimeOffPage {
  const sup = frame === '7Dx'
  const me = sup ? 'Arnaldo Oliveira' : 'Tina Gennette'
  const list = frame === '7A' || frame === '7Ap' ? PTO.filter(p => p.id !== 1) : PTO
  return {
    employee: true, canAll: sup, me: { personId: me, name: me, team: sup ? 'Leadership' : 'Operations' }, today: TODAY,
    types: [['Vacation', true], ['Sick', true], ['Holiday', true], ['Jury duty', true], ['Unpaid', false]].map(([label, paid], i) => ({ id: i + 1, label: label as string, paid: paid as boolean })),
    mine: list.filter(p => p.who === me).map(p => row(p, me)),
    everyone: sup ? list.map(p => row(p, me)) : [],
    holidays: HOL,
    offs: PTO.filter(p => p.st === 'appr' && p.who !== me).map(p => ({ personId: p.who, who: p.who, team: TEAM[p.who], color: COLOR[TEAM[p.who]], start: p.a, end: p.b })),
    teamLeader: null,
  }
}

/** 9A, 9B: Justus Tsofa (contractor). */
export function reimbursementsFrame(frame: string): ReimbursementsPage {
  const rows: ReimbursementsPage['rows'] = [
    { id: 1, date: 'Oct 31, 2026', category: 'Software', what: 'Canva Pro, November', amount: '$12.99', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.' },
    { id: 3, date: 'Oct 25, 2026', category: 'Internet', what: 'Internet, October', amount: '$35.00', hasReceipt: true, st: { label: 'On invoice', tone: 'navy' }, info: 'Approved Oct 27. On invoice INV-2026-0142, waiting for approval.' },
    { id: 4, date: 'Sep 27, 2026', category: 'Internet', what: 'Internet, September', amount: '$35.00', hasReceipt: true, st: { label: 'Paid', tone: 'ok' }, info: 'Paid with INV-2026-0131 on Oct 12, 2026.' },
    { id: 5, date: 'Sep 14, 2026', category: 'Travel', what: 'Matatu fares to a client meeting', amount: '$18.40', hasReceipt: true, st: { label: 'Denied', tone: 'bad' }, info: 'Denied by Arnaldo Oliveira: "Send it again with the client and the date of the meeting."' },
  ]
  // 9Br: a trip sent as one request with four receipts (migration 122).
  const trip: ReimbursementsPage['rows'] = [
    { id: 11, date: 'Oct 12, 2026', category: 'Travel', what: 'Flight GRU, round trip', amount: '$412.00', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.' },
    { id: 12, date: 'Oct 12, 2026', category: 'Travel', what: 'Hotel, 3 nights', amount: '$378.60', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.' },
    { id: 13, date: 'Oct 13, 2026', category: 'Travel', what: 'Uber to the client', amount: '$18.40', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.' },
    { id: 14, date: 'Oct 13, 2026', category: 'Meals with a client', what: 'Lunch with the i7 team', amount: '$64.00', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.' },
  ].map((r, i) => ({ ...r, report: { id: 1, first: i === 0, title: 'São Paulo trip, Oct 12 to 15, 4 receipts', total: '$873.00' } }))
  // 9Be: Everyone, as a Super Admin sees it (owner, 2026-10-23): who sent each one.
  const who = (name: string, team: string, color: string) => ({ name, initials: name.split(' ').map(w => w[0]).join(''), team, color })
  const jt = who('Justus Tsofa', 'Africa', '#F0A35E'), wc = who('Wendy Cacka', 'Web', '#A99BD4'), ji = who('Joy Inyele', 'Africa', '#F0A35E'), ap = who('Amy Prindle', 'Writers', '#86C06A')
  const everyone: ReimbursementsPage['rows'] = [
    ...trip.map(r => ({ ...r, who: jt, report: r.report ? { ...r.report, title: 'São Paulo trip, Oct 12 to 15, 4 receipts' } : undefined })),
    { id: 21, date: 'Nov 2, 2026', category: 'Software', what: 'Figma Professional, Oct to Dec', amount: '$45.00', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.', who: wc },
    { ...rows[0], who: jt },
    { id: 22, date: 'Oct 30, 2026', category: 'Equipment', what: 'USB headset for client calls', amount: '$48.00', hasReceipt: true, st: { label: 'Waiting', tone: 'warn' as const }, info: 'Waiting for a Super Admin.', who: ji },
    { ...rows[1], who: jt, info: rows[1].info },
    { id: 23, date: 'Oct 22, 2026', category: 'Meals with a client', what: 'Lunch, Thu, Oct 22', amount: '$64.20', hasReceipt: true, st: { label: 'Denied', tone: 'bad' as const }, info: 'Denied by Arnaldo Oliveira: "No client meeting that day. Send it again with the meeting."', who: ap },
    { id: 24, date: 'Oct 19, 2026', category: 'Equipment', what: 'USB-C hub for a second monitor', amount: '$12.99', hasReceipt: true, st: { label: 'Approved', tone: 'teal' as const }, info: 'Approved Oct 21. On reimbursement document RMB-2026-0031, waiting for Finance.', who: wc },
    { ...rows[2], who: jt }, { ...rows[3], who: jt },
  ]
  return { contractor: true, everyone: frame === '9Be' ? everyone : null, rows: frame === '9A' ? rows.filter(r => r.id !== 3) : frame === '9Br' ? [...trip, ...rows] : rows, documents: null, doc: null, clients: ['1 - True North', '2 - i7 Marketing', 'A.org Job', 'Adventist Messengers/HFA', 'DDI', 'GNA', 'Rwanda-Incidental'], today: TODAY, mileageRate: 0.76 }
}

/**
 * 9L: Documents (owner, 25 October 2026), every reimbursement document, as
 * Finance (Tina Gennette, 9L and 9Lm with Mark paid open) or an Admin (Dave
 * Sharpe, 9La), through the real list builder. One mixes currencies.
 */
export function rmbDocsFrame(frame: string): ReimbursementsPage {
  const PEOPLE: Record<string, { name: string; team: string; color: string }> = {
    wc: { name: 'Wendy Cacka', team: 'Web', color: '#A99BD4' }, ds: { name: 'Dave Sharpe', team: 'Leadership', color: '#012358' },
    ji: { name: 'Joy Inyele', team: 'Africa', color: '#F0A35E' }, tg: { name: 'Tina Gennette', team: 'Operations', color: '#1E7D7F' },
  }
  const doc = (id: number, person_id: string, state: 'approved' | 'paid', created: string, paid?: [string, string]) =>
    ({ id, number: `RMB-2026-${String(id).padStart(4, '0')}`, person_id, state, total: 0, paid_on: paid?.[0] ?? null, paid_ref: paid?.[1] ?? null, created_at: at(created) })
  const item = (document_id: number, amount: number, decided: string, currency = 'USD') => ({ document_id, amount, currency, decided_at: at(decided) })
  const documents = buildRmbDocList({
    finance: frame !== '9La',
    docs: [
      doc(31, 'wc', 'approved', 'Oct 21, 2026, 4:05 PM'),
      doc(30, 'ds', 'approved', 'Oct 19, 2026, 11:20 AM'),
      doc(29, 'ji', 'paid', 'Oct 14, 2026, 9:40 AM', ['2026-11-02', 'ACH-20261102']),
      doc(28, 'wc', 'paid', 'Sep 30, 2026, 2:15 PM', ['2026-10-09', 'ACH-20261009']),
      doc(27, 'tg', 'paid', 'Aug 28, 2026, 10:02 AM', ['2026-09-04', 'ACH-20260904']),
    ],
    items: [
      item(31, 12.99, 'Oct 21, 2026, 4:05 PM'), item(31, 45, 'Nov 3, 2026, 9:32 AM'),
      item(30, 45, 'Oct 19, 2026, 11:20 AM'), item(30, 41.4, 'Oct 21, 2026, 3:48 PM'),
      item(29, 4500, 'Oct 14, 2026, 9:40 AM', 'KES'), item(29, 18.4, 'Oct 14, 2026, 9:41 AM'),
      item(28, 35, 'Sep 30, 2026, 2:15 PM'),
      item(27, 64.2, 'Aug 28, 2026, 10:02 AM'),
    ],
    person: id => PEOPLE[id], financeNames: 'Tina Gennette', zone: 'America/New_York', today: TODAY,
  })
  return { ...reimbursementsFrame('9Be'), contractor: false, documents }
}

/** 9D: RMB-2026-0031, Wendy Cacka's, as Finance (Tina Gennette). */
export function rmbDocFrame(): RmbDocPage {
  return {
    id: 31, number: 'RMB-2026-0031', paid: false, st: { label: 'Approved, waiting for Finance', tone: 'teal' }, date: 'Nov 3, 2026', personId: 'wc', who: 'Wendy Cacka', team: 'Web', first: 'Wendy',
    items: [
      { id: 7, date: 'Oct 19', category: 'Equipment', what: 'USB-C hub for a second monitor', amount: '$12.99', file: 'usb-hub-receipt.jpg' },
      { id: 6, date: 'Oct 30', category: 'Software', what: 'Figma Professional, Oct to Dec', amount: '$45.00', file: 'figma-receipt-oct.pdf' },
    ],
    total: '$57.99', billing: { name: 'True North Digital Marketing LLC', line1: 'PO Box 2096, New York, NY 10163', line2: 'United States' },
    canPay: true, payNote: 'You are Finance. Pay Wendy outside Rippling payroll, then mark it paid here.',
    history: [
      { text: 'Item added by itself: Figma Professional, Oct to Dec ($45.00), approved by Arnaldo Oliveira', when: 'Nov 3, 2026, 9:32 AM', dot: '#012358' },
      { text: 'Created when USB-C hub for a second monitor ($12.99) was approved by Arnaldo Oliveira', when: 'Oct 21, 2026, 4:05 PM', dot: '#1E7D7F' },
    ],
    pay: { who: 'Wendy Cacka', line: '2 items · approved Nov 3, 2026', total: '$57.99' },
  }
}

export function rmbSheet(): DocSheetData {
  return rmbDocOf({
    number: 'RMB-2026-0031', name: 'Wendy Cacka', team: 'Web', createdOn: '2026-11-03', paid: null,
    billing: { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163\nUnited States' },
    items: [
      { spentOn: '2026-10-19', category: 'Equipment', purpose: 'USB-C hub for a second monitor', amount: 12.99, receipt: { id: 1, file: 'usb-hub-receipt.jpg', show: 'image', pages: 1 } },
      { spentOn: '2026-10-30', category: 'Software', purpose: 'Figma Professional, Oct to Dec', amount: 45, receipt: { id: 2, file: 'figma-receipt-oct.pdf', show: 'pdf', pages: 1 } },
    ],
  })
}

/** 10E, 10C: Cheyenne Wilson, 140h a month. */
export function extraFrame(frame: string): ExtraPage {
  const rows: ExtraPage['rows'] = [
    { id: 1, hours: '8h 00m', when: 'November 2026', client: '2 - i7 Marketing', why: 'Six extra i7 blog posts for the Q4 push, asked by the i7 team.', st: { label: 'Waiting', tone: 'warn' }, by: 'Asked Nov 1, 2026, 8:30 PM', who: null },
    { id: 2, hours: '8h 00m', when: 'October 2026', client: '2 - i7 Marketing', why: 'i7 product launch posts.', st: { label: 'Approved', tone: 'ok' }, by: 'Approved by Arnaldo Oliveira, Oct 20, 2026', who: null },
  ]
  return {
    allowance: { period: 'November 2026', used: '18h 30m', cap: '140h', share: 0.13, note: 'October: 151h 15m of 140h, with 8h approved in advance. 3h 15m were over without approval and were flagged on the invoice.' },
    rows: frame === '10C' ? rows.filter(r => r.id !== 1) : rows,
    forOthers: false,
    people: [{ id: 'cw', name: 'Cheyenne Wilson', context: 'Allowance: 140h a month. November so far: 18h 30m, so 121h 30m left before extra hours.', cap: 140, period: 'month' }],
    whens: [
      { value: 'month:2026-11-01', label: 'November 2026', period: 'month', start: '2026-11-01', end: '2026-11-30' },
      { value: 'month:2026-12-01', label: 'December 2026', period: 'month', start: '2026-12-01', end: '2026-12-31' },
      { value: 'week:2026-11-01', label: 'Week of Nov 1', period: 'week', start: '2026-11-01', end: '2026-11-07' },
      { value: 'week:2026-11-08', label: 'Week of Nov 8', period: 'week', start: '2026-11-08', end: '2026-11-14' },
      { value: 'week:2026-11-15', label: 'Week of Nov 15', period: 'week', start: '2026-11-15', end: '2026-11-21' },
    ],
    clients: ['1 - True North', '2 - i7 Marketing', 'A.org Job', 'Adventist Messengers/HFA', 'DDI', 'GNA', 'Rwanda-Incidental'],
    me: 'cw',
  }
}
