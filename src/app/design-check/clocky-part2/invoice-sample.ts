// The Invoices pages with the prototype's data (Invoices.dc.html: INV, CL,
// EMAIL, P, REP, INVAP, doc(), frame()), built through the real
// buildInvoiceList and buildInvoiceDetail. "Now" is Tue, Nov 3, 2026.

import type { InvRow, LineRow } from '@/lib/timeclock/invoice-doc'
import { buildInvoiceDetail, buildInvoiceList, type InvoiceDetail, type InvoiceList, type InvoiceMode } from '@/lib/timeclock/invoices-view'
import type { RoutePerson } from '@/lib/timeclock/routing'
import { buildSubmitBlock } from '@/lib/timeclock/submit-block'
import type { SubmitSummary } from '@/lib/timeclock/clocky-types'

const TEAMC: Record<string, string> = { 'Admin Assistants': '#9CA3AF', Africa: '#F0A35E', 'Fund Raising': '#CA8A04', Graphics: '#C026D3', Leadership: '#1E40AF', Marketing: '#047857', Operations: '#92400E', SEO: '#F4C24A', 'Social Media': '#DC2626', 'Special Projects': '#6D5EF5', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }
const P: Record<string, [string, 'con' | 'emp']> = { 'Arnaldo Oliveira': ['Leadership', 'con'], 'Dave Sharpe': ['Leadership', 'emp'], 'Rock Kai': ['Social Media', 'con'], 'Tina Gennette': ['Operations', 'emp'], 'Wendy Cacka': ['Web', 'emp'], 'Samuel Manzi': ['Web', 'con'], 'Justus Tsofa': ['Africa', 'con'], 'Hosea Moturi': ['Africa', 'con'], 'Joy Inyele': ['Africa', 'con'], 'Clarise Nixon': ['Social Media', 'con'], 'Cheyenne Wilson': ['Writers', 'con'], 'Stephanie Aguirre': ['Social Media', 'con'], 'Olivia Hale': ['SEO', 'con'], 'Amy Prindle': ['Writers', 'con'], 'Alyssa Sommerville': ['Graphics', 'con'], 'Saheed Fidimaye': ['Translation', 'con'], Andressa: ['Special Projects', 'con'], Yuliberth: ['Special Projects', 'con'], John: ['Special Projects', 'con'] }
const REP: Record<string, string | null> = { 'Samuel Manzi': 'Wendy Cacka', 'Clarise Nixon': 'Rock Kai', 'Stephanie Aguirre': 'Rock Kai', 'Cheyenne Wilson': 'Arnaldo Oliveira', 'Justus Tsofa': 'Arnaldo Oliveira', 'Olivia Hale': 'Arnaldo Oliveira', 'Hosea Moturi': 'Arnaldo Oliveira', 'Joy Inyele': 'Arnaldo Oliveira', 'Amy Prindle': 'Arnaldo Oliveira', 'Alyssa Sommerville': 'Arnaldo Oliveira', 'Saheed Fidimaye': 'Arnaldo Oliveira', 'Wendy Cacka': 'Arnaldo Oliveira', 'Tina Gennette': 'Arnaldo Oliveira', 'Rock Kai': 'Dave Sharpe', 'Arnaldo Oliveira': 'Dave Sharpe', 'Dave Sharpe': null, Andressa: 'Arnaldo Oliveira', Yuliberth: 'Arnaldo Oliveira', John: 'Dave Sharpe' }
const EMAIL: Record<string, [string, string]> = { 'Justus Tsofa': ['Nairobi, Kenya', 'justus.tsofa@email.com'], 'Hosea Moturi': ['Nairobi, Kenya', 'hosea.moturi@email.com'], 'Joy Inyele': ['Nairobi, Kenya', 'joy.inyele@email.com'] }
const CL: Record<string, [string, number][]> = { 'Justus Tsofa': [['2 - i7 Marketing', 7200 / 9750], ['1 - True North', 1830 / 9750], ['A.org Job', 720 / 9750]], 'Cheyenne Wilson': [['2 - i7 Marketing', 5760 / 9075], ['1 - True North', 2475 / 9075], ['Adventist Messengers/HFA', 840 / 9075]], 'Clarise Nixon': [['2 - i7 Marketing', 4800 / 7920], ['1 - True North', 2340 / 7920], ['DDI', 780 / 7920]] }
const PER: Record<string, string> = { '2026-10': 'October 2026', '2026-09': 'September 2026', '2026-08': 'August 2026', '2026-07': 'July 2026' }
const MONTH: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }

