/**
 * The rows of Home's tabs card (design_handoff_home, README "3. Needs you /
 * My Work / Requests", 25 October 2026), each kind read from the source its
 * own page reads, behind the same gate:
 *
 *   System      healthSummary of latestHealth, as SystemHealthBanner and the
 *               Automations header roll it up; home-health and automations
 *               (each row leads to Automations)
 *   Access      people invited and not signed in yet, as Directory > Portal
 *               access tells them apart (portalAccessState); d-portal, and
 *               d-invite to send it again
 *   Approvals   "Waiting for you" of Approvals (approval-queue.ts loadQueue):
 *               timesheets, fixed invoices and time corrections whose step is
 *               the viewer's; clocky-approvals. A Team Leader's rows never
 *               carry an amount (the queue gives them "Hours only")
 *   Requests    time off, reimbursements and extra hours waiting for the
 *   to decide   viewer's decision (request-cards.ts, the rows Approvals lists);
 *               ck-timeoff and rq-decide
 *   Invoices    the fixed-pay invoices the 1st makes by itself and sends to
 *               the viewer (invoices-cron.ts), in the week before; informs only
 *   To pay      Super Admins, Admins and Finance (pay-terms.ts paysWhat): one line for the approved invoices
 *               (clocky-invoices) and every reimbursement document waiting
 *               (rq-reimbursements), by due day; Mark paid runs the pages'
 *               own markInvoicePaid and markRmbPaid
 *   My Work     the person's own My Work list, due within 7 days or late, by
 *               date; New York's day, as My Work works it out; my-work
 *   Requests    what the person asked for and where it is: time off,
 *   (theirs)    reimbursements, extra hours, time corrections, timesheets
 *               (clocky-hours) and invoices (clocky-invoices, as the
 *               Invoices page); each row's button opens its page
 *
 * The timesheet is never a row: the Pay period card owns it.
 *
 * Each kind reads on its own: one that fails is one line in its tab, never an
 * empty list that reads as nothing waiting; a line names the page to try
 * again on only when the person can open it, and links there. A login linked
 * to nobody in the Directory skips the kinds that need the person and says so
 * once. Rendering access (loadAccess), so
 * a View Stage preview shows the level it previews; the panel's buttons call
 * the pages' own actions, which refuse to write during a preview.
 */

import { loadAccess, type Access } from '@/lib/access/resolve'
import { portalAccessState } from '@/lib/auth/portal-rule'
import { latestHealth } from '@/lib/health/checks'
import { healthSummary } from '@/lib/health/summary'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { matchesDue, todayIso, WORK_ZONE } from '@/lib/monday/worklist/list-view'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadQueue, type QueueRow } from '@/lib/timeclock/approval-queue'
import { loadApprovers } from '@/lib/timeclock/approvers'
import { db, loadDirectory, viewerFor, type Directory, type Viewer } from '@/lib/timeclock/clocky-context'
import { goesToLabel, teamLeadNames } from '@/lib/timeclock/clocky-requests'
import { dateLabel, dayLabel, localDate, rangeLabel, stampLabel } from '@/lib/timeclock/format'
import { moneyTotal, usd } from '@/lib/timeclock/invoice-doc'
import { loadInvoiceSettings, loadPayTerms, loadRouteSettings, loadRoutes, paysWhat } from '@/lib/timeclock/pay-terms'
import { totalsText } from '@/lib/timeclock/reimbursement-reports'
import { loadRequestRows, type CardRow } from '@/lib/timeclock/request-cards'
import { formatDuration } from '@/lib/timeclock/rounding'
import { currentStep, invoiceApprover, type TimesheetState } from '@/lib/timeclock/routing'
import { periodLabel } from '@/lib/timeclock/periods'
import { byDue, dueOnDay, dueSince, dueToday, documentsToPayRow, invoicesToPayRow, ownTimeOffShown, timesheetRow, uniqueErrors, type HomeRow, type HomeTab, type NeedsYouData, type Panel, type TabError } from './needs-you-model'

const APPROVALS = '/clocky-hours/approvals'
const AUTOMATIONS = '/admin/automations'
const MY_WORK = '/my-work'
const TIME_ENTRIES = '/clocky-hours'
const INVOICES = '/clocky-hours/invoices'
/** Your own requests stay on the list this long after they are decided. */
const DONE_DAYS = 30

type Part = { rows: HomeRow[]; error?: TabError }

/** Said once in Needs you, instead of a failed line for every kind that needs the person. */
const NOT_LINKED = 'Your login is not linked to anyone in the Directory.'

