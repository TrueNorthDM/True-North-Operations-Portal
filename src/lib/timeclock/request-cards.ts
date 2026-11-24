/**
 * Time off, reimbursements and extra hours in the Approvals queue (Clocky part
 * 2, Approvals.dc.html rows r6 to r9 and their cards 7C, 9C, 10D): the row, and
 * the card it opens with what the decider needs (the team calendar for time
 * off, the receipt for a reimbursement, the allowance for extra hours) and what
 * approving does by itself.
 *
 * Who decides is the routing (owner, 1 November 2026, Company settings >
 * Invoices "Who approves what"; routing.ts requestDeciders): time off, its
 * cancellation and extra hours by the invoice rule, a reimbursement by anyone
 * on the Reimbursements list; never their own. Everyone else who sees a row
 * sees whose decision it is. Reimbursements are money: shown only to who sees that
 * person's money (pay-terms.ts seesMoney: the person, Super Admins and
 * Finance; owner, 5 November 2026). The
 * Approvals count (clocky-approvals.ts countWaiting) asks the same questions
 * (waitingRequests below), so the number and the list cannot disagree.
 *
 * Not a "use server" file: approval-queue.ts calls it.
 */

import { isStaff, type Directory, type Viewer } from './clocky-context'
import { allRows, db, loadCatalog, loadClockySettings, must } from './clocky-context'
import { dateLabel, dayLabel, initials, localDate, monthYear, rangeLabel, timeLabel } from './format'
import { allowanceFor, limitAsTyped, windowName } from './allowance'
import { formatDuration } from './rounding'
import { loadAllowanceUse, loadApprovedExtra } from './allowance-data'
import { loadPayTerms, loadRequestDeciders, loadRoutes, seesMoney, type InvoiceSettings } from './pay-terms'
import { orList } from './routing'
import { addDays } from './periods'
import { daysText, holidaysBetween, offDays, readsOffReason } from './time-off'
import { offKindOf, yearCount, type OffEntry, type YearCount } from './time-off-year'
import { askedLate, dayHoursLabel, LATE_TAG, ordinal } from './time-off-late'
import { balanceLine, isPaidKind } from './time-off-rules'
import { loadOffStandings } from './time-off-rules-data'
import { teamColour } from '@/lib/directory/team-colour'
import { usd } from './invoice-doc'
import { receiptsText, reportTitle, rmbVersion, totalsText, type Amount } from './reimbursement-reports'
import { DESCRIPTION_LABEL, MEAL_OVER_FLAG, overMealCap } from './reimbursement-rules'

/** One receipt of a request with several (migration 122), decided on its own. */
export interface ReportItem {
  id: number
  /** "Oct 12" */
  date: string
  category: string
  purpose: string
  /** "$412.00" or "1,200.00 KES" */
  amount: string
  value: Amount
  /** "2 - i7 Marketing, billable", when it has a client. */
  client: string | null
  /** Null: a Mileage line sent without a receipt (Tina's review, 29 October 2026). */
  receipt: { id: number; file: string; sub: string } | null
  state: string
  note: string | null
  /** A meal while travelling over the $25 (owner, 5 November 2026): allowed, flagged for the decider to review. */
  over?: boolean
}

export interface RequestCard {
  kind: 'off' | 'off-cancel' | 'rmb' | 'rmb-report' | 'xh'
  id: number
  type: string
  title: string
  /** The prototype's max-width, with its padding (border-box). */
  width: number
  twoCols: boolean
  receipt: { id: number; file: string; sub: string } | null
  /** A request with several receipts: each one, decided on its own. */
  items?: ReportItem[]
  facts: { k: string; v: string }[]
  allow: string | null
  /**
   * Who is out around the request (owner, 17 November 2026): the request, the
   * person's own team, the other teams and the company holidays. The window
   * opens on the team and a switch shows everyone. 'ask': asked, not approved yet.
   */
  cal: { label: string; team?: string | null; days: string[]; rows: { name: string; sub: string; color: string; group?: 'req' | 'team' | 'others' | 'hol'; cells: ('req' | 'out' | 'ask' | 'hol' | null)[] }[] } | null
  /** Home's drawer: who on the person's team is also out on the request's days; null when they have no team. */
  also?: { team: string; people: { name: string; initials: string; color: string; when: string; asked: boolean }[]; warn: string | null } | null
  /** The person's time off this year, by type, and what it becomes with this request. */
  year?: YearCount | null
  after: string
  canDecide: boolean
  roText: string | null
  approveLabel: string
  denyLabel: string
  /**
   * Reimbursements: the version of what waits as this card shows it
   * (reimbursement-reports.ts rmbVersion). Sent back with the decision, which
   * is refused if the request changed meanwhile.
   */
  version?: string
}

export interface CardRow {
  key: string
  type: 'off' | 'rmb' | 'xh'
  id: number
  personId: string
  name: string
  initials: string
  team: { name: string; color: string | null } | null
  teamId: string | null
  main: string
  sub: string
  flag: { text: string; tone: 'ok' | 'warn' | 'bad' | 'neu' | 'teal' } | null
  why: string | null
  asked: string
  askedAt: string
  ownerName: string
  owner: string | null
  /** The viewer is one of its deciders (waiting or not): what a User below Team Leader is shown. */
  decides: boolean
  own: boolean
  done: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neu' | 'teal'; by: string } | null
  href: string | null
  request: RequestCard
}

