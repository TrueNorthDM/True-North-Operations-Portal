/**
 * Time off, reimbursements and extra hours in the Approvals queue (Clocky part
 * 2, Approvals.dc.html rows r6 to r9 and their cards 7C, 9C, 10D): the row, and
 * the card it opens with what the decider needs (the team calendar for time
 * off, the receipt for a reimbursement, the allowance for extra hours) and what
 * approving does by itself.
 *
 * Super Admins decide (time off with ck-timeoff, the rest with rq-decide);
 * never their own. Reimbursements are money: never shown to Team Leaders.
 *
 * Not a "use server" file: approval-queue.ts calls it.
 */

import type { Directory, Viewer } from './clocky-context'
import { db, loadCatalog } from './clocky-context'
import { dateLabel, dayLabel, initials, localDate, monthYear, timeLabel } from './format'
import { formatDuration } from './rounding'
import { loadAllowanceUse, loadApprovedExtra } from './allowance-data'
import { loadPayTerms, loadRoutes } from './pay-terms'
import { addDays } from './periods'
import { daysText, holidaysBetween, offDays } from './time-off'
import { usd } from './invoice-doc'
import { receiptsText, reportTitle, totalsText, type Amount } from './reimbursement-reports'

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
  receipt: { id: number; file: string; sub: string }
  state: string
  note: string | null
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
  cal: { label: string; days: string[]; rows: { name: string; sub: string; color: string; cells: ('req' | 'out' | 'hol' | null)[] }[] } | null
  after: string
  canDecide: boolean
  roText: string | null
  approveLabel: string
  denyLabel: string
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