// no, who, period, hours (min), rate or fixed, kind, reimbursements, state, approved, paid, ref, hours approved
type Row = [string, string, string, number, number, 'h' | 'f' | 'n', [string, string, number][], 'draft' | 'wait' | 'hrs' | 'appr' | 'paid', string?, string?, string?, string?]
const INV: Row[] = [
  ['INV-2026-0146', 'Alyssa Sommerville', '2026-10', 5880, 19, 'h', [], 'draft'],
  ['INV-2026-0151', 'John', '2026-10', 0, 2400, 'n', [], 'wait'],
  ['INV-2026-0150', 'Yuliberth', '2026-10', 0, 1600, 'n', [], 'wait'],
  ['INV-2026-0149', 'Andressa', '2026-10', 0, 2000, 'n', [], 'wait'],
  ['INV-2026-0148', 'Rock Kai', '2026-10', 8400, 20, 'h', [], 'wait'],
  ['INV-2026-0147', 'Samuel Manzi', '2026-10', 9600, 20, 'h', [], 'wait', '', '', '', 'Nov 2, 2026, 4:10 PM'],
  ['INV-2026-0145', 'Clarise Nixon', '2026-10', 7920, 18, 'h', [], 'hrs'],
  ['INV-2026-0144', 'Olivia Hale', '2026-10', 7125, 1800, 'f', [], 'wait'],
  ['INV-2026-0143', 'Cheyenne Wilson', '2026-10', 9075, 22, 'h', [['Software', 'Grammarly Premium, October', 30]], 'wait'],
  ['INV-2026-0142', 'Justus Tsofa', '2026-10', 9750, 14, 'h', [['Internet', 'Internet, October', 35]], 'wait'],
  ['INV-2026-0141', 'Joy Inyele', '2026-10', 8895, 12, 'h', [], 'appr', 'Nov 2, 2026'],
  ['INV-2026-0140', 'Hosea Moturi', '2026-10', 9600, 12, 'h', [], 'appr', 'Nov 2, 2026'],
  ['INV-2026-0139', 'Amy Prindle', '2026-10', 8190, 20, 'h', [], 'appr', 'Nov 2, 2026'],
  ['INV-2026-0138', 'Stephanie Aguirre', '2026-10', 7680, 18, 'h', [], 'appr', 'Nov 2, 2026'],
  ['INV-2026-0137', 'Saheed Fidimaye', '2026-09', 6600, 16, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 14, 2026', 'WISE-77512'],
  ['INV-2026-0136', 'Alyssa Sommerville', '2026-09', 6000, 19, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 13, 2026', 'WISE-77480'],
  ['INV-2026-0135', 'Olivia Hale', '2026-09', 7260, 1800, 'f', [], 'paid', 'Oct 2, 2026', 'Oct 13, 2026', 'WISE-77455'],
  ['INV-2026-0134', 'Cheyenne Wilson', '2026-09', 8400, 22, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 12, 2026', 'WISE-77390'],
  ['INV-2026-0133', 'Clarise Nixon', '2026-09', 7680, 18, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 12, 2026', 'WISE-77364'],
  ['INV-2026-0132', 'Stephanie Aguirre', '2026-09', 7500, 18, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 12, 2026', 'WISE-77341'],
  ['INV-2026-0131', 'Justus Tsofa', '2026-09', 9420, 14, 'h', [['Internet', 'Internet, September', 35]], 'paid', 'Oct 2, 2026', 'Oct 12, 2026', 'WISE-77310'],
  ['INV-2026-0130', 'Amy Prindle', '2026-09', 7800, 20, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 9, 2026', 'WISE-77102'],
  ['INV-2026-0129', 'Joy Inyele', '2026-09', 8700, 12, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 9, 2026', 'WISE-77088'],
  ['INV-2026-0128', 'Hosea Moturi', '2026-09', 9300, 12, 'h', [], 'paid', 'Oct 2, 2026', 'Oct 9, 2026', 'WISE-77061'],
  ['INV-2026-0119', 'Justus Tsofa', '2026-08', 9600, 14, 'h', [['Internet', 'Internet, August', 35]], 'paid', 'Sep 2, 2026', 'Sep 11, 2026', 'WISE-70288'],
  ['INV-2026-0107', 'Justus Tsofa', '2026-07', 9330, 14, 'h', [['Internet', 'Internet, July', 35]], 'paid', 'Aug 3, 2026', 'Aug 12, 2026', 'WISE-64102'],
]

const INVAP = ['Arnaldo Oliveira', 'Dave Sharpe']
const SETTINGS = { invoiceApprovers: INVAP, defaultApprover: 'Arnaldo Oliveira', deputyDirector: 'Dave Sharpe' }
const invBy = (n: string) => { const r = REP[n]; return r && INVAP.includes(r) ? r : 'Arnaldo Oliveira' }
const kindOf = { h: 'hourly', f: 'fixed_monthly', n: 'fixed_no_timesheet' } as const

/** "Nov 2, 2026" (and an optional ", 4:10 PM") as an instant in New York (EST after Nov 1, EDT before). */
function instant(text: string): string {
  const m = /^([A-Z][a-z]{2}) (\d+), (\d{4})(?:, (\d+):(\d+) (AM|PM))?$/.exec(text)!
  const mon = MONTH[m[1]], d = +m[2], y = +m[3]
  const h = m[4] ? (+m[4] % 12) + (m[6] === 'PM' ? 12 : 0) : 14
  const offset = mon > 11 || (mon === 11 && d >= 1) || mon < 3 ? 5 : 4
  return new Date(Date.UTC(y, mon - 1, d, h + offset, m[5] ? +m[5] : 0)).toISOString()
}
const iso = (text: string) => instant(text).slice(0, 10)

/** The hours of a month split by client the way the prototype's doc() splits them. */
function split(who: string, min: number): [string, number][] {
  const parts = CL[who] ?? [['2 - i7 Marketing', 0.6], ['1 - True North', 0.25], ['GNA', 0.15]]
  let left = min
  return parts.map(([c, f], i) => { const m = i === parts.length - 1 ? left : Math.round(min * f / 15) * 15; left -= m; return [c, m] })
}

interface Built { inv: InvRow; lines: LineRow[]; st: Row[7]; hrs: string }

function build(r: Row): Built {
  const [no, who, per, min, rate, k, rb, st, appr = '', paid = '', ref = '', hrs = ''] = r
  const [y, mm] = per.split('-').map(Number)
  const start = `${per}-01`, end = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10)
  const issued = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 10)
  const due = new Date(Date.UTC(y, mm, 15)).toISOString().slice(0, 10)
  const name = PER[per]
  const lines: LineRow[] = k === 'h'
    ? split(who, min).map(([c, m]) => ({ kind: 'hours', client: c, description: `${c}, ${name}`, hours_seconds: m * 60, rate, amount: Math.round(m / 60 * rate * 100) / 100 }))
    : [{ kind: 'fixed', client: null, description: `Fixed monthly amount, ${name}`, hours_seconds: k === 'n' ? null : min * 60, rate: null, amount: rate }]
  for (const [cat, d, a] of rb) lines.push({ kind: 'reimbursement', client: cat, description: d, hours_seconds: null, rate: null, amount: a })
  const total = lines.reduce((n, l) => n + Math.round(l.amount * 100), 0) / 100
  const e = EMAIL[who] ?? ['United States', `${who.toLowerCase().replace(' ', '.')}@email.com`]
  const id = Number(no.slice(-4))
  return {
    st, hrs, lines,
    inv: {
      id, number: no, submission_id: k === 'n' ? null : id, person_id: who, total, kind: kindOf[k],
      state: st === 'draft' ? 'draft' : st === 'appr' ? 'approved' : st === 'paid' ? 'paid' : 'waiting',
      period_start: start, period_end: end, issued_on: issued, due_on: due,
      created_at: no === 'INV-2026-0142' ? instant('Nov 1, 2026, 2:05 AM') : `${issued}T12:00:00Z`,
      approved_by: appr ? invBy(who) : null, approved_at: appr ? instant(no === 'INV-2026-0142' ? `${appr}, 9:40 AM` : appr) : null,
      paid_on: paid ? iso(paid) : null, paid_ref: ref || null,
      from_snapshot: { name: who, location: e[0], email: e[1] },
      to_snapshot: { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163\nUnited States', email: 'billing@truenorthdm.org' },
    },
  }
}

const routeOf = (who: string): RoutePerson => ({ personId: who, reportsTo: REP[who] ?? null, isContractor: P[who]?.[1] === 'con', paysAs: 'hourly' })
const subState = (b: Built) => (b.st === 'draft' ? 'returned' : b.st === 'hrs' ? 'submitted' : b.st === 'wait' ? (REP[b.inv.person_id] === invBy(b.inv.person_id) ? 'submitted' : 'hours_approved') : 'approved')
const nameOf = (id: string | null | undefined) => id ?? 'Clocky'

/** 6F's invoice: INV-2026-0142 paid on Nov 12 (the frame's change to it). */
function rows(frame: string): Row[] {
  if (frame === '6F' || frame === '6Fp') return INV.map(r => (r[0] === 'INV-2026-0142' ? [r[0], r[1], r[2], r[3], r[4], r[5], r[6], 'paid', 'Nov 3, 2026', 'Nov 12, 2026', 'WISE-88412'] : r))
  return INV
}

export function invoiceListFrame(frame: string): InvoiceList {
  const mode: InvoiceMode = frame === '6Ec' ? 'mine' : 'all'
  const me = 'Justus Tsofa'
  const built = rows(frame).map(build).filter(b => mode !== 'mine' || b.inv.person_id === me)
  return buildInvoiceList({
    mode, finance: frame === '6Ef' || frame === '6G',
    invoices: built.map(b => b.inv),
    rates: new Map(built.filter(b => b.inv.kind === 'hourly').map(b => [b.inv.id, Number(b.lines[0].rate)])),
    subs: new Map(built.filter(b => b.inv.submission_id != null).map(b => [b.inv.id, { id: b.inv.id, state: subState(b) }])),
    routes: new Map(built.map(b => [b.inv.person_id, { ...routeOf(b.inv.person_id), paysAs: b.inv.kind as RoutePerson['paysAs'] }])),
    settings: SETTINGS,
    person: id => ({ name: id, team: P[id]?.[0] ?? 'Leadership', color: TEAMC[P[id]?.[0] ?? 'Leadership'] ?? '#9CA3AF' }),
    nameOf, today: '2026-11-03',
  })
}

export function invoiceDetailFrame(frame: string, number = 'INV-2026-0142'): InvoiceDetail {
  const b = build(rows(frame).find(r => r[0] === number)!)
  const who = b.inv.person_id
  const one = REP[who] === invBy(who)
  const events: Parameters<typeof buildInvoiceDetail>[0]['events'] = []
  if (b.st === 'draft') events.push({ step: 'both', action: 'return', by_person: 'Arnaldo Oliveira', at: instant('Nov 2, 2026, 2:30 PM'), note: 'Oct 12 has 2 entries on DDI that belong to GNA.' })
  if (b.hrs) events.push({ step: 'hours', action: 'approve', by_person: REP[who], at: instant(b.hrs), note: null })
  if (b.inv.approved_at) events.push({ step: one ? 'both' : 'invoice', action: 'approve', by_person: invBy(who), at: b.inv.approved_at, note: null })
  if (b.inv.paid_on) events.push({ step: 'paid', action: 'paid', by_person: 'Tina Gennette', at: `${b.inv.paid_on}T15:00:00Z`, note: null })
  return buildInvoiceDetail({
    inv: b.inv, lines: b.lines, events, sub: b.inv.submission_id ? { id: b.inv.id, state: subState(b) } : undefined,
    route: { ...routeOf(who), paysAs: b.inv.kind as RoutePerson['paysAs'] }, settings: SETTINGS, finance: frame === '6G', nameOf, zone: 'America/New_York',
  })
}

/** 6A (Justus Tsofa, contractor, October) and 6B (Wendy Cacka, employee, Oct 4 to 17): the Submit window. */
export function submitFrame(frame: '6A' | '6B'): SubmitSummary {
  const con = frame === '6A'
  const byClient = con
    ? [{ client: '2 - i7 Marketing', seconds: 7200 * 60 }, { client: '1 - True North', seconds: 1830 * 60 }, { client: 'A.org Job', seconds: 720 * 60 }]
    : [{ client: '1 - True North', seconds: 3000 * 60 }, { client: '2 - i7 Marketing', seconds: 1800 * 60 }]
  const worked = byClient.reduce((n, c) => n + c.seconds, 0)
  const block = buildSubmitBlock({
    isContractor: con, paysAs: con ? 'hourly' : null, hourlyRate: con ? 14 : null, fixedAmount: null,
    periodName: con ? 'October 2026' : 'Oct 4 to 17, 2026', label: con ? 'October' : 'Oct 4 to 17', byClient,
    reimbursements: con ? [{ id: 1, category: 'Internet', purpose: 'Internet, October', amount: 35 }] : [],
    timeOff: con ? [] : [{ date: '2026-10-16', kind: 'Vacation', seconds: 8 * 3600 }], workedSeconds: worked,
    hoursBy: 'Arnaldo Oliveira', invoiceBy: con ? 'Arnaldo Oliveira' : null,
  })
  return {
    start: con ? '2026-10-01' : '2026-10-04', end: con ? '2026-10-31' : '2026-10-17', kind: con ? 'month' : 'pay_period',
    title: con ? 'Submit October 2026?' : 'Submit Oct 4 to 17?', label: con ? 'October' : 'Oct 4 to 17',
    cadenceLine: con ? 'You submit monthly. October 2026 is Oct 1 to 31.' : 'You submit every 2 weeks, by pay period (Sunday to Saturday). This one is Oct 4 to 17, 2026.',
    lockNote: `After you submit, ${con ? 'October' : 'Oct 4 to 17'} locks. Only a Super Admin can reopen it.`,
    state: null, running: false, totalSeconds: worked, byClient,
    noTime: con ? 'None. Every weekday has time.' : 'None. Fri, Oct 16 is Vacation.', attention: [], canSubmit: true,
    totalLabel: con ? 'Total' : 'Worked', block,
  }
}