/** "Fri, Oct 30" without the weekday, "Oct 30". */
const monthDay = (iso: string) => dateLabel(iso).replace(/, \d{4}$/, '')
const afterDot = (s: string) => (s.includes(' · ') ? s.slice(s.indexOf(' · ') + 3) : s)
const beforeDot = (s: string) => (s.includes(' · ') ? s.slice(0, s.indexOf(' · ')) : s)
const andList = (xs: readonly string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n

export async function loadNeedsYou(now: Date = new Date()): Promise<NeedsYouData> {
  const access = await loadAccess()
  // A read that failed is not a login linked to nobody: the first fails each kind that
  // needs the person, the second skips them and says so once (audit, 25 October 2026).
  let viewerFailed = false
  // Who is Finance (Company settings > Invoices). Unread, nobody gets To pay rows this
  // time and the log says why: a line about paying would reach people who never pay.
  const [v, settings] = await Promise.all([
    viewerFor(access).catch(e => { console.error('[home] needs you, viewer:', (e as Error).message); viewerFailed = true; return null }),
    loadInvoiceSettings().catch(e => { console.error('[home] needs you, invoice settings:', (e as Error).message); return null }),
  ])
  const pays = settings ? paysWhat(access, settings) : { invoices: false, documents: false }
  const unlinked = !v && !viewerFailed
  const zone = v?.zone ?? WORK_ZONE
  const today = localDate(now, zone)

  const read = async (what: string, error: TabError, on: boolean, f: () => Promise<HomeRow[]>): Promise<Part> => {
    if (!on) return { rows: [] }
    try {
      return { rows: await f() }
    } catch (e) {
      console.error(`[home] needs you, ${what}:`, e instanceof Error ? e.message : e)
      return { rows: [], error }
    }
  }
  // A kind that needs the person: skipped for a login linked to nobody.
  const needsViewer = (on: boolean) => on && !unlinked
  const withViewer = (f: (v: Viewer) => Promise<HomeRow[]>) => () => (v ? f(v) : Promise.reject(new Error('the viewer could not be read')))
  // "Open Approvals to try again", as a link, only for who can open Approvals.
  const retry = (text: string, page: string, href: string, can: boolean): TabError => (can ? { text: `${text} Open ${page} to try again.`, href } : { text })

  const decides = access.can('ck-timeoff') || access.can('rq-decide')
  const approvalsOpen = access.can('clocky-approvals')
  const viewerKinds = [approvalsOpen, decides, access.can('my-work'), access.can('rq-time-off'), access.can('rq-reimbursements'), access.can('rq-extra-hours'), access.can('clocky-hours'), access.can('clocky-invoices')]
  const [system, invites, approvals, decisions, invoices, payInv, payDocs, work, ...mine] = await Promise.all([
    // Every System row leads to Automations: no rows for who cannot open it (audit, 25 October 2026).
    read('system', { text: 'System health could not be read just now. Open Automations to see it.', href: AUTOMATIONS }, access.can('home-health') && access.can('automations'), () => systemRows(access, zone, now)),
    read('access', { text: 'Invitations could not be read just now.' }, access.can('d-portal'), () => accessRows(access, zone, today)),
    read('approvals', retry('Approvals could not be read just now.', 'Approvals', APPROVALS, approvalsOpen), needsViewer(approvalsOpen), withViewer(x => approvalRows(x, today, now))),
    read('requests to decide', retry('Requests to decide could not be read just now.', 'Approvals', APPROVALS, approvalsOpen), needsViewer(decides), withViewer(x => decisionRows(x, today, now))),
    read('fixed invoices', { text: 'The fixed-pay invoices of the 1st could not be read just now.' }, needsViewer(approvalsOpen), withViewer(x => invoiceRows(x, today, now))),
    read('invoices to pay', retry('Invoices to pay could not be read just now.', 'Invoices', INVOICES, true), pays.invoices, () => payInvoices(today)),
    read('documents to pay', { text: 'Reimbursement documents to pay could not be read just now.' }, pays.documents, () => payDocuments(zone, today)),
    read('my work', retry('My Work could not be read just now.', 'My Work', MY_WORK, true), needsViewer(access.can('my-work')), withViewer(x => workRows(x, now))),
    read('own time off', { text: 'Your time off could not be read just now.' }, needsViewer(access.can('rq-time-off')), withViewer(x => myTimeOff(x, now))),
    read('own reimbursements', { text: 'Your reimbursements could not be read just now.' }, needsViewer(access.can('rq-reimbursements')), withViewer(x => myReimbursements(x, now))),
    read('own extra hours', { text: 'Your extra hours could not be read just now.' }, needsViewer(access.can('rq-extra-hours')), withViewer(x => myExtraHours(x, now))),
    read('own corrections', { text: 'Your time corrections could not be read just now.' }, needsViewer(access.can('clocky-hours')), withViewer(x => myCorrections(x, now))),
    // Your own timesheet and invoice, where each is (owner, 25 October 2026, as the prototype's Requests tab).
    read('own timesheets', { text: 'Your timesheets could not be read just now.' }, needsViewer(access.can('clocky-hours')), withViewer(x => myTimesheets(x, now))),
    // The Invoices page's own gate, not Time entries' (audit, 25 October 2026).
    read('own invoices', { text: 'Your invoices could not be read just now.' }, needsViewer(access.can('clocky-invoices')), withViewer(x => myInvoices(x, now))),
  ])

  const tab = (parts: Part[], sort?: (a: HomeRow, b: HomeRow) => number, extra: TabError[] = []): HomeTab => {
    const rows = parts.flatMap(p => p.rows)
    return { rows: sort ? rows.sort(sort) : rows, errors: uniqueErrors([...extra, ...parts.map(p => p.error)]) }
  }
  return {
    needs: tab([system, invites, approvals, decisions, invoices, payInv, payDocs], byDue, unlinked && viewerKinds.some(Boolean) ? [{ text: NOT_LINKED }] : []),
    work: access.can('my-work') ? tab([work]) : null,
    // Waiting first, then done; each kind already newest first.
    mine: (() => {
      const t = tab(mine)
      return { ...t, rows: [...t.rows.filter(r => r.mine?.state === 'wait'), ...t.rows.filter(r => r.mine?.state !== 'wait')] }
    })(),
    today,
  }
}

// ── System ──────────────────────────────────────────────────────────────────

async function systemRows(access: Access, zone: string, now: Date): Promise<HomeRow[]> {
  const c = createAdminClient()
  const { results, readError } = await latestHealth(c)
  if (readError) throw new Error(readError)
  const summary = healthSummary(results, now)
  if (summary.status === 'ok') return []

  // When each problem began: the oldest failing result since its last good one.
  // Read beside the summary; unread, a row says when it was last checked instead.
  const began = new Map<string, string>()
  const services = summary.problems.map(p => p.service).filter(s => s in results)
  if (services.length) {
    const { data, error } = await c.from('system_health_checks').select('service, status, checked_at')
      .in('service', services).order('checked_at', { ascending: false }).limit(500)
    if (!error) {
      const closed = new Set<string>()
      for (const r of (data ?? []) as { service: string; status: string; checked_at: string }[]) {
        if (closed.has(r.service)) continue
        if (r.status === 'ok') closed.add(r.service)
        else began.set(r.service, r.checked_at)
      }
    }
  }
  const canRun = access.can('au-run')
  return summary.problems.map(p => {
    const stale = p.service === 'health_runs'
    const checked = stale ? summary.lastChecked : results[p.service]?.checked_at ?? null
    const since = began.get(p.service) ?? checked ?? now.toISOString()
    const title = stale ? 'Health checks have not run' : p.status === 'down' ? `${p.label} is down` : `${p.label} has a warning`
    const panel: Panel = {
      title,
      sub: p.detail,
      facts: [
        { k: 'Service', v: p.label },
        { k: 'Status', v: p.status === 'down' ? 'Down' : 'Warning' },
        { k: 'Since', v: stampLabel(since, zone) },
        ...(checked ? [{ k: 'Last checked', v: stampLabel(checked, zone) }] : []),
        { k: 'Checks', v: 'Every four hours' },
      ],
      note: null,
      link: { label: 'Open Automations', href: AUTOMATIONS },
      primary: canRun ? { label: 'Run checks now', op: { do: 'run-checks' }, icon: 'arrow' } : { label: 'Open Automations', href: AUTOMATIONS, icon: 'arrow' },
      secondary: { label: 'Close' },
    }
    return { key: `s-${p.service}`, kind: 'system', title, sub: p.detail, due: dueSince(since, zone, now), button: 'Open Automations', panel }
  })
}

// ── Access ──────────────────────────────────────────────────────────────────

async function accessRows(access: Access, zone: string, today: string): Promise<HomeRow[]> {
  const c = createAdminClient()
  const [{ data, error }, dir] = await Promise.all([
    c.from('people').select('id, full_name, status, email_goodnews, portal_invited_at, profile_id, access_level').not('portal_invited_at', 'is', null).is('profile_id', null).order('portal_invited_at'),
    loadDirectory(),
  ])
  if (error) throw new Error(error.message)
  const canInvite = access.can('d-invite')
  type P = { id: string; full_name: string; status: string | null; email_goodnews: string | null; portal_invited_at: string | null; profile_id: string | null; access_level: string | null }
  return ((data ?? []) as P[])
    .filter(p => portalAccessState({ status: p.status, email_goodnews: p.email_goodnews, portal_invited_at: p.portal_invited_at, hasAccount: !!p.profile_id }) === 'invited')
    .map(p => {
      const person = dir.people.get(p.id)
      const team = person?.teamId ? dir.teams.get(person.teamId)?.name ?? null : null
      const level = p.access_level === 'super_admin' ? 'Super Admin' : p.access_level === 'admin' ? 'Admin' : dir.led.has(p.id) ? 'Team Leader' : 'User'
      const sent = dayLabel(localDate(p.portal_invited_at!, zone))
      const email = (p.email_goodnews ?? '').trim().toLowerCase()
      const title = `${p.full_name} has not accepted the invitation`
      const sub = `Sent ${sent}. Access level: ${level}.`
      const directory = '/directory?tab=portal'
      const panel: Panel = {
        title, sub,
        facts: [
          { k: 'Person', v: p.full_name },
          ...(team ? [{ k: 'Team', v: team }] : []),
          { k: 'Access level', v: level },
          { k: 'Sent', v: sent },
          { k: 'Signs in with', v: email },
        ],
        // invitePerson (admin/people/actions.ts): the email carries no token.
        note: 'The invitation never expires: its button opens the sign-in page with the address filled in.',
        link: { label: 'Open in Directory', href: directory },
        primary: canInvite ? { label: 'Resend invitation', op: { do: 'resend-invite', id: p.id }, icon: 'arrow' } : { label: 'Open in Directory', href: directory, icon: 'arrow' },
        secondary: { label: 'Copy link', copy: `/login?email=${encodeURIComponent(email)}` },
      }
      return { key: `a-${p.id}`, kind: 'access' as const, title, sub, due: dueToday(today), button: canInvite ? 'Resend' : 'Open', panel }
    })
}

// ── Approvals: timesheets, fixed invoices, time corrections ─────────────────

async function approvalRows(v: Viewer, today: string, now: Date): Promise<HomeRow[]> {
  const q = await loadQueue(v, now, { waitingOnly: true, requests: false })
  const isLead = v.level === 'team_leader'
  // timesheetRow is pure (needs-you-model.ts), so its labels and facts are tested.
  return q.wait.filter(r => r.type === 'ts' || r.type === 'cor').map(r => (r.type === 'ts' ? timesheetRow(r, isLead, today, APPROVALS) : correctionRow(r, today)))
}

function correctionRow(r: QueueRow, today: string): HomeRow {
  const hours = afterDot(r.main)
  const title = `${r.name}, time correction`
  const sub = `${hours} · ${r.sub}`
  const card = r.card
  const panel: Panel = {
    title, sub,
    facts: [
      ...(card ? [{ k: 'When', v: card.when }, { k: 'Job', v: card.job }] : []),
      { k: 'Time', v: hours },
      ...(r.asked ? [{ k: 'Asked', v: r.asked.replace(/^Asked /, '') }] : []),
    ],
    note: card?.overlap ?? r.why,
    link: { label: 'Open in Approvals', href: APPROVALS },
    primary: { label: 'Approve', op: { do: 'correction', id: r.id, decision: 'approve' }, icon: 'check' },
    secondary: { label: 'Decline', op: { do: 'correction', id: r.id, decision: 'deny' }, needsReason: true },
  }
  return { key: `q-${r.key}`, kind: 'approval', title, sub, due: dueToday(today), button: 'Decide', panel }
}

// ── Requests to decide: time off, reimbursements, extra hours ───────────────

async function decisionRows(v: Viewer, today: string, now: Date): Promise<HomeRow[]> {
  const [dir, settings] = await Promise.all([loadDirectory(), loadRouteSettings()])
  // "Waiting for you" of Approvals for these kinds: theirs to decide, never their own.
  const rows = (await loadRequestRows(v, dir, now.toISOString(), settings, now)).filter(r => !r.done && !r.own && r.owner === v.personId)
  return rows.map(r => decisionRow(r, today))
}

const declineLabel = (l: string) => (l === 'Deny' ? 'Decline' : l === 'Deny all' ? 'Decline all' : l)

function decisionRow(r: CardRow, today: string): HomeRow {
  const card = r.request
  const amount = afterDot(r.main)
  let title: string, sub: string
  if (card.kind === 'off' || card.kind === 'off-cancel') {
    title = `${card.kind === 'off-cancel' ? 'Time off cancellation' : 'Time off'}: ${r.name}`
    const counted = card.facts.find(f => f.k === 'Counted')?.v.split(',')[0]
    sub = `${beforeDot(r.main)}, ${r.sub}.${counted ? ` ${counted}.` : ''}`
  } else if (card.kind === 'xh') {
    title = `Extra hours: ${r.name}`
    sub = `${amount}, ${r.sub}.${r.why ? ` ${r.why}` : ''}`
  } else {
    title = `Reimbursement: ${r.name}`
    sub = `${amount}, ${r.sub}.${r.why ? ` ${r.why}` : ''}`
  }
  const decide = (decision: 'approve' | 'deny') => {
    switch (card.kind) {
      case 'off': case 'off-cancel': return { do: 'time-off' as const, id: card.id, decision, cancel: card.kind === 'off-cancel' }
      case 'xh': return { do: 'extra-hours' as const, id: card.id, decision }
      case 'rmb': return { do: 'reimbursement' as const, id: card.id, decision }
      case 'rmb-report': return { do: 'reimbursement-report' as const, id: card.id, ids: (card.items ?? []).filter(i => i.state === 'pending').map(i => i.id), decision }
    }
  }
  const panel: Panel = {
    title, sub,
    facts: [
      ...card.facts,
      ...(card.items ?? []).filter(i => i.state === 'pending').map(i => ({ k: `${i.date}, ${i.category}`, v: i.amount })),
      ...(card.allow ? [{ k: 'Allowance', v: card.allow }] : []),
    ],
    note: card.after,
    link: { label: 'Open in Approvals', href: APPROVALS },
    primary: { label: card.approveLabel, op: decide('approve'), icon: 'check' },
    secondary: { label: declineLabel(card.denyLabel), op: decide('deny'), needsReason: true },
  }
  return { key: `d-${r.key}`, kind: 'request', title, sub, due: dueToday(today), button: 'Decide', panel }
}

// ── Invoices: the fixed-pay invoices of the 1st ─────────────────────────────

/** The 1st is New York's (invoices-cron.ts). */
const CRON_ZONE = 'America/New_York'

async function invoiceRows(v: Viewer, today: string, now: Date): Promise<HomeRow[]> {
  const ny = localDate(now, CRON_ZONE)
  const [y, m, d] = ny.split('-').map(Number)
  const first = d === 1 ? ny : new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  // The week before: the same window My Work's rows use.
  if ((Date.parse(`${first}T00:00:00Z`) - Date.parse(`${ny}T00:00:00Z`)) / 86_400_000 > 7) return []
  const [fy, fm] = first.split('-').map(Number)
  const start = new Date(Date.UTC(fy, fm - 2, 1)).toISOString().slice(0, 10)
  const c = createAdminClient()
  const { data: people, error } = await c.from('people').select('id, full_name, status').eq('employment_type', 'contractor')
  if (error) throw new Error(error.message)
  const active = (people ?? []).filter(p => (!p.status || p.status === 'active') && p.id !== v.personId)
  const [terms, settings] = await Promise.all([loadPayTerms(active.map(p => p.id)), loadRouteSettings()])
  // As runFixedInvoices picks them, and only those whose invoice comes to this viewer.
  const fixed = active.filter(p => {
    const t = terms.get(p.id)
    return t?.paysAs === 'fixed_no_timesheet' && !!t.fixedAmount && t.fixedAmount > 0 && invoiceApprover(t.route, settings) === v.personId
  })
  if (!fixed.length) return []
  const { data: had, error: hErr } = await c.from('invoices').select('person_id').eq('kind', 'fixed_no_timesheet').eq('period_start', start).in('person_id', fixed.map(p => p.id))
  if (hErr) throw new Error(hErr.message)
  const made = new Set((had ?? []).map(r => r.person_id))
  const coming = fixed.filter(p => !made.has(p.id))
  if (!coming.length) return []
  const n = coming.length
  return [{
    key: `i-${first}`, kind: 'invoices',
    title: `${n} fixed-pay invoice${n === 1 ? ' is' : 's are'} created ${monthDay(first)}`,
    sub: `${andList(coming.map(p => firstName(p.full_name)))}. ${n === 1 ? 'It comes' : 'They come'} straight to you.`,
    due: dueOnDay(first, today), button: null, panel: null,
  }]
}

// ── To pay: Finance's invoices and reimbursement documents ──────────────────

/** Every approved invoice, not paid yet (the ones the Invoices page offers Mark paid on), as one line. */
async function payInvoices(today: string): Promise<HomeRow[]> {
  const { data, error } = await db().from('invoices').select('total, due_on').eq('state', 'approved').limit(1000)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { total: number; due_on: string }[]
  return [invoicesToPayRow(rows.map(r => ({ amount: Number(r.total), dueOn: r.due_on })), today, usd)].filter((r): r is HomeRow => !!r)
}

/** Every reimbursement document waiting to be paid, as one line; its total as the document pages add currencies. */
async function payDocuments(zone: string, today: string): Promise<HomeRow[]> {
  const c = db()
  const { data, error } = await c.from('reimbursement_documents').select('id, created_at').eq('state', 'approved').limit(1000)
  if (error) throw new Error(error.message)
  const docs = (data ?? []) as { id: number; created_at: string }[]
  if (!docs.length) return []
  const { data: items, error: iErr } = await c.from('reimbursements').select('amount, currency').in('document_id', docs.map(d => d.id))
  if (iErr) throw new Error(iErr.message)
  const total = moneyTotal(((items ?? []) as { amount: number; currency: string }[]).map(i => ({ amount: Number(i.amount), currency: i.currency })))
  return [documentsToPayRow(docs.map(d => ({ createdOn: localDate(d.created_at, zone) })), total, today)].filter((r): r is HomeRow => !!r)
}

// ── My Work ─────────────────────────────────────────────────────────────────

async function workRows(v: Viewer, now: Date): Promise<HomeRow[]> {
  const list = await loadWorklist(createAdminClient(), { personId: v.personId, openOnly: true })
  // My Work's own "today": New York's day (list-view.ts).
  const today = todayIso(now)
  return list.rows
    .filter(r => matchesDue(r, 'late', today) || matchesDue(r, 'week', today))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.itemName.localeCompare(b.itemName))
    .map(r => {
      const sub = `My Work · ${r.boardName}`
      const panel: Panel = {
        title: r.itemName, sub,
        facts: [
          { k: 'Board', v: r.boardName },
          ...(r.parentItemName ? [{ k: 'Item', v: r.parentItemName }] : []),
          { k: 'Step', v: r.stepName },
          { k: 'Status', v: r.statusText ?? 'No status' },
          { k: r.dueLabel ?? 'Due', v: dayLabel(r.dueDate!) },
        ],
        note: null,
        link: { label: 'Open in My Work', href: MY_WORK },
        // Steps are finished in Monday: My Work has no action that marks one done.
        primary: r.url ? { label: 'Open in Monday', href: r.url, external: true, icon: 'arrow' } : { label: 'Open My Work', href: MY_WORK, icon: 'arrow' },
        secondary: { label: 'Close' },
      }
      return { key: `w-${r.id}`, kind: 'work' as const, title: r.itemName, sub, due: dueOnDay(r.dueDate!, today), button: 'Open', panel }
    })
}