const short = (t: string, zone: string) => `${dateLabel(localDate(t, zone)).replace(/, \d{4}$/, '')}, ${timeLabel(t, zone)}`
const asked = (t: string, zone: string) => {
  const d = localDate(t, zone)
  return `Asked ${dayLabel(d)}, ${timeLabel(t, zone)}`
}

// ── What the list and the count share ──────────────────────────────────────

/** The access a money check takes, from the viewer. */
export const moneyViewer = (v: Pick<Viewer, 'can' | 'personId'>) => ({ can: v.can, personId: v.personId })

/** Waiting for a decision: time off asked for, or approved time off its person asks to cancel. */
export const offWaiting = (r: { state: string; cancel_asked_at: string | null }): boolean =>
  r.state === 'pending' || (r.state === 'approved' && !!r.cancel_asked_at)

/** The viewer decides this request: they are one of its deciders (routing.ts requestDeciders), and it is not their own. */
export const decidesRequest = (v: Pick<Viewer, 'personId'>, deciders: readonly string[], personId: string): boolean =>
  personId !== v.personId && deciders.includes(v.personId)

/** Who decides, for the row and the read-only line: "David Sharpe", "Arnaldo Oliveira or David Sharpe". */
export const decidersText = (deciders: readonly string[], nameOf: (id: string) => string): string => orList(deciders.map(nameOf))

/** The read-only line under a card the viewer does not decide. */
export function readOnlyLine(own: boolean, pending: boolean, who: string): string | null {
  if (!who) return pending ? 'Nobody can decide it yet. A Super Admin sets who approves what in Company settings, Invoices.' : null
  if (own) return `Your own request. ${who} decides it.`
  return pending ? `Read only. ${who} decides it.` : null
}

/**
 * A reimbursement is money: its row is for whoever sees that person's money
 * (seesMoney), never anyone else, whatever their level. A decider on the
 * Reimbursements list who is neither Super Admin nor Finance is not shown the
 * row (the safe choice, owner, 5 November 2026); today the list is Super Admins.
 */
export const showsRmb = (v: Pick<Viewer, 'can' | 'personId'>, personId: string, settings: Pick<InvoiceSettings, 'finance'>): boolean =>
  seesMoney(moneyViewer(v), personId, settings)

/** A Team Leader sees the extra hours of the teams they lead, and their own. */
export const showsXh = (v: Viewer, personId: string, teamId: string | null): boolean =>
  v.level !== 'team_leader' || personId === v.personId || (!!teamId && v.ledTeamIds.has(teamId))

/**
 * How many time off, reimbursement and extra hours rows are waiting for this
 * viewer in Approvals: what loadRequestRows lists with the viewer as owner,
 * counted with the same predicates (a request with several receipts is one).
 */
export async function waitingRequests(v: Viewer, dir: Directory, settings: InvoiceSettings): Promise<number> {
  const c = db()
  const [offs, rmbs, xhs] = await Promise.all([
    allRows<{ person_id: string; state: string; cancel_asked_at: string | null }>((a, b) => c.from('tc_absence_requests').select('person_id, state, cancel_asked_at')
      .or('state.eq.pending,cancel_asked_at.not.is.null').order('id').range(a, b), 'Time off could not be read'),
    allRows<{ person_id: string; report_id: number | null }>((a, b) => c.from('reimbursements').select('person_id, report_id').eq('state', 'pending').order('id').range(a, b), 'Reimbursements could not be read'),
    allRows<{ person_id: string }>((a, b) => c.from('extra_hours_requests').select('person_id').eq('state', 'pending').order('id').range(a, b), 'Extra hours could not be read'),
  ])
  const deciders = await loadRequestDeciders([...offs, ...rmbs, ...xhs].map(r => r.person_id), settings)
  const rmbRows = rmbs.filter(r => showsRmb(v, r.person_id, settings) && decidesRequest(v, deciders('rmb', r.person_id), r.person_id))
  return offs.filter(r => offWaiting(r) && decidesRequest(v, deciders('off', r.person_id), r.person_id)).length
    + new Set(rmbRows.filter(r => r.report_id != null).map(r => r.report_id)).size + rmbRows.filter(r => r.report_id == null).length
    + xhs.filter(r => showsXh(v, r.person_id, dir.people.get(r.person_id)?.teamId ?? null) && decidesRequest(v, deciders('xh', r.person_id), r.person_id)).length
}

type Rmb = { id: number; person_id: string; spent_on: string; category: string; purpose: string; amount: number; currency: string; client: string | null; billable: boolean; state: string; asked_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; invoice_id: number | null; document_id: number | null; receipt_path: string | null; receipt_name: string | null; receipt_size: number | null; receipt_number: string | null; report_id: number | null; miles: number | null }
type OffRow = { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; reason: string | null; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; cancel_asked_at: string | null; cancel_reason: string | null; cancelled_at: string | null; cancelled_by: string | null }
type XhRow = { id: number; person_id: string; asked_by: string | null; hours: number; period: string; period_start: string; period_end: string; client: string | null; reason: string; state: string; asked_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null }

