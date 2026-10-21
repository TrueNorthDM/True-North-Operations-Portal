/**
 * Clocky > Reports (Clocky part 2, Reports.dc.html 12A to 12C), as plain
 * data: the period, the five cards, hours by client by month, by team,
 * billable against not, and the tables by person and by client.
 *
 * Who is in it is decided before (reports-data.ts): everyone for Super
 * Admins, Admins and Finance; their teams for a Team Leader, who never sees
 * money (a Timesheet column instead of the invoice); themselves for a User.
 * Totals are in multiples of 15 minutes.
 */

import { addDays, payPeriodStart, PAY_PERIOD_DAYS } from './periods'
import { formatDuration } from './rounding'

export type PeriodKind = 'month' | 'pp' | 'quarter' | 'custom'
export type BillFilter = 'all' | 'yes' | 'no'
export const ALL = 'all'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
const monthEnd = (iso: string) => { const [y, m] = iso.split('-').map(Number); return ymd(y, m, 0) }
const dayText = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8))}`
/** "Oct 18 to 31, 2026", "Aug 1 to Oct 31, 2026" */
export function rangeText(a: string, b: string): string {
  return a.slice(0, 7) === b.slice(0, 7) ? `${dayText(a)} to ${Number(b.slice(8))}, ${b.slice(0, 4)}` : `${dayText(a)} to ${dayText(b)}, ${b.slice(0, 4)}`
}

/**
 * The period on screen: the last one that has ended (the last month, pay
 * period or quarter before today), or the custom days chosen.
 */
export function periodOf(kind: PeriodKind, today: string, anchor: string | null, custom?: { from: string; to: string } | null): { from: string; to: string; label: string } {
  const [y, m] = today.split('-').map(Number)
  if (kind === 'pp' && anchor) {
    const to = addDays(payPeriodStart(today, anchor), -1), from = addDays(to, -(PAY_PERIOD_DAYS - 1))
    return { from, to, label: `Pay period ${rangeText(from, to)}` }
  }
  if (kind === 'quarter') {
    const q = Math.floor((m - 1) / 3), qy = q === 0 ? y - 1 : y, qq = q === 0 ? 3 : q - 1
    const from = ymd(qy, qq * 3, 1), to = ymd(qy, qq * 3 + 3, 0)
    return { from, to, label: `Q${qq + 1} ${qy} (${MON[qq * 3]} to ${MON[qq * 3 + 2]})` }
  }
  if (kind === 'custom') {
    const to = custom?.to ?? ymd(y, m - 1, 0), from = custom?.from ?? ymd(y, m - 4, 1)
    return { from, to, label: rangeText(from, to) }
  }
  const from = ymd(y, m - 2, 1), to = monthEnd(from)
  return { from, to, label: `${MONL[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}` }
}

/** The four months the chart shows, ending with the period's last month (first days). */
export function chartMonths(to: string): string[] {
  const [y, m] = to.split('-').map(Number)
  return [3, 2, 1, 0].map(k => ymd(y, m - 1 - k, 1))
}

// ── The filters, in the address ─────────────────────────────────────────────

export interface ReportQuery { kind: PeriodKind; from?: string; to?: string; team: string; person: string; client: string; bill: BillFilter }

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function parseReportQuery(sp: Record<string, string | undefined>): ReportQuery {
  const kind = (['month', 'pp', 'quarter', 'custom'] as const).find(k => k === sp.period) ?? 'month'
  return {
    kind,
    from: sp.from && ISO.test(sp.from) ? sp.from : undefined,
    to: sp.to && ISO.test(sp.to) ? sp.to : undefined,
    team: sp.team || ALL, person: sp.person || ALL, client: sp.client || ALL,
    bill: sp.bill === 'yes' || sp.bill === 'no' ? sp.bill : 'all',
  }
}

export function reportSearch(q: ReportQuery): string {
  const p = new URLSearchParams()
  if (q.kind !== 'month') p.set('period', q.kind)
  if (q.kind === 'custom' && q.from) p.set('from', q.from)
  if (q.kind === 'custom' && q.to) p.set('to', q.to)
  if (q.team !== ALL) p.set('team', q.team)
  if (q.person !== ALL) p.set('person', q.person)
  if (q.client !== ALL) p.set('client', q.client)
  if (q.bill !== 'all') p.set('bill', q.bill)
  return p.toString()
}

// ── The report ──────────────────────────────────────────────────────────────

export interface ReportRow { personId: string; client: string; billable: boolean; seconds: number; date: string }
export interface ReportPerson {
  id: string; name: string; teamId: string | null; teamName: string; teamColor: string; contractor: boolean
  /** A monthly allowance in hours (weekly ones show as such and count no overrun here). */
  allowance: { hours: number; period: 'week' | 'month' } | null
  /** Extra hours approved for the period, seconds. */
  extraSeconds: number
  /** The period's invoice total, for those who see money. */
  invoice: number | null
  /** The period's timesheet, said for a Team Leader. */
  timesheet: string | null
  timesheetApproved: boolean
}
export interface ReportInput {
  kind: PeriodKind; from: string; to: string; label: string
  rows: ReportRow[]
  people: ReportPerson[]
  scope: 'all' | 'team' | 'own'
  money: boolean
  ptoDays: number
  clientColor: (client: string) => string
  /** The design's client order (bottom of the bars first); others after, by name. */
  clientOrder?: readonly string[]
  filters: { team: string; person: string; client: string; bill: BillFilter }
}

export interface ReportView {
  label: string
  cards: { label: string; val: string; sub: string; tone: 'ink' | 'ok' | 'bad' }[]
  chart: { range: string; axis: string[]; months: { label: string; total: string; height: number; ring: boolean; tip: string; segs: { color: string; share: number }[] }[]; legend: { label: string; color: string }[] }
  byTeam: { team: string; val: string; width: number; color: string }[]
  bill: { share: number; yes: string; no: string }
  personHeads: string[]
  byPerson: { id: string; name: string; ini: string; team: string; teamColor: string; hours: string; billPct: string; allowance: string; over: string; overTone: 'none' | 'warn' | 'bad'; last: string }[]
  byClient: { label: string; color: string; hours: string; people: number }[]
  people: number
}

const r15 = (s: number) => Math.round(s / 900) * 900
const hm = (s: number) => formatDuration(r15(s))
const hoursOnly = (s: number) => hm(s).replace(/ \d+m$/, '')
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ini = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

export function buildReport(i: ReportInput): ReportView {
  const f = i.filters
  const people = i.people.filter(p => (f.team === ALL || p.teamId === f.team) && (f.person === ALL || p.id === f.person))
  const ids = new Set(people.map(p => p.id))
  const keep = (r: ReportRow) => ids.has(r.personId) && (f.client === ALL || r.client === f.client) && (f.bill === 'all' || (f.bill === 'yes') === r.billable)
  const rows = i.rows.filter(keep)
  const inPeriod = rows.filter(r => r.date >= i.from && r.date <= i.to)

  const per = new Map<string, { total: number; billable: number; clients: Map<string, number> }>()
  for (const r of inPeriod) {
    const x = per.get(r.personId) ?? { total: 0, billable: 0, clients: new Map() }
    x.total += r.seconds
    if (r.billable) x.billable += r.seconds
    x.clients.set(r.client, (x.clients.get(r.client) ?? 0) + r.seconds)
    per.set(r.personId, x)
  }
  const totalOf = (id: string) => r15(per.get(id)?.total ?? 0)
  const T = people.reduce((a, p) => a + totalOf(p.id), 0)
  const B = people.reduce((a, p) => a + r15(per.get(p.id)?.billable ?? 0), 0)
  const monthly = i.kind === 'month'
  const overOf = (p: ReportPerson) => (monthly && p.allowance?.period === 'month' ? Math.max(0, totalOf(p.id) - p.allowance.hours * 3600) : 0)
  const over = people.reduce((a, p) => a + overOf(p), 0)
  const overNot = people.reduce((a, p) => a + Math.max(0, overOf(p) - p.extraSeconds), 0)
  const invoiced = people.filter(p => p.invoice != null)
  const invT = invoiced.reduce((a, p) => a + (p.invoice ?? 0), 0)
  const lead = i.scope === 'team'
  const month = MONL[Number(i.to.slice(5, 7)) - 1]

  const cards: ReportView['cards'] = [
    { label: 'Total hours', val: hm(T), sub: `${people.length} ${people.length === 1 ? 'person' : 'people'}`, tone: 'ink' },
    { label: 'Billable', val: T ? `${Math.round(B / T * 100)}%` : '-', sub: hm(B), tone: 'ok' },
    { label: 'Over the allowance', val: hm(over), sub: !monthly ? 'Shown by month' : overNot ? `${hm(overNot)} not approved in advance` : 'All approved in advance', tone: overNot ? 'bad' : 'ink' },
    lead
      ? { label: `Timesheets, ${month}`, val: `${people.filter(p => p.timesheetApproved).length} of ${people.length}`, sub: 'Hours approved', tone: 'ink' }
      : { label: monthly ? `Invoices, ${month}` : 'Invoices', val: i.kind === 'pp' || !i.money ? '-' : usd(invT), sub: i.kind === 'pp' ? 'Contractors invoice monthly' : `${invoiced.length} contractor${invoiced.length === 1 ? '' : 's'}`, tone: 'ink' },
    { label: 'PTO days', val: String(i.ptoDays), sub: 'Approved, employees', tone: 'ink' },
  ]

  // Hours by client, by month (the four months ending with the period).
  const months = chartMonths(i.to)
  const rank = (c: string) => { const k = i.clientOrder?.indexOf(c) ?? -1; return k < 0 ? 1e6 : k }
  const clients = [...new Set(rows.map(r => r.client))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }))
  const mons = months.map(m => {
    const segs = clients.map(c => ({ c, s: rows.filter(r => r.client === c && r.date.slice(0, 7) === m.slice(0, 7)).reduce((a, r) => a + r.seconds, 0) }))
    return { m, segs, t: segs.reduce((a, g) => a + g.s, 0) }
  })
  const mx = Math.max(1, ...mons.map(x => x.t))
  const step = Math.max(50, Math.ceil(mx / 3600 / 4 / 50) * 50)
  const chart: ReportView['chart'] = {
    range: `${MON[Number(months[0].slice(5, 7)) - 1]} to ${MON[Number(months[3].slice(5, 7)) - 1]} ${months[3].slice(0, 4)}`,
    axis: [4, 3, 2, 1].map(k => `${k * step}h`),
    months: mons.map((x, k) => ({
      label: MON[Number(x.m.slice(5, 7)) - 1], total: hoursOnly(x.t), height: x.t / (step * 4 * 3600) * 100, ring: k === 3 && monthly,
      tip: x.segs.filter(g => g.s).map(g => `${g.c}: ${hm(g.s)}`).join(' · '),
      segs: x.segs.map(g => ({ color: i.clientColor(g.c), share: x.t ? g.s / x.t * 100 : 0 })),
    })),
    legend: clients.map(c => ({ label: c, color: i.clientColor(c) })),
  }

  const teamT = new Map<string, { s: number; color: string }>()
  for (const p of people) { const t = teamT.get(p.teamName) ?? { s: 0, color: p.teamColor }; t.s += totalOf(p.id); teamT.set(p.teamName, t) }
  const teams = [...teamT.entries()].filter(([, v]) => v.s > 0).sort((a, b) => b[1].s - a[1].s)
  const tmx = Math.max(1, ...teams.map(([, v]) => v.s))

  const byClient = new Map<string, { s: number; n: Set<string> }>()
  for (const r of inPeriod) { const c = byClient.get(r.client) ?? { s: 0, n: new Set() }; c.s += r.seconds; c.n.add(r.personId); byClient.set(r.client, c) }

  return {
    label: i.label,
    cards,
    chart,
    byTeam: teams.map(([team, v]) => ({ team, val: hoursOnly(v.s), width: v.s / tmx * 100, color: v.color })),
    bill: { share: T ? B / T * 100 : 0, yes: hm(B), no: hm(T - B) },
    personHeads: ['Person', 'Hours', 'Billable', 'Allowance', 'Over', lead ? 'Timesheet' : 'Invoice'],
    byPerson: [...people].sort((a, b) => totalOf(b.id) - totalOf(a.id) || a.name.localeCompare(b.name)).map(p => {
      const t = totalOf(p.id), bl = r15(per.get(p.id)?.billable ?? 0), o = overOf(p)
      return {
        id: p.id, name: p.name, ini: ini(p.name), team: p.teamName, teamColor: p.teamColor,
        hours: hm(t), billPct: t ? `${Math.round(bl / t * 100)}%` : '-',
        allowance: p.allowance ? (p.allowance.period === 'month' ? `${p.allowance.hours}h` : `${p.allowance.hours}h a week`) : '-',
        over: o ? hm(o) : '-', overTone: !o ? 'none' : o > p.extraSeconds ? 'bad' : 'warn',
        last: lead ? (p.timesheet ?? '-') : p.invoice != null && monthly && i.money ? usd(p.invoice) : p.contractor ? '-' : 'Employee',
      }
    }),
    byClient: [...byClient.entries()].sort((a, b) => b[1].s - a[1].s).map(([c, v]) => ({ label: c, color: i.clientColor(c), hours: hm(v.s), people: v.n.size })),
    people: people.length,
  }
}

/** The report as CSV: one line per person. */
export function reportCsv(v: ReportView): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return [['Person', 'Team', ...v.personHeads.slice(1)], ...v.byPerson.map(p => [p.name, p.team, p.hours, p.billPct, p.allowance, p.over, p.last])]
    .map(r => r.map(q).join(',')).join('\n') + '\n'
}