// ── What the person asked for ───────────────────────────────────────────────

const sinceIso = (now: Date) => new Date(now.getTime() - DONE_DAYS * 86_400_000).toISOString()

/** "Waiting on Arnaldo Oliveira": time off, reimbursements and extra hours go to the Super Admins (approvers.ts). */
async function waitingOn(personId: string): Promise<string> {
  const names = (await loadApprovers(db(), personId)).map(a => a.name)
  return names.length && names.length <= 2 ? `Waiting on ${names.join(' or ')}` : 'Waiting for a Super Admin'
}

type Mine = HomeRow & { at: string }
type MineIcon = 'requests' | 'clock' | 'client-reports'
/** Each row opens its own page (audit, 25 October 2026); every kind is read behind that page's gate. */
const mineRows = (href: string) => (key: string, title: string, sub: string, state: 'wait' | 'done', icon: MineIcon, at: string): Mine =>
  ({ key, kind: 'mine', title, sub, due: null, button: 'Open', panel: null, href, mine: { state, icon }, at })
const newestFirst = (rows: Mine[]): HomeRow[] => rows.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...r }) => r)

async function myTimeOff(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows('/requests/time-off')
  const since = sinceIso(now)
  const { data, error } = await db().from('tc_absence_requests')
    .select('id, start_date, end_date, state, requested_at, decided_by, decided_at, cancel_asked_at, cancelled_at')
    .eq('person_id', v.personId).or(`state.eq.pending,cancel_asked_at.not.is.null,decided_at.gte.${since},cancelled_at.gte.${since}`)
  if (error) throw new Error(error.message)
  type R = { id: number; start_date: string; end_date: string; state: string; requested_at: string; decided_by: string | null; decided_at: string | null; cancel_asked_at: string | null; cancelled_at: string | null }
  // The read is wide (a cancellation keeps cancel_asked_at once approved); what shows is ownTimeOffShown's.
  const rows = ((data ?? []) as R[]).filter(r => ownTimeOffShown(r, since))
  if (!rows.length) return []
  const [dir, wait] = await Promise.all([loadDirectory(), waitingOn(v.personId)])
  return newestFirst(rows.map(r => {
    const title = `Time off,${r.start_date === r.end_date ? monthDay(r.start_date) : rangeLabel(r.start_date, r.end_date)}`
    const on = (t: string | null) => (t ? monthDay(localDate(t, v.zone)) : '')
    if (r.state === 'pending') return mineRow(`o${r.id}`, title, wait, 'wait', 'requests', r.requested_at)
    if (r.state === 'approved' && r.cancel_asked_at) return mineRow(`o${r.id}`, title, `Cancellation asked. ${wait}`, 'wait', 'requests', r.cancel_asked_at)
    if (r.state === 'cancelled') return mineRow(`o${r.id}`, title, `Cancelled, ${on(r.cancelled_at)}`, 'done', 'requests', r.cancelled_at ?? r.requested_at)
    return mineRow(`o${r.id}`, title, `${r.state === 'denied' ? 'Denied' : 'Approved'} by ${dir.nameOf(r.decided_by)}, ${on(r.decided_at)}`, 'done', 'requests', r.decided_at ?? r.requested_at)
  }))
}

