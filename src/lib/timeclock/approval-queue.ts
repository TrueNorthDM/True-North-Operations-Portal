/**
 * The Approvals list of Clocky part 2 (Approvals.dc.html, frames AP, AP-3,
 * AP-2, AP-L, AP-D): one queue of five kinds (Timesheet, Time off,
 * Reimbursement, Extra hours, Time correction) in three tabs:
 *
 *   Waiting for you   items whose current owner is you: timesheets by the
 *                     routing (lib/timeclock/routing.ts); time off,
 *                     reimbursements and extra hours for Super Admins; time
 *                     corrections for whoever may decide them
 *   With others       read only: what is still with a Team Leader, Dave
 *                     Sharpe or a Super Admin
 *   Decided           who, when and why, the last 90 days
 *
 * Team Leaders see their own teams only, and never money: a timesheet row
 * says "Hours only" instead of the invoice. Anyone else below Admin who holds
 * Approvals (a User given it) sees only the rows they decide, and money only
 * where pay-terms.ts seesMoney says so.
 *
 * The Approvals count (clocky-approvals.ts countWaiting) is "Waiting for you"
 * counted with the same predicates, without building the rows.
 *
 * Not a "use server" file: approvals/actions.ts serves it.
 */

import type { Viewer } from './clocky-context'
import { allRows, db, loadDirectory, must } from './clocky-context'
import { loadApprovals } from './clocky-approvals'
import { initials, localDate, timeLabel, dateLabel, rangeLabel } from './format'
import { formatDuration } from './rounding'
import { allowanceStatus } from './allowance'
import { loadApprovedExtra } from './allowance-data'
import { hoursByClient } from './invoices-data'
import { loadPayTerms, loadRouteSettings, seesMoney, type InvoiceSettings } from './pay-terms'
import { periodLabel } from './periods'
import { currentStep, hoursApprover, invoiceApprover, oneStep, type TimesheetState } from './routing'
import type { ApprovalRow } from './clocky-types'
import { decidesRequest, loadRequestRows, moneyViewer, type RequestCard } from './request-cards'

export type QueueType = 'ts' | 'off' | 'rmb' | 'xh' | 'cor'
export type Tone = 'ok' | 'warn' | 'bad' | 'neu' | 'teal'

export interface QueueRow {
  key: string
  type: QueueType
  id: number
  personId: string
  name: string
  initials: string
  team: { name: string; color: string | null } | null
  /** "October 2026 · 151h 15m" */
  main: string
  /** "Invoice INV-2026-0143 · $3,357.50", "Hours only" */
  sub: string
  flag: { text: string; tone: Tone } | null
  /** "Submitted with 1 reimbursement.", a request's reason in quotes. */
  why: string | null
  /** "Submitted Nov 1, 9:14 AM" */
  asked: string
  askedAt: string
  /** Whose decision it is now: a person, or any Super Admin. */
  ownerName: string
  own: boolean
  /** Decided rows: the pill and who, when, why. */
  done: { label: string; tone: Tone; by: string } | null
  /** Timesheets open their page; the rest their card. */
  href: string | null
  /** Time corrections keep their part 1 card. */
  card: ApprovalRow | null
  /** Time off, reimbursements and extra hours: their card (7C, 9C, 10D). */
  request: RequestCard | null
}

export interface QueueData {
  level: Viewer['level']
  subtitle: string
  wait: QueueRow[]
  others: QueueRow[]
  done: QueueRow[]
  note: string
}

const DECIDED_DAYS = 90
const shortStamp = (t: string, zone: string) => `${dateLabel(localDate(t, zone)).replace(/, \d{4}$/, '')}, ${timeLabel(t, zone)}`

type SubRow = {
  id: number; person_id: string; state: TimesheetState; submitted_at: string | null; approved_at: string | null; approved_by: string | null
  hours_approved_at: string | null; hours_approved_by: string | null; note: string | null; tc_periods: { start_date: string; end_date: string } | null
}
type InvRow = { id: number; number: string; submission_id: number | null; person_id: string; total: number; kind: string; state: string; period_start: string; period_end: string; created_at: string; approved_by: string | null; approved_at: string | null }

/**
 * Home's Needs you (design_handoff_home, 25 October 2026) asks for "Waiting for
 * you" alone: `waitingOnly` reads nothing decided (the queue's rows stay the
 * same, only the Decided tab is empty), and `requests: false` leaves time off,
 * reimbursements and extra hours to their own read.
 */