export async function loadRequestRows(v: Viewer, dir: Directory, since: string, now = new Date()): Promise<CardRow[]> {
  const c = db()
  const isLead = v.level === 'team_leader'
  const decidesOff = v.can('ck-timeoff')
  const decides = v.can('rq-decide')
  const [{ data: offs }, { data: rmbs }, { data: xhs }, catalog] = await Promise.all([
    c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, hours_per_day, state, reason, requested_at, decided_by, decided_at, decision_note, rippling_state, cancel_asked_at, cancel_reason, cancelled_at, cancelled_by')
      .or(`state.eq.pending,cancel_asked_at.not.is.null,decided_at.gte.${since},cancelled_at.gte.${since}`).order('id'),
    isLead ? Promise.resolve({ data: [] }) : c.from('reimbursements').select('id, person_id, spent_on, category, purpose, amount, currency, client, billable, state, asked_at, decided_by, decided_at, decision_note, invoice_id, document_id, receipt_name, receipt_size, report_id')
      .or(`state.eq.pending,decided_at.gte.${since}`).order('id'),
    c.from('extra_hours_requests').select('id, person_id, asked_by, hours, period, period_start, period_end, client, reason, state, asked_at, decided_by, decided_at, decision_note')
      .or(`state.eq.pending,decided_at.gte.${since}`).order('id'),
    loadCatalog(),
  ])
  const person = (id: string) => {
    const p = dir.people.get(id)
    const t = p?.teamId ? dir.teams.get(p.teamId) : undefined
    return { name: p?.name ?? 'Someone', initials: initials(p?.name ?? ''), team: t ? { name: t.name, color: t.color } : null, teamId: p?.teamId ?? null }
  }
  const out: CardRow[] = []

  // ── Time off (7C), and approved time off its person asks to cancel ───────
  const offRows = offs ?? []
  if (offRows.length) {
    const lo = offRows.reduce((m, r) => (r.start_date < m ? r.start_date : m), '9999-12-31')
    const hi = offRows.reduce((m, r) => (r.end_date > m ? r.end_date : m), '0000-01-01')
    const holidays = holidaysBetween(addDays(lo, -7), addDays(hi, 7))
    const { data: approved } = await c.from('tc_absence_requests').select('person_id, start_date, end_date').eq('state', 'approved').lte('start_date', addDays(hi, 7)).gte('end_date', addDays(lo, -7))
    for (const r of offRows) {
      const who = person(r.person_id)
      const kind = catalog.jobs.get(r.jobcode_id)?.short ?? 'Time off'
      const { days } = offDays(r.start_date, r.end_date, holidays)
      const hpd = Number(r.hours_per_day)
      const seconds = Math.round(days.length * hpd * 3600)
      const cancelAsk = r.state === 'approved' && !!r.cancel_asked_at
      const pending = r.state === 'pending' || cancelAsk
      // The team calendar: the working week(s) around the request, the request, the team's time off, the holidays.
      const monday = addDays(r.start_date, -((new Date(`${r.start_date}T00:00:00Z`).getUTCDay() + 6) % 7))
      const lastDay = addDays(r.end_date, (5 - new Date(`${r.end_date}T00:00:00Z`).getUTCDay() + 7) % 7)
      const week: string[] = []
      for (let d = monday; d <= lastDay && week.length < 10; d = addDays(d, 1)) { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); if (w > 0 && w < 6) week.push(d) }
      const mates = (approved ?? []).filter(o => o.person_id !== r.person_id && dir.people.get(o.person_id)?.teamId === who.teamId && who.teamId && o.start_date <= week[week.length - 1] && o.end_date >= week[0])
      const hols = week.filter(d => holidays.has(d))
      const calRows: NonNullable<RequestCard['cal']>['rows'] = [
        { name: who.name, sub: 'This request', color: who.team?.color ?? '#9CA3AF', cells: week.map(d => (days.includes(d) ? 'req' : null)) },
        ...[...new Set(mates.map(m => m.person_id))].map(pid => {
          const mine = mates.filter(m => m.person_id === pid)
          return { name: dir.nameOf(pid), sub: `Out (approved)${who.team ? `, ${who.team.name}` : ''}`, color: '#A99BD4', cells: week.map(d => (mine.some(m => d >= m.start_date && d <= m.end_date) ? 'out' as const : null)) }
        }),
        ...[...new Set(hols.map(d => holidays.get(d)!))].map(name => ({ name, sub: 'Company holiday', color: '#e4e7ec', cells: week.map(d => (holidays.get(d) === name ? 'hol' as const : null)) })),
      ]
      const clash = mates.flatMap(m => days.filter(d => d >= m.start_date && d <= m.end_date).map(d => ({ who: dir.nameOf(m.person_id), d })))
      const own = r.person_id === v.personId
      const canDecide = pending && decidesOff && !own
      const label = daysText(r.start_date, r.end_date)
      const doneOf = (): CardRow['done'] => {
        if (pending) return null
        if (r.state === 'cancelled') return { label: 'Cancelled', tone: 'neu', by: `${dir.nameOf(r.cancelled_by)}, ${short(r.cancelled_at!, v.zone)}` }
        if (r.state === 'denied') return { label: 'Denied', tone: 'bad', by: `${dir.nameOf(r.decided_by)}, ${short(r.decided_at!, v.zone)}${r.decision_note ? `: "${r.decision_note}"` : ''}` }
        if (r.rippling_state === 'refused') return { label: 'Rippling refused it', tone: 'bad', by: `Approved by ${dir.nameOf(r.decided_by)}, ${short(r.decided_at!, v.zone)}. Open it to try again.` }
        return { label: 'Approved', tone: 'ok', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}.${r.rippling_state === 'sent' ? ' Sent to Rippling.' : ''}` }
      }
      out.push({
        key: `o${r.id}`, type: 'off', id: r.id, personId: r.person_id, ...who,
        main: `${kind} · ${formatDuration(seconds)}`, sub: label,
        flag: cancelAsk ? { text: 'Cancellation asked', tone: 'warn' } : clash.length ? { text: `${clash[0].who} is off ${dayLabel(clash[0].d)}`, tone: 'neu' } : null,
        why: cancelAsk ? (r.cancel_reason ? `"${r.cancel_reason}"` : null) : r.reason ? `"${r.reason}"` : null,
        asked: cancelAsk ? `Cancellation asked ${short(r.cancel_asked_at!, v.zone)}` : asked(r.requested_at, v.zone),
        askedAt: cancelAsk ? r.cancel_asked_at! : r.requested_at,
        ownerName: 'a Super Admin', owner: canDecide ? v.personId : null, own,
        done: doneOf(),
        href: !pending && r.rippling_state === 'refused' ? '/requests/time-off' : null,
        request: {
          kind: cancelAsk ? 'off-cancel' : 'off', id: r.id, type: 'Time off',
          title: cancelAsk ? `Cancel ${kind}, ${formatDuration(seconds)}` : `${kind}, ${formatDuration(seconds)}`,
          width: 720, twoCols: false, receipt: null,
          facts: [
            { k: 'Dates', v: `${label}, ${r.end_date.slice(0, 4)}` },
            { k: 'Counted', v: `${days.length} working day${days.length === 1 ? '' : 's'}, ${hpd}h a day, ${formatDuration(seconds)}` },
            { k: 'Balance in Rippling', v: `${kind}: the balance shows here once Rippling is connected.` },
            ...(cancelAsk ? [{ k: 'Why cancel', v: `"${r.cancel_reason ?? ''}"` }] : r.reason ? [{ k: 'Note', v: `"${r.reason}"` }] : []),
          ],
          allow: null,
          cal: { label: `Team calendar, ${week.length ? daysText(week[0], week[week.length - 1]).replace(/^[A-Z][a-z]{2}, /, '').replace(/ to [A-Z][a-z]{2}, /, ' to ') : label}`, days: week.map(d => dayLabel(d).replace(/^([A-Z][a-z]{2}), [A-Z][a-z]{2} (\d+)$/, '$1 $2')), rows: calRows },
          after: cancelAsk
            ? `Approving the cancellation takes ${formatDuration(seconds)} of ${kind} off ${who.name.split(' ')[0]}'s time entries, and off Rippling and the team calendar where it went. Keep it, with a reason, and it stays.`
            : `On approval, by itself: Rippling gets ${formatDuration(seconds)} of ${kind}, the team calendar gets "${who.name}, out" on ${label}, and North Time writes ${hpd}h a day into their time entries.`,
          canDecide,
          roText: canDecide ? null : own ? 'Your own request. A Super Admin decides it.' : pending ? 'Read only. Only Super Admins decide time off, reimbursements and extra hours.' : null,
          approveLabel: cancelAsk ? 'Approve cancellation' : 'Approve', denyLabel: cancelAsk ? 'Keep it' : 'Deny',
        },
      })
    }
  }

  // ── Reimbursements (9C) ──────────────────────────────────────────────────
  type Rmb = { id: number; person_id: string; spent_on: string; category: string; purpose: string; amount: number; currency: string; client: string | null; billable: boolean; state: string; asked_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; invoice_id: number | null; document_id: number | null; receipt_name: string | null; receipt_size: number | null; report_id: number | null }
  const rmbRows = (rmbs ?? []) as Rmb[]
  if (rmbRows.length) {
    const routes = await loadRoutes([...new Set(rmbRows.map(r => r.person_id))])
    const reportIds = [...new Set(rmbRows.map(r => r.report_id).filter((x): x is number => x != null))]
    const [{ data: openDocs }, { data: reports }] = await Promise.all([
      c.from('reimbursement_documents').select('id, number, person_id, total').eq('state', 'approved'),
      reportIds.length ? c.from('reimbursement_reports').select('id, name').in('id', reportIds) : Promise.resolve({ data: [] as { id: number; name: string | null }[] }),
    ])
    const amountOf = (r: Rmb) => (r.currency === 'USD' ? usd(Number(r.amount)) : `${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency}`)
    const sizeOf = (n: number | null) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '')
    const receiptOf = (r: Rmb) => ({ id: r.id, file: r.receipt_name ?? 'receipt', sub: `${(r.receipt_name ?? '').toLowerCase().endsWith('.pdf') ? 'PDF' : 'Photo'}${sizeOf(r.receipt_size) ? `, ${sizeOf(r.receipt_size)}` : ''}` })

    // A request with several receipts (migration 122): one row, each receipt decided on its own.
    const byReport = new Map<number, Rmb[]>()
    for (const r of rmbRows) if (r.report_id != null) byReport.set(r.report_id, [...(byReport.get(r.report_id) ?? []), r])
    for (const [reportId, list] of byReport) {
      const r0 = list[0]
      const who = person(r0.person_id)
      const contractor = !!routes.get(r0.person_id)?.isContractor
      const name = (reports ?? []).find(x => x.id === reportId)?.name ?? null
      const own = r0.person_id === v.personId
      const waiting = list.filter(r => r.state === 'pending')
      const pending = waiting.length > 0
      const canDecide = pending && decides && !own
      const doc = (openDocs ?? []).find(d => d.person_id === r0.person_id)
      const values = list.map(r => ({ amount: Number(r.amount), currency: r.currency }))
      const total = totalsText(values)
      const denied = list.filter(r => r.state === 'denied').length, approved = list.length - waiting.length - denied
      const decided = list.filter(r => r.decided_at).sort((a, b) => b.decided_at!.localeCompare(a.decided_at!))[0]
      const clients = [...new Set(list.map(r => r.client).filter((x): x is string => !!x))]
      const purposes = list.map(r => r.purpose)
      out.push({
        key: `rr${reportId}`, type: 'rmb', id: reportId, personId: r0.person_id, ...who,
        main: `${name ?? 'Several receipts'} · ${total}`, sub: `${receiptsText(list.length)}: ${purposes.slice(0, 3).join(', ')}${purposes.length > 3 ? ', …' : ''}`, flag: null,
        why: contractor ? 'Contractor: each receipt goes on their next invoice.' : 'Employee: they go on a reimbursement document for Finance.',
        asked: asked(r0.asked_at, v.zone), askedAt: r0.asked_at,
        ownerName: 'a Super Admin', owner: canDecide ? v.personId : null, own,
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
          })),
          facts: [{ k: 'Client or project', v: clients.length ? clients.join(', ') : 'None, not billable to a client' }],
          allow: null, cal: null,
          after: contractor
            ? `${who.name} is a contractor. Each receipt you approve goes on their next invoice by itself, as its own line.`
            : `${who.name} is an employee. The receipts you approve go on ${doc ? `reimbursement document ${doc.number}` : 'a new reimbursement document'} for Finance to pay, each as its own line${doc ? `, with the items already on it (${usd(Number(doc.total))})` : ''}.`,
          canDecide, roText: canDecide ? null : own ? 'Your own request. A Super Admin decides it.' : pending ? 'Read only. Only Super Admins decide time off, reimbursements and extra hours.' : null,
          approveLabel: waiting.length > 1 ? `Approve all ${waiting.length}` : 'Approve', denyLabel: waiting.length > 1 ? 'Deny all' : 'Deny',
        },
      })
    }

    for (const r of rmbRows.filter(x => x.report_id == null)) {
      const who = person(r.person_id)
      const contractor = !!routes.get(r.person_id)?.isContractor
      const amt = r.currency === 'USD' ? usd(Number(r.amount)) : `${Number(r.amount).toFixed(2)} ${r.currency}`
      const own = r.person_id === v.personId
      const pending = r.state === 'pending'
      const canDecide = pending && decides && !own
      const doc = (openDocs ?? []).find(d => d.person_id === r.person_id)
      const isPdf = (r.receipt_name ?? '').toLowerCase().endsWith('.pdf')
      const size = r.receipt_size ? (r.receipt_size >= 1048576 ? `${(r.receipt_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(r.receipt_size / 1024))} KB`) : ''
      out.push({
        key: `r${r.id}`, type: 'rmb', id: r.id, personId: r.person_id, ...who,
        main: `${r.category} · ${amt}`, sub: r.purpose, flag: null,
        why: contractor ? 'Contractor: goes on their next invoice.' : 'Employee: goes on a reimbursement document for Finance.',
        asked: asked(r.asked_at, v.zone), askedAt: r.asked_at,
        ownerName: 'a Super Admin', owner: canDecide ? v.personId : null, own,
        done: pending ? null : r.state === 'denied'
          ? { label: 'Denied', tone: 'bad', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}${r.decision_note ? `: "${r.decision_note}"` : ''}` }
          : { label: 'Approved', tone: 'ok', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}` },
        href: null,
        request: {
          kind: 'rmb', id: r.id, type: 'Reimbursement', title: `${r.category}, ${amt}`, width: 760, twoCols: true,
          receipt: { id: r.id, file: r.receipt_name ?? 'receipt', sub: `${isPdf ? 'PDF' : 'Photo'}${size ? `, ${size}` : ''}` },
          facts: [
            { k: 'Date of the expense', v: `${dayLabel(r.spent_on)}, ${r.spent_on.slice(0, 4)}` },
            { k: 'Amount', v: `${amt} (${r.currency})` },
            { k: 'What it was for', v: r.purpose },
            { k: 'Client or project', v: r.client ? `${r.client}, ${r.billable ? 'billable' : 'not billable'} to the client` : 'None, not billable to a client' },
          ],
          allow: null, cal: null,
          after: contractor
            ? `${who.name} is a contractor. Approving puts it on their next invoice by itself.`
            : `${who.name} is an employee. Approving puts it on ${doc ? `reimbursement document ${doc.number}` : 'a new reimbursement document'} for Finance to pay${doc ? `, with the items already on it (${usd(Number(doc.total))})` : ''}.`,
          canDecide, roText: canDecide ? null : own ? 'Your own request. A Super Admin decides it.' : pending ? 'Read only. Only Super Admins decide time off, reimbursements and extra hours.' : null,
          approveLabel: 'Approve', denyLabel: 'Deny',
        },
      })
    }
  }

  // ── Extra hours (10D) ────────────────────────────────────────────────────
  const xhRows = xhs ?? []
  if (xhRows.length) {
    const ids = [...new Set(xhRows.map(r => r.person_id))]
    const terms = await loadPayTerms(ids)
    const use = await loadAllowanceUse(terms, now, await loadApprovedExtra(ids, addDays(localDate(now, v.zone), -40), addDays(localDate(now, v.zone), 40)))
    for (const r of xhRows) {
      const who = person(r.person_id)
      if (isLead && !(who.teamId && v.ledTeamIds.has(who.teamId)) && r.person_id !== v.personId) continue
      const own = r.person_id === v.personId
      const pending = r.state === 'pending'
      const canDecide = pending && decides && !own
      const hours = formatDuration(Number(r.hours) * 3600)
      const when = r.period === 'month' ? monthYear(r.period_start) : `the week of ${dayLabel(r.period_start)}`
      const t = terms.get(r.person_id)
      const u = use.get(r.person_id)
      const cap = t?.allowance?.hours
      out.push({
        key: `x${r.id}`, type: 'xh', id: r.id, personId: r.person_id, ...who,
        main: `Extra hours · ${hours}`, sub: `${r.period === 'month' ? monthYear(r.period_start) : `Week of ${dayLabel(r.period_start)}`}${r.client ? ` · ${r.client}` : ''}`,
        flag: null, why: `"${r.reason}"`, asked: `${asked(r.asked_at, v.zone)}${r.asked_by && r.asked_by !== r.person_id ? ` by ${dir.nameOf(r.asked_by)}` : ''}`, askedAt: r.asked_at,
        ownerName: 'a Super Admin', owner: canDecide ? v.personId : null, own,
        done: pending ? null : { label: r.state === 'approved' ? 'Approved' : 'Denied', tone: r.state === 'approved' ? 'ok' : 'bad', by: `${dir.nameOf(r.decided_by)}, ${dateLabel(localDate(r.decided_at!, v.zone)).replace(/, \d{4}$/, '')}${r.state === 'denied' && r.decision_note ? `: "${r.decision_note}"` : ''}` },
        href: null,
        request: {
          kind: 'xh', id: r.id, type: 'Extra hours', title: `${hours} in ${r.period === 'month' ? monthYear(r.period_start).split(' ')[0] : when}`, width: 620, twoCols: false, receipt: null,
          facts: [{ k: 'When', v: r.period === 'month' ? monthYear(r.period_start) : `Week of ${dayLabel(r.period_start)}` }, { k: 'Client or project', v: r.client ?? 'None' }, { k: 'Why', v: `"${r.reason}"` }],
          allow: t?.allowance ? `Allowance: ${t.allowance.hours}h a ${t.allowance.period}.${u ? ` ${u.period === 'month' ? monthYear(u.from).split(' ')[0] : 'This week'} so far: ${formatDuration(u.used)}.${u.over ? ` ${formatDuration(u.over)} over without approval.` : ''}` : ''}` : 'No allowance set: the hours are never flagged as over.',
          cal: null,
          after: cap != null && t?.allowance?.period === r.period
            ? `Approved, their ${when} allowance becomes ${cap + Number(r.hours)}h. Hours past that are flagged again, in the clock panel, Who's working and this queue.`
            : 'Approved, these hours are added to the allowance of that period. Hours past it are flagged again.',
          canDecide, roText: canDecide ? null : own ? 'Your own request. A Super Admin decides it.' : pending ? 'Read only. Only Super Admins decide time off, reimbursements and extra hours.' : null,
          approveLabel: 'Approve', denyLabel: 'Deny',
        },
      })
    }
  }
  return out
}