async function myReimbursements(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows('/requests/reimbursements')
  const { data, error } = await db().from('reimbursements')
    .select('id, amount, currency, state, asked_at, decided_at, report_id')
    .eq('person_id', v.personId).or(`state.eq.pending,decided_at.gte.${sinceIso(now)}`)
  if (error) throw new Error(error.message)
  type R = { id: number; amount: number; currency: string; state: string; asked_at: string; decided_at: string | null; report_id: number | null }
  const rows = (data ?? []) as R[]
  if (!rows.length) return []
  // A request with several receipts is one row, as Approvals lists it.
  const groups = new Map<string, R[]>()
  for (const r of rows) {
    const k = r.report_id != null ? `rr${r.report_id}` : `r${r.id}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const wait = rows.some(r => r.state === 'pending') ? await waitingOn(v.personId) : ''
  return newestFirst([...groups].map(([key, list]) => {
    const title = `Reimbursement, ${totalsText(list.map(r => ({ amount: Number(r.amount), currency: r.currency })))}`
    if (list.some(r => r.state === 'pending')) return mineRow(key, title, wait, 'wait', 'client-reports', list[0].asked_at)
    const last = list.map(r => r.decided_at ?? r.asked_at).sort().pop()!
    const word = list.every(r => r.state === 'denied') ? 'Denied' : list.every(r => r.state === 'paid' || r.state === 'denied') ? 'Paid' : 'Approved'
    return mineRow(key, title, `${word}, ${monthDay(localDate(last, v.zone))}`, 'done', 'client-reports', last)
  }))
}

async function myExtraHours(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows('/requests/extra-hours')
  const { data, error } = await db().from('extra_hours_requests')
    .select('id, person_id, asked_by, hours, state, asked_at, decided_by, decided_at')
    .or(`person_id.eq.${v.personId},asked_by.eq.${v.personId}`).order('asked_at', { ascending: false }).limit(100)
  if (error) throw new Error(error.message)
  type R = { id: number; person_id: string; asked_by: string | null; hours: number; state: string; asked_at: string; decided_by: string | null; decided_at: string | null }
  const since = sinceIso(now)
  const rows = ((data ?? []) as R[]).filter(r => r.state === 'pending' || (r.decided_at ?? '') >= since)
  if (!rows.length) return []
  const [dir, wait] = await Promise.all([loadDirectory(), waitingOn(v.personId)])
  return newestFirst(rows.map(r => {
    const hours = formatDuration(Number(r.hours) * 3600)
    const title = r.person_id === v.personId ? `Extra hours, ${hours}` : `Extra hours for ${dir.nameOf(r.person_id)}, ${hours}`
    if (r.state === 'pending') return mineRow(`x${r.id}`, title, wait, 'wait', 'clock', r.asked_at)
    return mineRow(`x${r.id}`, title, `${r.state === 'denied' ? 'Denied' : 'Approved'} by ${dir.nameOf(r.decided_by)}, ${monthDay(localDate(r.decided_at!, v.zone))}`, 'done', 'clock', r.decided_at!)
  }))
}

async function myCorrections(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows(TIME_ENTRIES)
  const { data, error } = await db().from('tc_correction_requests')
    .select('id, entry_date, started_at, ended_at, state, requested_at, decided_by, decided_at')
    .eq('person_id', v.personId).or(`state.eq.pending,decided_at.gte.${sinceIso(now)}`)
  if (error) throw new Error(error.message)
  type R = { id: number; entry_date: string; started_at: string; ended_at: string; state: string; requested_at: string; decided_by: string | null; decided_at: string | null }
  const rows = (data ?? []) as R[]
  if (!rows.length) return []
  const dir: Directory = await loadDirectory()
  // Who decides it, as the person's own Time entries says it (clocky-requests.ts).
  const goesTo = goesToLabel(teamLeadNames(v.personId, dir.target(v.personId).teamIds, dir.led, id => !!dir.people.get(id)?.active, id => dir.nameOf(id)))
  return newestFirst(rows.map(r => {
    const secs = Math.max(0, (Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000)
    const title = `Time correction, ${monthDay(r.entry_date)}, ${formatDuration(secs)}`
    if (r.state === 'pending') return mineRow(`c${r.id}`, title, `Waiting on ${goesTo}`, 'wait', 'clock', r.requested_at)
    return mineRow(`c${r.id}`, title, `${r.state === 'denied' ? 'Denied' : 'Approved'} by ${dir.nameOf(r.decided_by)}, ${monthDay(localDate(r.decided_at!, v.zone))}`, 'done', 'clock', r.decided_at!)
  }))
}

/**
 * "Your Oct 12 to 25 timesheet", "With Dave Sharpe since Sun": a timesheet sent
 * and waiting at someone's step, or sent back; approved ones for 30 days. Never
 * one still to send: the Pay period card owns that.
 */
async function myTimesheets(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows(TIME_ENTRIES)
  const { data, error } = await db().from('tc_submissions')
    .select('id, state, submitted_at, approved_at, hours_approved_at, tc_periods(start_date, end_date)')
    .eq('person_id', v.personId).in('state', ['submitted', 'hours_approved', 'returned', 'approved', 'recorded'])
    .order('id', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  type R = { id: number; state: string; submitted_at: string | null; approved_at: string | null; hours_approved_at: string | null; tc_periods: { start_date: string; end_date: string } | null }
  const since = sinceIso(now)
  const rows = ((data ?? []) as unknown as R[]).filter(r => r.tc_periods && (['submitted', 'hours_approved', 'returned'].includes(r.state) || (r.approved_at ?? '') >= since))
  if (!rows.length) return []
  const [dir, settings, routes] = await Promise.all([loadDirectory(), loadRouteSettings(), loadRoutes([v.personId])])
  const route = routes.get(v.personId)
  const weekday = (t: string) => dayLabel(localDate(t, v.zone)).split(',')[0]
  return newestFirst(rows.map(r => {
    const title = `Your ${periodLabel({ start: r.tc_periods!.start_date, end: r.tc_periods!.end_date }).label} timesheet`
    if (r.state === 'submitted' || r.state === 'hours_approved') {
      const owner = route ? currentStep(route, settings, r.state as TimesheetState)?.owner ?? null : null
      const since = r.state === 'hours_approved' ? r.hours_approved_at : r.submitted_at
      return mineRow(`t${r.id}`, title, `With ${owner ? dir.nameOf(owner) : 'its approver'}${since ? ` since ${weekday(since)}` : ''}`, 'wait', 'clock', since ?? r.submitted_at ?? '')
    }
    if (r.state === 'returned') return mineRow(`t${r.id}`, title, 'Sent back to you. Fix it in Time entries and send it again.', 'wait', 'clock', r.submitted_at ?? '')
    return mineRow(`t${r.id}`, title, `${r.state === 'recorded' ? 'Recorded' : 'Approved'}, ${monthDay(localDate(r.approved_at!, v.zone))}`, 'done', 'clock', r.approved_at!)
  }))
}

/** "September invoice, $2,180.00", "Paid on Oct 6": a contractor's own invoices, waiting or paid in the last 30 days. */
async function myInvoices(v: Viewer, now: Date): Promise<HomeRow[]> {
  const mineRow = mineRows(INVOICES)
  const { data, error } = await db().from('invoices')
    .select('id, state, total, currency, period_start, period_end, issued_on, approved_at, paid_on')
    .eq('person_id', v.personId).neq('state', 'draft').order('id', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  type R = { id: number; state: string; total: number; currency: string; period_start: string; period_end: string; issued_on: string; approved_at: string | null; paid_on: string | null }
  const since = localDate(sinceIso(now), v.zone)
  const rows = ((data ?? []) as R[]).filter(r => r.state !== 'paid' || (r.paid_on ?? '') >= since)
  if (!rows.length) return []
  const [dir, settings, routes] = await Promise.all([loadDirectory(), loadRouteSettings(), loadRoutes([v.personId])])
  const route = routes.get(v.personId)
  const approver = route ? invoiceApprover(route, settings) : null
  return newestFirst(rows.map(r => {
    const title = `${periodLabel({ start: r.period_start, end: r.period_end }).label} invoice, ${totalsText([{ amount: Number(r.total), currency: r.currency }])}`
    if (r.state === 'paid') return mineRow(`i${r.id}`, title, `Paid on ${monthDay(r.paid_on!)}`, 'done', 'client-reports', r.paid_on!)
    if (r.state === 'approved') return mineRow(`i${r.id}`, title, `Approved, ${monthDay(localDate(r.approved_at!, v.zone))}. Finance pays it.`, 'wait', 'client-reports', r.approved_at!)
    return mineRow(`i${r.id}`, title, `With ${approver ? dir.nameOf(approver) : 'its approver'}`, 'wait', 'client-reports', r.issued_on)
  }))
}