export async function loadRequestRows(v: Viewer, dir: Directory, since: string, settings: InvoiceSettings, now = new Date()): Promise<CardRow[]> {
  const c = db()
  // Every row, a page at a time, and a failed read throws: an empty list would read as nothing waiting.
  const [offs, rmbs, xhs, catalog] = await Promise.all([
    allRows<OffRow>((a, b) => c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, hours_per_day, state, reason, requested_at, decided_by, decided_at, decision_note, cancel_asked_at, cancel_reason, cancelled_at, cancelled_by')
      .or(`state.eq.pending,cancel_asked_at.not.is.null,decided_at.gte.${since},cancelled_at.gte.${since}`).order('id').range(a, b), 'Time off could not be read'),
    allRows<Rmb>((a, b) => c.from('reimbursements').select('id, person_id, spent_on, category, purpose, amount, currency, client, billable, state, asked_at, decided_by, decided_at, decision_note, invoice_id, document_id, receipt_path, receipt_name, receipt_size, receipt_number, report_id, miles')
      .or(`state.eq.pending,decided_at.gte.${since}`).order('id').range(a, b), 'Reimbursements could not be read'),
    allRows<XhRow>((a, b) => c.from('extra_hours_requests').select('id, person_id, asked_by, hours, period, period_start, period_end, client, reason, state, asked_at, decided_by, decided_at, decision_note')
      .or(`state.eq.pending,decided_at.gte.${since}`).order('id').range(a, b), 'Extra hours could not be read'),
    loadCatalog(),
  ])
  const person = (id: string) => {
    const p = dir.people.get(id)
    const t = p?.teamId ? dir.teams.get(p.teamId) : undefined
    return { name: p?.name ?? 'Someone', initials: initials(p?.name ?? ''), team: t ? { name: t.name, color: t.color } : null, teamId: p?.teamId ?? null }
  }
  const deciders = await loadRequestDeciders([...offs, ...rmbs, ...xhs].map(r => r.person_id), settings)
  // Whose decision a waiting row is: the viewer when it is theirs, else the first decider; with their names.
  const routed = (kind: 'off' | 'rmb' | 'xh', personId: string, pending: boolean) => {
    const ids = deciders(kind, personId)
    const decides = decidesRequest(v, ids, personId)
    const canDecide = pending && decides
    return { canDecide, decides, owner: !pending ? null : canDecide ? v.personId : ids[0] ?? null, ownerName: decidersText(ids, id => dir.nameOf(id)) }
  }
  const out: CardRow[] = []

  // ── Time off (7C), and approved time off its person asks to cancel ───────
  const offRows = offs
  if (offRows.length) {
    const lo = offRows.reduce((m, r) => (r.start_date < m ? r.start_date : m), '9999-12-31')
    const hi = offRows.reduce((m, r) => (r.end_date > m ? r.end_date : m), '0000-01-01')
    const holidays = holidaysBetween(addDays(lo, -7), addDays(hi, 7))
    const winLo = addDays(lo, -7), winHi = addDays(hi, 7)
    const years = [...new Set(offRows.map(r => r.start_date.slice(0, 4)))].sort()
    const askers = [...new Set(offRows.map(r => r.person_id))]
    // Who is out in those weeks, whoever they are: time off in the entries (the TSheets history and what North Time
    // approved), requests still waiting, and the absences contractors put on the Agenda. And the askers' own year.
    const [outEntries, waitingOff, agendaOut, yearEntries, yearAsks, workedRows] = await Promise.all([
      allRows<{ person_id: string; entry_date: string; jobcode_id: number | null }>((a, b) => c.from('tc_entries').select('person_id, entry_date, jobcode_id')
        .eq('kind', 'absence').gte('entry_date', winLo).lte('entry_date', winHi).order('id').range(a, b), 'Time off could not be read'),
      allRows<{ id: number; person_id: string; start_date: string; end_date: string; state: string }>((a, b) => c.from('tc_absence_requests').select('id, person_id, start_date, end_date, state')
        .in('state', ['pending', 'approved']).lte('start_date', winHi).gte('end_date', winLo).order('id').range(a, b), 'Time off could not be read'),
      allRows<{ created_by: string | null; start_date: string; end_date: string }>((a, b) => c.from('agenda_events').select('created_by, start_date, end_date')
        .eq('type', 'absence').lte('start_date', winHi).gte('end_date', winLo).order('id').range(a, b), 'Absences could not be read'),
      allRows<{ person_id: string; entry_date: string; duration_seconds: number; jobcode_id: number | null }>((a, b) => c.from('tc_entries').select('person_id, entry_date, duration_seconds, jobcode_id')
        .eq('kind', 'absence').in('person_id', askers).gte('entry_date', `${years[0]}-01-01`).lte('entry_date', `${years[years.length - 1]}-12-31`).order('id').range(a, b), 'Time off could not be read'),
      // Asked after the fact (owner, 23 November 2026): every request of the askers in those years, to count the late ones,
      // and the hours they worked on the requests' days, so the decider sees the whole day.
      allRows<{ id: number; person_id: string; start_date: string; requested_at: string }>((a, b) => c.from('tc_absence_requests').select('id, person_id, start_date, requested_at')
        .in('person_id', askers).in('state', ['pending', 'approved']).gte('start_date', `${years[0]}-01-01`).lte('start_date', `${years[years.length - 1]}-12-31`).order('id').range(a, b), 'Time off could not be read'),
      allRows<{ person_id: string; entry_date: string; duration_seconds: number }>((a, b) => c.from('tc_entries').select('person_id, entry_date, duration_seconds')
        .neq('kind', 'absence').in('person_id', askers).gte('entry_date', lo).lte('entry_date', hi).order('id').range(a, b), 'The hours could not be read'),
    ])
    // Each asker's balance (Rippling's report, less what was approved since; time-off-rules.ts), for whoever decides.
    const standings = await loadOffStandings(askers, localDate(new Date(), v.zone))
    const askedOn = (pid: string, t: string) => localDate(t, dir.zoneOf(pid))
    const lateAsks = yearAsks.filter(q => askedLate(askedOn(q.person_id, q.requested_at), q.start_date))
    const workedOn = new Map<string, number>()
    for (const w of workedRows) workedOn.set(`${w.person_id}|${w.entry_date}`, (workedOn.get(`${w.person_id}|${w.entry_date}`) ?? 0) + (Number(w.duration_seconds) || 0))
    const kindOfJob = (id: number | null) => offKindOf(id != null ? catalog.jobs.get(id) : null)
    // person -> day -> out, or only asked. Approved wins over asked; a company holiday is nobody's time off.
    const outBy = new Map<string, Map<string, 'out' | 'ask'>>()
    const mark = (pid: string | null, day: string, how: 'out' | 'ask') => {
      if (!pid) return
      const m = outBy.get(pid) ?? outBy.set(pid, new Map()).get(pid)!
      if (how === 'out' || !m.has(day)) m.set(day, how)
    }
    for (const e of outEntries) if (kindOfJob(e.jobcode_id)) mark(e.person_id, e.entry_date, 'out')
    for (const o of [...waitingOff.map(w => ({ pid: w.person_id, from: w.start_date, to: w.end_date, how: w.state === 'approved' ? 'out' as const : 'ask' as const, id: w.id })),
      ...agendaOut.map(a => ({ pid: a.created_by, from: a.start_date, to: a.end_date, how: 'out' as const, id: -1 }))]) {
      for (let d = o.from < winLo ? winLo : o.from; d <= o.to && d <= winHi; d = addDays(d, 1)) mark(o.pid, d, o.how)
    }
    const yearOf = new Map<string, OffEntry[]>()
    for (const e of yearEntries) {
      const kind = kindOfJob(e.jobcode_id)
      if (kind) (yearOf.get(e.person_id) ?? yearOf.set(e.person_id, []).get(e.person_id)!).push({ date: e.entry_date, seconds: Number(e.duration_seconds) || 0, kind })
    }
    for (const r of offRows) {
      const who = person(r.person_id)
      const kind = catalog.jobs.get(r.jobcode_id)?.short ?? 'Time off'
      const { days } = offDays(r.start_date, r.end_date, holidays)
      const hpd = Number(r.hours_per_day)
      const seconds = Math.round(days.length * hpd * 3600)
      const cancelAsk = r.state === 'approved' && !!r.cancel_asked_at
      const pending = offWaiting(r)
      // The team calendar: the working week(s) around the request, the request, the team's time off, the holidays.
      const monday = addDays(r.start_date, -((new Date(`${r.start_date}T00:00:00Z`).getUTCDay() + 6) % 7))
      const lastDay = addDays(r.end_date, (5 - new Date(`${r.end_date}T00:00:00Z`).getUTCDay() + 7) % 7)
      const week: string[] = []
      for (let d = monday; d <= lastDay && week.length < 10; d = addDays(d, 1)) { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); if (w > 0 && w < 6) week.push(d) }
      // Everyone else out in those weeks: on a team the person is on, or on another one.
      const myTeams = new Set(dir.people.get(r.person_id)?.teamIds ?? [])
      const sharesTeam = (pid: string) => (dir.people.get(pid)?.teamIds ?? []).some(t => myTeams.has(t))
      const away = [...outBy.entries()].filter(([pid, m]) => pid !== r.person_id && dir.people.has(pid) && week.some(d => m.has(d)))
        .map(([pid, m]) => ({ pid, days: m, mate: sharesTeam(pid), name: dir.nameOf(pid) })).sort((a, b) => a.name.localeCompare(b.name))
      const mates = away.filter(a => a.mate), others = away.filter(a => !a.mate)
      const teamOf = (pid: string) => { const t = dir.people.get(pid)?.teamId; return t ? dir.teams.get(t)?.name ?? 'No team' : 'No team' }
      const rowOf = (a: typeof away[number], group: 'team' | 'others') => {
        const asksOnly = week.every(d => a.days.get(d) !== 'out')
        return { name: a.name, sub: group === 'others' ? `${teamOf(a.pid)}${asksOnly ? ', asked' : ''}` : asksOnly ? 'Asked, not approved yet' : 'Out', color: group === 'team' ? '#1E7D7F' : '#85B7EB', group, cells: week.map(d => a.days.get(d) ?? null) }
      }
      const hols = week.filter(d => holidays.has(d))
      const calRows: NonNullable<RequestCard['cal']>['rows'] = [
        { name: who.name, sub: 'This request', color: who.team?.color ?? '#9CA3AF', group: 'req', cells: week.map(d => (days.includes(d) ? 'req' : null)) },
        ...mates.map(a => rowOf(a, 'team')),
        ...others.map(a => rowOf(a, 'others')),
        ...[...new Set(hols.map(d => holidays.get(d)!))].map(name => ({ name, sub: 'Company holiday', color: '#e4e7ec', group: 'hol' as const, cells: week.map(d => (holidays.get(d) === name ? 'hol' as const : null)) })),
      ]
      // Approved time off on the request's own days: the row's flag, and Home's "also out".
      const clash = mates.flatMap(a => days.filter(d => a.days.get(d) === 'out').map(d => ({ who: a.name, d })))
      const spanText = (ds: string[]) => (ds.length === 1 ? dayLabel(ds[0]) : daysText(ds[0], ds[ds.length - 1]).replace(/^[A-Z][a-z]{2}, /, '').replace(/ to [A-Z][a-z]{2}, /, ' to '))
      const alsoPeople = mates.map(a => ({ a, on: days.filter(d => a.days.has(d)) })).filter(x => x.on.length)
        .map(({ a, on }) => ({ name: a.name, initials: initials(a.name), color: teamColour(who.team?.color, who.team?.name), when: spanText(week.filter(d => a.days.has(d))), asked: on.every(d => a.days.get(d) === 'ask') }))
      const teamSize = [...dir.people.values()].filter(p => isStaff(p) && p.teamIds.some(t => myTeams.has(t))).length
      const worst = days.map(d => ({ d, n: mates.filter(a => a.days.get(d) === 'out').length })).sort((x, y) => y.n - x.n)[0]
      const also: RequestCard['also'] = who.team ? {
        team: who.team.name, people: alsoPeople,
        warn: worst && worst.n >= 2 ? `${worst.n} of ${teamSize} on ${who.team.name} are already out on ${dayLabel(worst.d)}.` : null,
      } : null
      // Their year by type; a request still waiting is shown as what the year becomes with it.
      const offKindHere = kindOfJob(r.jobcode_id)
      const year = offKindHere ? yearCount(yearOf.get(r.person_id) ?? [], Number(r.start_date.slice(0, 4)),
        r.state === 'pending' ? { kind: offKindHere, seconds, date: r.start_date } : null) : null
      const own = r.person_id === v.personId
      const { canDecide, decides, owner, ownerName } = routed('off', r.person_id, pending)
      // Asked after its first day: said on the row and the card, with which one of the year it is and the day's whole hours.
      const late = askedLate(askedOn(r.person_id, r.requested_at), r.start_date)
      const lateNth = late ? lateAsks.filter(q => q.person_id === r.person_id && q.start_date.slice(0, 4) === r.start_date.slice(0, 4) && q.requested_at <= r.requested_at).length || 1 : 0
      const dayLines = late ? days.slice(0, 6).map(d => {
        const worked = workedOn.get(`${r.person_id}|${d}`) ?? 0
        return `${dayLabel(d)}: ${formatDuration(worked)} worked + ${formatDuration(hpd * 3600)} off = ${formatDuration(worked + hpd * 3600)}`
      }) : []
      const label = daysText(r.start_date, r.end_date)
      // The reasons for time off (its note, why cancel): the person and Super Admins only (owner, 5 November 2026).
      const reads = readsOffReason(v, r.person_id)
      const reason = reads ? r.reason : null
      const cancelReason = reads ? r.cancel_reason : null
      const doneOf = (): CardRow['done'] => {
        if (pending) return null
        if (r.state === 'cancelled') return { label: 'Cancelled', tone: 'neu', by: `${dir.nameOf(r.cancelled_by)}, ${short(r.cancelled_at!, v.zone)}` }
        if (r.state === 'denied') return { label: 'Denied', tone: 'bad', by: `${dir.nameOf(r.decided_by)}, ${short(r.decided_at!, v.zone)}${r.decision_note ? `: "${r.decision_note}"` : ''}` }
        return { label: 'Approved', tone: 'ok', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}.` }
      }
      out.push({
        key: `o${r.id}`, type: 'off', id: r.id, personId: r.person_id, ...who,
        main: `${kind} · ${formatDuration(seconds)}`, sub: label,
        flag: cancelAsk ? { text: 'Cancellation asked', tone: 'warn' } : late && pending ? { text: `${LATE_TAG}, ${ordinal(lateNth)} this year`, tone: 'warn' } : clash.length ? { text: `${clash[0].who} is off ${dayLabel(clash[0].d)}`, tone: 'neu' } : null,
        why: cancelAsk ? (cancelReason ? `"${cancelReason}"` : null) : reason ? `"${reason}"` : null,
        asked: cancelAsk ? `Cancellation asked ${short(r.cancel_asked_at!, v.zone)}` : asked(r.requested_at, v.zone),
        askedAt: cancelAsk ? r.cancel_asked_at! : r.requested_at,
        ownerName, owner, decides, own,
        done: doneOf(),
        href: null,
        request: {
          kind: cancelAsk ? 'off-cancel' : 'off', id: r.id, type: 'Time off',
          title: cancelAsk ? `Cancel ${kind}, ${formatDuration(seconds)}` : `${kind}, ${formatDuration(seconds)}`,
          width: 720, twoCols: false, receipt: null,
          facts: [
            { k: 'Dates', v: `${label}, ${r.end_date.slice(0, 4)}` },
            { k: 'Counted', v: `${days.length} working day${days.length === 1 ? '' : 's'}, ${dayHoursLabel(hpd)} a day, ${formatDuration(seconds)}` },
            { k: 'Balance', v: isPaidKind(offKindHere) ? balanceLine(kind, standings.get(r.person_id)?.balances[offKindHere], pending ? seconds : 0) : `${kind}: it is not paid, so it has no balance.` },
            ...(late ? [
              { k: LATE_TAG, v: `Asked ${dayLabel(askedOn(r.person_id, r.requested_at))}, for days already gone. The ${ordinal(lateNth)} one this year.` },
              // Why it was not asked before is written for whoever decides: they read it too, not only the person and Super Admins.
              ...((reads || decides) && r.reason ? [{ k: 'Why it was not asked before', v: `"${r.reason}"` }] : []),
              ...(dayLines.length ? [{ k: 'Those days, with the hours worked', v: `${dayLines.join('; ')}${days.length > dayLines.length ? '; and more' : ''}` }] : []),
            ] : []),
            ...(cancelAsk ? (cancelReason ? [{ k: 'Why cancel', v: `"${cancelReason}"` }] : []) : reason && !late ? [{ k: 'Note', v: `"${reason}"` }] : []),
          ],
          allow: null,
          also, year,
          cal: { team: who.team?.name ?? null, label: `Who is out, ${week.length ? daysText(week[0], week[week.length - 1]).replace(/^[A-Z][a-z]{2}, /, '').replace(/ to [A-Z][a-z]{2}, /, ' to ') : label}`, days: week.map(d => dayLabel(d).replace(/^([A-Z][a-z]{2}), [A-Z][a-z]{2} (\d+)$/, '$1 $2')), rows: calRows },
          after: cancelAsk
            ? `Approving the cancellation takes ${formatDuration(seconds)} of ${kind} off ${who.name.split(' ')[0]}'s time entries, and off the team calendar. Keep it, with a reason, and it stays.`
            : `On approval, by itself: the team calendar gets "${who.name}, out" on ${label}, and North Time writes ${dayHoursLabel(hpd)} a day (${formatDuration(seconds)} of ${kind}) into their time entries. Finance takes it to payroll.`,
          canDecide,
          roText: canDecide ? null : readOnlyLine(own, pending, ownerName),
          approveLabel: cancelAsk ? 'Approve cancellation' : 'Approve', denyLabel: cancelAsk ? 'Keep it' : 'Decline',
        },
      })
    }
  }

  // ── Reimbursements (9C) ──────────────────────────────────────────────────
  const rmbRows = rmbs.filter(r => showsRmb(v, r.person_id, settings))
  if (rmbRows.length) {
    const routes = await loadRoutes([...new Set(rmbRows.map(r => r.person_id))])
    const reportIds = [...new Set(rmbRows.map(r => r.report_id).filter((x): x is number => x != null))]
    const [openDocs, reports] = await Promise.all([
      allRows<{ id: number; number: string; person_id: string; total: number }>((a, b) => c.from('reimbursement_documents').select('id, number, person_id, total').eq('state', 'approved').order('id').range(a, b), 'Reimbursement documents could not be read'),
      reportIds.length ? c.from('reimbursement_reports').select('id, name').in('id', reportIds).then(r => must(r, 'Reimbursement requests could not be read') ?? []) : Promise.resolve([] as { id: number; name: string | null }[]),
    ])
    const amountOf = (r: Rmb) => (r.currency === 'USD' ? usd(Number(r.amount)) : `${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency}`)
    const sizeOf = (n: number | null) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '')
    // The receipt's number (RCT-2026-005) leads its small line; the name it was sent with stays its title.
    const receiptOf = (r: Rmb) => (!r.receipt_path ? null : { id: r.id, file: r.receipt_name ?? 'receipt', sub: `${r.receipt_number ? `${r.receipt_number} · ` : ''}${(r.receipt_name ?? '').toLowerCase().endsWith('.pdf') ? 'PDF' : 'Photo'}${sizeOf(r.receipt_size) ? `, ${sizeOf(r.receipt_size)}` : ''}` })

    // A request with several receipts (migration 122): one row, each receipt decided on its own.
    const byReport = new Map<number, Rmb[]>()
    for (const r of rmbRows) if (r.report_id != null) byReport.set(r.report_id, [...(byReport.get(r.report_id) ?? []), r])
    for (const [reportId, list] of byReport) {
      const r0 = list[0]
      const who = person(r0.person_id)
      const contractor = !!routes.get(r0.person_id)?.isContractor
      const name = reports.find(x => x.id === reportId)?.name ?? null
      const own = r0.person_id === v.personId
      const waiting = list.filter(r => r.state === 'pending')
      const pending = waiting.length > 0
      const { canDecide, decides, owner, ownerName } = routed('rmb', r0.person_id, pending)
      const doc = openDocs.find(d => d.person_id === r0.person_id)
      const values = list.map(r => ({ amount: Number(r.amount), currency: r.currency }))
      const total = totalsText(values)
      const denied = list.filter(r => r.state === 'denied').length, approved = list.length - waiting.length - denied
      const decided = list.filter(r => r.decided_at).sort((a, b) => b.decided_at!.localeCompare(a.decided_at!))[0]
      const clients = [...new Set(list.map(r => r.client).filter((x): x is string => !!x))]
      const purposes = list.map(r => r.purpose)
      // Meals over the $25 go through for review (owner, 5 November 2026): the row and the card say so.
      const overs = list.filter(r => overMealCap(r.category, Number(r.amount), r.currency)).length
      out.push({
        key: `rr${reportId}`, type: 'rmb', id: reportId, personId: r0.person_id, ...who,
        main: `${name ?? 'Several receipts'} · ${total}`, sub: `${receiptsText(list.length)}: ${purposes.slice(0, 3).join(', ')}${purposes.length > 3 ? ', …' : ''}`,
        flag: overs ? { text: MEAL_OVER_FLAG, tone: 'warn' } : null,
        why: contractor ? 'Contractor: each receipt goes on their next invoice.' : 'Employee: they go on a reimbursement document for Finance.',
        asked: asked(r0.asked_at, v.zone), askedAt: r0.asked_at,
        ownerName, owner, decides, own,
        done: pending ? null : {
          label: !denied ? 'Approved' : !approved ? 'Denied' : `Approved ${approved}, denied ${denied}`, tone: !denied ? 'ok' : !approved ? 'bad' : 'warn',
          by: decided ? `${dir.nameOf(decided.decided_by)}, ${dateLabel(localDate(decided.decided_at!, v.zone)).replace(/, \d{4}$/, '')}` : '',
        },
        href: null,
        request: {
          kind: 'rmb-report', id: reportId, type: 'Reimbursement', title: `${reportTitle(name, list.length)}, ${total}`, width: 760, twoCols: false,
          receipt: null,
          items: list.map(r => ({
            id: r.id, date: dayLabel(r.spent_on).replace(/^[A-Z][a-z]{2}, /, ''), category: r.category, purpose: r.purpose, amount: amountOf(r), value: { amount: Number(r.amount), currency: r.currency },
            client: r.client ? `${r.client}, ${r.billable ? 'billable' : 'not billable'}` : null, receipt: receiptOf(r), state: r.state, note: r.decision_note,
            ...(overMealCap(r.category, Number(r.amount), r.currency) ? { over: true } : {}),
          })),
          facts: [{ k: 'Client or project', v: clients.length ? clients.join(', ') : 'None, not billable to a client' }],
          allow: overs ? `${overs === 1 ? 'A meal is' : `${overs} meals are`} over the $25 meal limit. The description says why; review it before you approve.` : null, cal: null,
          after: contractor
            ? `${who.name} is a contractor. They add each receipt you approve to their next invoice, as its own line.`
            : `${who.name} is an employee. The receipts you approve go on ${doc ? `reimbursement document ${doc.number}` : 'a new reimbursement document'} for Finance to pay, each as its own line${doc ? `, with the items already on it (${usd(Number(doc.total))})` : ''}.`,
          canDecide, roText: canDecide ? null : readOnlyLine(own, pending, ownerName),
          approveLabel: waiting.length > 1 ? `Approve all ${waiting.length}` : 'Approve', denyLabel: waiting.length > 1 ? 'Decline all' : 'Decline',
          ...(pending ? { version: rmbVersion(waiting) } : {}),
        },
      })
    }

    for (const r of rmbRows.filter(x => x.report_id == null)) {
      const who = person(r.person_id)
      const contractor = !!routes.get(r.person_id)?.isContractor
      const amt = r.currency === 'USD' ? usd(Number(r.amount)) : `${Number(r.amount).toFixed(2)} ${r.currency}`
      const own = r.person_id === v.personId
      const pending = r.state === 'pending'
      const { canDecide, decides, owner, ownerName } = routed('rmb', r.person_id, pending)
      const doc = openDocs.find(d => d.person_id === r.person_id)
      const isPdf = (r.receipt_name ?? '').toLowerCase().endsWith('.pdf')
      const over = overMealCap(r.category, Number(r.amount), r.currency)
      const size = r.receipt_size ? (r.receipt_size >= 1048576 ? `${(r.receipt_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(r.receipt_size / 1024))} KB`) : ''
      out.push({
        key: `r${r.id}`, type: 'rmb', id: r.id, personId: r.person_id, ...who,
        main: `${r.category} · ${amt}`, sub: r.purpose, flag: over ? { text: MEAL_OVER_FLAG, tone: 'warn' } : null,
        why: contractor ? 'Contractor: goes on their next invoice.' : 'Employee: goes on a reimbursement document for Finance.',
        asked: asked(r.asked_at, v.zone), askedAt: r.asked_at,
        ownerName, owner, decides, own,
        done: pending ? null : r.state === 'denied'
          ? { label: 'Denied', tone: 'bad', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}${r.decision_note ? `: "${r.decision_note}"` : ''}` }
          : { label: 'Approved', tone: 'ok', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}` },
        href: null,
        request: {
          kind: 'rmb', id: r.id, type: 'Reimbursement', title: `${r.category}, ${amt}`, width: 760, twoCols: true,
          receipt: r.receipt_path ? { id: r.id, file: r.receipt_name ?? 'receipt', sub: `${r.receipt_number ? `${r.receipt_number} · ` : ''}${isPdf ? 'PDF' : 'Photo'}${size ? `, ${size}` : ''}` } : null,
          facts: [
            { k: 'Date of the expense', v: `${dayLabel(r.spent_on)}, ${r.spent_on.slice(0, 4)}` },
            { k: 'Amount', v: `${amt} (${r.currency})` },
            { k: DESCRIPTION_LABEL, v: r.purpose },
            { k: 'Client or project', v: r.client ? `${r.client}, ${r.billable ? 'billable' : 'not billable'} to the client` : 'None, not billable to a client' },
          ],
          allow: over ? `${MEAL_OVER_FLAG}. The description says why; review it before you approve.` : null, cal: null,
          after: contractor
            ? `${who.name} is a contractor. Approved, they add it to their next invoice.`
            : `${who.name} is an employee. Approving puts it on ${doc ? `reimbursement document ${doc.number}` : 'a new reimbursement document'} for Finance to pay${doc ? `, with the items already on it (${usd(Number(doc.total))})` : ''}.`,
          canDecide, roText: canDecide ? null : readOnlyLine(own, pending, ownerName),
          approveLabel: 'Approve', denyLabel: 'Decline',
          ...(pending ? { version: rmbVersion([r]) } : {}),
        },
      })
    }
  }

  // ── Extra hours (10D) ────────────────────────────────────────────────────
  const xhRows = xhs
  if (xhRows.length) {
    const ids = [...new Set(xhRows.map(r => r.person_id))]
    const terms = await loadPayTerms(ids)
    const use = await loadAllowanceUse(terms, now, await loadApprovedExtra(ids, addDays(localDate(now, v.zone), -40), addDays(localDate(now, v.zone), 40)))
    const { weekStart } = await loadClockySettings()
    for (const r of xhRows) {
      const who = person(r.person_id)
      if (!showsXh(v, r.person_id, who.teamId)) continue
      const own = r.person_id === v.personId
      const pending = r.state === 'pending'
      const { canDecide, decides, owner, ownerName } = routed('xh', r.person_id, pending)
      const hours = formatDuration(Number(r.hours) * 3600)
      // A pay period too since 9 November 2026 (owner): "the pay period Nov 8 to 21".
      const pp = r.period === 'pay_period'
      const when = r.period === 'month' ? monthYear(r.period_start) : pp ? windowName('pay_period', r.period_start, r.period_end) : `the week of ${dayLabel(r.period_start)}`
      const whenFact = r.period === 'month' ? monthYear(r.period_start) : pp ? `Pay period ${rangeLabel(r.period_start, r.period_end)}` : `Week of ${dayLabel(r.period_start)}`
      const t = terms.get(r.person_id)
      const u = use.get(r.person_id)
      // The hours of the window asked for, when it is one of the person's windows now.
      const win = t?.allowance ? allowanceFor(t.allowance, r.period_start, weekStart) : null
      const cap = win && win.period === r.period && win.from === r.period_start ? win.hours : null
      out.push({
        key: `x${r.id}`, type: 'xh', id: r.id, personId: r.person_id, ...who,
        main: `Extra hours · ${hours}`, sub: `${whenFact}${r.client ? ` · ${r.client}` : ''}`,
        flag: null, why: `"${r.reason}"`, asked: `${asked(r.asked_at, v.zone)}${r.asked_by && r.asked_by !== r.person_id ? ` by ${dir.nameOf(r.asked_by)}` : ''}`, askedAt: r.asked_at,
        ownerName, owner, decides, own,
        done: pending ? null : { label: r.state === 'approved' ? 'Approved' : 'Denied', tone: r.state === 'approved' ? 'ok' : 'bad', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}${r.state === 'denied' && r.decision_note ? `: "${r.decision_note}"` : ''}` },
        href: null,
        request: {
          kind: 'xh', id: r.id, type: 'Extra hours', title: `${hours} in ${r.period === 'month' ? monthYear(r.period_start).split(' ')[0] : when}`, width: 620, twoCols: false, receipt: null,
          facts: [{ k: 'When', v: whenFact }, { k: 'Client or project', v: r.client ?? 'None' }, { k: 'Why', v: `"${r.reason}"` }],
          allow: t?.allowance ? `Allowance: ${limitAsTyped(t.allowance)}${u && u.hours !== t.allowance.hours ? `, ${u.hours}h ${u.period === 'pay_period' ? 'this pay period' : `in ${monthYear(u.from).split(' ')[0]}`}` : ''}.${u ? ` ${u.period === 'month' ? monthYear(u.from).split(' ')[0] : u.period === 'pay_period' ? 'This pay period' : 'This week'} so far: ${formatDuration(u.used)}.${u.over ? ` ${formatDuration(u.over)} over without approval.` : ''}` : ''}` : 'No allowance set: the hours are never flagged as over.',
          cal: null,
          after: cap != null
            ? `Approved, their allowance for ${when} becomes ${Math.round((cap + Number(r.hours)) * 100) / 100}h. Hours past that are flagged again, in the clock panel, Who's working and this queue.`
            : 'Approved, these hours are added to the allowance of that period. Hours past it are flagged again.',
          canDecide, roText: canDecide ? null : readOnlyLine(own, pending, ownerName),
          approveLabel: 'Approve', denyLabel: 'Decline',
        },
      })
    }
  }
  return out
}