export async function loadQueue(v: Viewer, now = new Date(), opts: { waitingOnly?: boolean; requests?: boolean } = {}): Promise<QueueData> {
  const c = db()
  const since = opts.waitingOnly ? now.toISOString() : new Date(now.getTime() - DECIDED_DAYS * 86_400_000).toISOString()
  const dir = await loadDirectory()
  const settings = await loadRouteSettings()
  const [legacy, subs, noTs, requests] = await Promise.all([
    loadApprovals(v, now),
    allRows<SubRow>((a, b) => c.from('tc_submissions').select('id, person_id, state, submitted_at, approved_at, approved_by, hours_approved_at, hours_approved_by, note, tc_periods(start_date, end_date)')
      .or(`state.in.(submitted,hours_approved),and(state.in.(approved,returned,recorded),approved_at.gte.${since}),and(state.eq.recorded,submitted_at.gte.${since})`)
      .order('id').range(a, b), 'Timesheets could not be read'),
    // Fixed, no timesheet: the invoice alone is the request.
    allRows<InvRow>((a, b) => c.from('invoices').select('id, number, submission_id, person_id, total, kind, state, period_start, period_end, created_at, approved_by, approved_at')
      .eq('kind', 'fixed_no_timesheet').or(`state.eq.waiting,approved_at.gte.${since}`).order('id').range(a, b), 'Invoices could not be read'),
    opts.requests === false ? Promise.resolve([]) : loadRequestRows(v, dir, since, settings, now),
  ])
  // A failed read throws: a missing invoice would read as "Hours only", missing lines as no reimbursements.
  const subIds = subs.map(s => s.id)
  const invRows = subIds.length
    ? must(await c.from('invoices').select('id, number, submission_id, person_id, total, kind, state, period_start, period_end, created_at, approved_by, approved_at').in('submission_id', subIds), 'Invoices could not be read') as InvRow[]
    : []
  const invBySub = new Map(invRows.map(i => [i.submission_id!, i]))
  const invIds = [...invRows, ...noTs].map(i => i.id)
  const rmbLines = invIds.length ? must(await c.from('invoice_lines').select('invoice_id').eq('kind', 'reimbursement').in('invoice_id', invIds), 'Invoice lines could not be read') ?? [] : []
  const rmbCount = new Map<number, number>()
  for (const l of rmbLines) rmbCount.set(l.invoice_id, (rmbCount.get(l.invoice_id) ?? 0) + 1)

  const personIds = [...new Set([...subs.map(s => s.person_id), ...noTs.map(i => i.person_id)])]
  const terms = await loadPayTerms(personIds)
  const person = (id: string) => {
    const p = dir.people.get(id)
    const team = p?.teamId ? dir.teams.get(p.teamId) : undefined
    return { name: p?.name ?? 'Someone', initials: initials(p?.name ?? ''), team: team ? { name: team.name, color: team.color } : null, teamId: p?.teamId ?? null }
  }
  const nameOf = (id: string | null) => (id ? dir.nameOf(id) : 'Nobody yet')
  const isLead = v.level === 'team_leader'
  const asMoney = moneyViewer(v)
  const leadTeams = v.ledTeamIds

  // The hours of each timesheet, read side by side rather than one after another.
  const workedOf = new Map<number, number>()
  const toRead = subs.filter(s => s.tc_periods && terms.has(s.person_id))
  for (let i = 0; i < toRead.length; i += 10) {
    await Promise.all(toRead.slice(i, i + 10).map(async s => {
      const byClient = await hoursByClient(s.person_id, s.tc_periods!.start_date, s.tc_periods!.end_date, now)
      workedOf.set(s.id, byClient.reduce((n, x) => n + x.seconds, 0))
    }))
  }

  // Over the allowance, per timesheet: worked against the allowance plus the extra hours approved.
  const range = subs.reduce((r, s) => (s.tc_periods ? { from: s.tc_periods.start_date < r.from ? s.tc_periods.start_date : r.from, to: s.tc_periods.end_date > r.to ? s.tc_periods.end_date : r.to } : r), { from: '9999-12-31', to: '0000-01-01' })
  const extra = await loadApprovedExtra(personIds, range.from, range.to)

  const rows: QueueRow[] = []
  // Whose decision each open row is now, and the person's team: used to sort the tabs, never sent.
  const ownerOf = new Map<string, string | null>()
  const teamOf = new Map<string, string | null>()
  // Rows the viewer decides (or decided), whatever their state: all a User below Team Leader sees.
  const decidesOf = new Map<string, boolean>()
  const push = (r: QueueRow, owner: string | null, teamId: string | null, decides: boolean) => { rows.push(r); ownerOf.set(r.key, owner); teamOf.set(r.key, teamId); decidesOf.set(r.key, decides) }
  for (const s of subs) {
    const p = s.tc_periods
    const t = terms.get(s.person_id)
    if (!p || !t) continue
    const route = t.route
    const who = person(s.person_id)
    const money = !isLead && seesMoney(asMoney, s.person_id, settings)
    const inv = invBySub.get(s.id) ?? null
    const worked = workedOf.get(s.id) ?? 0
    const label = periodLabel({ start: p.start_date, end: p.end_date })
    const over = t.allowance && t.allowance.period === 'month'
      ? allowanceStatus(worked, t.allowance.hours, extra(s.person_id, p.start_date, p.end_date)).over
      : 0
    const step = currentStep(route, settings, s.state)
    const hb = hoursApprover(route, settings)
    const ib = invoiceApprover(route, settings)
    let flag: QueueRow['flag'] = null
    if (route.isContractor && !oneStep(route, settings)) {
      flag = s.state === 'hours_approved' ? { text: `Hours approved by ${nameOf(s.hours_approved_by)}`, tone: 'ok' } : s.state === 'submitted' ? { text: `Hours with ${nameOf(hb)}`, tone: 'neu' } : null
    }
    if (over > 0 && !isLead && (s.state === 'submitted' || s.state === 'hours_approved')) flag = { text: `${formatDuration(over)} over the allowance, not approved`, tone: 'warn' }
    const nR = inv ? rmbCount.get(inv.id) ?? 0 : 0
    const done: QueueRow['done'] = s.state === 'approved'
      ? { label: 'Approved', tone: 'ok', by: route.isContractor && !oneStep(route, settings) && s.hours_approved_by
        ? `Hours: ${nameOf(s.hours_approved_by)}, ${dateLabel(localDate(s.hours_approved_at!, v.zone)).replace(/, \d{4}$/, '')}. Invoice: ${nameOf(s.approved_by)}, ${shortStamp(s.approved_at!, v.zone)}.`
        : `${nameOf(s.approved_by)}, ${shortStamp(s.approved_at ?? s.submitted_at ?? now.toISOString(), v.zone)}` }
      : s.state === 'returned'
        ? { label: 'Returned', tone: 'bad', by: `${nameOf(s.approved_by)}, ${shortStamp(s.approved_at ?? now.toISOString(), v.zone)}: "${s.note ?? ''}"` }
        : s.state === 'recorded'
          ? { label: 'Recorded', tone: 'neu', by: `No approval for the Deputy Director. Recorded ${shortStamp(s.submitted_at ?? now.toISOString(), v.zone)}.` }
          : null
    push({
      key: `t${s.id}`, type: 'ts', id: s.id, personId: s.person_id, name: who.name, initials: who.initials, team: who.team,
      main: route.isContractor ? `${label.full} · ${formatDuration(worked)}` : `${rangeLabel(p.start_date, p.end_date)} · ${formatDuration(worked)}`,
      sub: !route.isContractor ? 'Payroll summary, goes to Rippling' : money && inv ? `Invoice ${inv.number} · ${usd(Number(inv.total))}${t.paysAs === 'fixed_monthly' ? ', fixed monthly' : ''}` : 'Hours only',
      flag,
      why: nR ? `Submitted with ${nR} reimbursement${nR > 1 ? 's' : ''}.` : null,
      asked: s.submitted_at ? `Submitted ${shortStamp(s.submitted_at, v.zone)}` : '',
      askedAt: s.submitted_at ?? '',
      ownerName: step?.owner ? nameOf(step.owner) : '',
      own: s.person_id === v.personId,
      done,
      href: `/clocky-hours/approvals/timesheet/${s.id}`,
      card: null,
      request: null,
    }, step?.owner ?? null, who.teamId, s.person_id !== v.personId && [hb, ib, step?.owner, s.approved_by, s.hours_approved_by].includes(v.personId))
  }

  // Fixed, no timesheet: one step, the invoice approver.
  for (const i of noTs) {
    const t = terms.get(i.person_id)
    if (!t) continue
    const who = person(i.person_id)
    const ib = invoiceApprover(t.route, settings)
    const money = !isLead && seesMoney(asMoney, i.person_id, settings)
    push({
      key: `n${i.id}`, type: 'ts', id: i.id, personId: i.person_id, name: who.name, initials: who.initials, team: who.team,
      main: `${periodLabel({ start: i.period_start, end: i.period_end }).full} · fixed monthly`,
      sub: money ? `Invoice ${i.number} · ${usd(Number(i.total))}` : 'No timesheet',
      flag: { text: 'No timesheet', tone: 'neu' },
      why: 'Fixed monthly, no timesheet.',
      asked: `Created by itself, ${dateLabel(localDate(i.created_at, v.zone)).replace(/, \d{4}$/, '')}`,
      askedAt: i.created_at,
      ownerName: nameOf(ib),
      own: i.person_id === v.personId,
      done: i.state === 'approved' || i.state === 'paid' ? { label: 'Approved', tone: 'ok', by: `${nameOf(i.approved_by)}, ${shortStamp(i.approved_at!, v.zone)}` } : i.state === 'draft' ? { label: 'Returned', tone: 'bad', by: `${nameOf(i.approved_by)}` } : null,
      href: `/clocky-hours/approvals/invoice/${i.id}`,
      card: null,
      request: null,
    }, i.state === 'waiting' ? ib : null, who.teamId, i.person_id !== v.personId && (ib === v.personId || i.approved_by === v.personId))
  }

  // Time corrections, as part 1 reads them, in the new shape.
  for (const r of [...legacy.waiting, ...legacy.decided]) {
    if (r.type !== 'correction') continue
    const who = person(r.personId)
    const [first, rest] = r.when.includes(' · ') ? [r.when.slice(0, r.when.indexOf(' · ')), r.when.slice(r.when.indexOf(' · ') + 3)] : [r.when, '']
    push({
      key: r.key, type: 'cor', id: r.id, personId: r.personId, name: r.name, initials: r.initials, team: r.team,
      main: `Time correction · ${formatDuration(r.seconds)}`,
      sub: `${first} · ${rest}`,
      flag: null,
      why: r.reason ? `"${r.reason}"` : null,
      asked: r.asked.replace(/, \d{4},/, ','),
      askedAt: r.askedAt,
      ownerName: r.goesTo || 'a Team Leader',
      own: r.personId === v.personId,
      done: r.state === 'pending' ? null : { label: r.state === 'approved' ? 'Approved' : 'Denied', tone: r.state === 'approved' ? 'ok' : 'bad', by: r.decided ? `${r.decided.by}, ${r.decided.when.replace(/, \d{4},/, ',')}${r.decided.note ? `: "${r.decided.note}"` : ''}` : '' },
      href: null,
      card: r,
      request: null,
    }, r.canDecide ? v.personId : null, who.teamId, true)
  }

  // Time off, reimbursements and extra hours, with their cards (7C, 9C, 10D).
  for (const r of requests) {
    const { owner, teamId, request, ...row } = r
    push({ ...row, card: null, request }, owner, teamId, decidesRequest(v, row.type, row.personId))
  }

  const open = rows.filter(r => !r.done)
  const mine = (r: QueueRow) => !r.own && ownerOf.get(r.key) === v.personId
  // Admins and Super Admins: everything; a Team Leader: their teams; anyone else: what they decide.
  const isAdmin = v.level === 'super_admin' || v.level === 'admin'
  const inTeam = (r: QueueRow) => {
    if (isAdmin) return true
    if (isLead) { const t = teamOf.get(r.key); return t != null && leadTeams.has(t) }
    return decidesOf.get(r.key) === true
  }
  const byAsked = (a: QueueRow, b: QueueRow) => (a.askedAt < b.askedAt ? 1 : -1)
  return {
    level: v.level,
    subtitle: await subtitleFor(v, settings, dir),
    wait: open.filter(mine),
    others: open.filter(r => !mine(r) && inTeam(r)),
    done: rows.filter(r => r.done && inTeam(r)).sort(byAsked),
    note: "Hours go to the person each one reports to. Invoices go to Arnaldo Oliveira, or to Dave Sharpe for the people who report to him. When both land on the same person it is one step. The Deputy Director's timesheet is recorded without approval.",
  }
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function subtitleFor(v: Viewer, settings: InvoiceSettings, dir: Awaited<ReturnType<typeof loadDirectory>>): Promise<string> {
  if (v.isSuperAdmin) return 'Your decisions: hours of the people who report to you, invoices, time off, reimbursements and extra hours. "With others" shows, read only, what Team Leaders and Dave Sharpe still have.'
  if (v.level === 'team_leader') {
    const teams = [...v.ledTeamIds].map(id => dir.teams.get(id)?.name).filter(Boolean)
    const def = settings.defaultApprover ? dir.nameOf(settings.defaultApprover) : 'a Super Admin'
    return `Hours from the ${teams.join(' and ') || 'your'} team${teams.length > 1 ? 's' : ''}, and time corrections. Invoices are not shown to Team Leaders: ${def} finishes each timesheet after you.`
  }
  const mine = (must(await db().from('people').select('full_name').eq('manager_id', v.personId).eq('status', 'active').order('full_name'), 'People could not be read') ?? []).map(p => p.full_name)
  return mine.length
    ? `You approve the hours and invoices of the people who report to you (${mine.join(', ')}). Everything else is read only.`
    : 'You approve the hours and invoices of the people who report to you. Everything else is read only.'
}
