'use server'

/**
 * Requests (Clocky part 2, Requests.dc.html): what people ask for.
 *
 *   Time off (7A, 7B, 7E)    US employees ask for days off, cancel one still
 *                            waiting, or ask to cancel an approved one
 *                            still to come
 *   Extra hours (10C)        before going over the allowance, for themselves or,
 *                            a Team Leader, for someone on their teams
 *   Reimbursement documents  Finance marks one paid (9D); the reimbursement
 *   (9D)                     itself is sent with its receipt by a route
 *                            (reimbursements/new/route.ts), and changed by
 *                            another while it waits (edit/route.ts)
 *   Withdraw a reimbursement its person takes back a request still entirely
 *                            waiting (owner, 5 November 2026)
 *
 * Whoever the routing names decides on Approvals (approvals/actions.ts;
 * Company settings, Who approves what), and each toast names them. Writes are for the
 * person really signed in (writerAccess), never during a View Stage preview,
 * and go through the privileged client.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadCatalog, loadDirectory, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { announceTimeOffCancelAsked, announceTimeOffRequested } from '@/lib/timeclock/clocky-notify'
import { localDate } from '@/lib/timeclock/format'
import { loadRequestDeciders, loadRoutes } from '@/lib/timeclock/pay-terms'
import { orList } from '@/lib/timeclock/routing'
import { IS_STAGING } from '@/lib/environment'
import { daysText, holidaysBetween, offDays } from '@/lib/timeclock/time-off'
import { allowanceRange } from '@/lib/timeclock/allowance'
import { loadClockySettings } from '@/lib/timeclock/clocky-context'
import { announceExtraRequested, announceRmbPaid } from '@/lib/timeclock/clocky-notify'
import { dateLabel, monthYear } from '@/lib/timeclock/format'
import { isFinance, loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { formatDuration } from '@/lib/timeclock/rounding'
import { loadClients } from '@/lib/timeclock/requests-data'
import type { Fail, Result } from '@/lib/timeclock/clocky-types'
import { closedRefusal } from '@/lib/timeclock/north-time-lock'
import { announceReimbursementChanged } from '@/lib/timeclock/clocky-notify'
import { allWaiting, reportTitle, totalsText } from '@/lib/timeclock/reimbursement-reports'
import { snapshotOf } from '@/lib/timeclock/reimbursement-form'
import { logRmbChanges } from '@/lib/timeclock/reimbursement-store'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const fail = (error: string): Fail => ({ ok: false, error })
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false
function notSaved(e: unknown): Fail {
  console.error('[requests]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}
/** "David Sharpe", "Arnaldo Oliveira or David Sharpe": who decides this kind of request for this person. */
async function whoDecides(kind: 'off' | 'xh', personId: string): Promise<{ ids: string[]; names: string }> {
  const [dir, deciders] = await Promise.all([loadDirectory(), loadRequestDeciders([personId])])
  const ids = deciders(kind, personId)
  return { ids, names: orList(ids.map(id => dir.nameOf(id))) }
}
const refresh = () => { revalidatePath('/requests', 'layout'); revalidatePath('/clocky-hours/approvals'); revalidatePath('/clocky-hours') }

async function actor(key: string): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to send a request.')
  const closed = await closedRefusal(fail)
  if (closed) return closed
  const access = await writerAccess()
  if (!access) return fail('Sign in again to save.')
  if (!access.can(key)) return fail('Requests is not open to your access.')
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

// ── Time off ────────────────────────────────────────────────────────────────

/**
 * 7A: ask for days off. US employees only; a kind of time off (Vacation, Sick,
 * Holiday, Jury duty, Unpaid); full days (8h) or a number of hours a day; the
 * weekends and company holidays are not counted; never a day already asked.
 */
export async function askTimeOff(input: { jobcodeId: number; start: string; end: string; hoursPerDay: number; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-time-off')
  if (isFail(v)) return v
  try {
    const c = db()
    const route = (await loadRoutes([v.personId])).get(v.personId)
    // The staging copy lets contractors ask, for training (owner, 5 November 2026); the live portal never does.
    if (!route || (route.isContractor && !IS_STAGING)) return fail('Time off is for employees. Contractors are not paid for days off, so there is nothing to ask.')
    const code = (await loadCatalog()).jobs.get(Number(input.jobcodeId))
    if (!code || !code.active || (code.kind !== 'pto' && code.kind !== 'unpaid')) return fail('Pick a kind of time off.')
    const start = String(input.start ?? ''), end = String(input.end || input.start || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return fail('Pick the days: one day, or the first and the last.')
    if (start < localDate(new Date(), v.zone)) return fail('Time off is asked before it starts. For days already gone, tell a Super Admin.')
    const hours = Number(input.hoursPerDay)
    if (!(hours >= 1 && hours <= 8 && Number.isInteger(hours))) return fail('Hours a day go from 1h to 8h.')
    const { days } = offDays(start, end, holidaysBetween(start, end))
    if (!days.length) return fail('Those days are weekends or company holidays. Nothing to ask for.')
    const who = await whoDecides('off', v.personId)
    if (!who.ids.length) return fail('Nobody is set up to approve time off yet. Ask a Super Admin.')
    const { data: mine, error: readErr } = await c.from('tc_absence_requests').select('start_date, end_date').eq('person_id', v.personId).in('state', ['pending', 'approved'])
    if (readErr) return notSaved(readErr)
    const clash = (mine ?? []).find(r => r.start_date <= end && r.end_date >= start)
    if (clash) return fail(`You already have time off asked for ${daysText(clash.start_date, clash.end_date)}.`)
    const note = String(input.note ?? '').trim().slice(0, 1000) || null
    const { data, error } = await c.from('tc_absence_requests').insert({
      person_id: v.personId, jobcode_id: code.id, start_date: start, end_date: end, hours_per_day: hours, state: 'pending', reason: note,
    }).select('id').single()
    if (error) return notSaved(error)
    // Whoever they report to hears of it too, when that is not who decides.
    const leader = route.reportsTo && !who.ids.includes(route.reportsTo) ? route.reportsTo : null
    await announceTimeOffRequested({ id: data.id, person_id: v.personId, start_date: start, end_date: end, kind: code.short || code.path, seconds: days.length * hours * 3600, teamLeader: leader })
    refresh()
    const leaderName = leader ? (await loadDirectory()).nameOf(leader) : null
    return { ok: true, toast: leaderName ? `Sent. ${who.names} decides; ${leaderName}, your Team Leader, was told.` : `Sent. ${who.names} decides; you hear back in the bell.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** 7B: cancel a request still waiting. Nothing was sent anywhere, so nothing comes back. */
export async function cancelTimeOff(input: { id: number }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-time-off')
  if (isFail(v)) return v
  try {
    const { data, error } = await db().from('tc_absence_requests').update({ state: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: v.personId })
      .eq('id', Number(input.id)).eq('person_id', v.personId).eq('state', 'pending').select('id')
    if (error) return notSaved(error)
    if (!data?.length) return fail('That request is no longer waiting. It may have been decided already.')
    refresh()
    return { ok: true, toast: 'Request cancelled. Nothing was sent anywhere.' }
  } catch (e) {
    return notSaved(e)
  }
}

/** 7E: an approved time off still to come; whoever decides their time off approves the cancellation. The reason is required. */
export async function askCancelTimeOff(input: { id: number; reason: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-time-off')
  if (isFail(v)) return v
  try {
    const reason = String(input.reason ?? '').trim().slice(0, 1000)
    if (!reason) return fail('Say why you no longer need these days.')
    const c = db()
    const today = localDate(new Date(), v.zone)
    const { data, error } = await c.from('tc_absence_requests').update({ cancel_asked_at: new Date().toISOString(), cancel_reason: reason })
      .eq('id', Number(input.id)).eq('person_id', v.personId).eq('state', 'approved').is('cancel_asked_at', null).gt('start_date', today)
      .select('id, start_date, end_date, jobcode_id')
    if (error) return notSaved(error)
    const r = data?.[0]
    if (!r) return fail('That time off cannot be cancelled here: it has started or is already being cancelled.')
    const kind = (await loadCatalog()).jobs.get(r.jobcode_id)?.short ?? 'Time off'
    await announceTimeOffCancelAsked({ id: r.id, person_id: v.personId, start_date: r.start_date, end_date: r.end_date, kind, reason })
    refresh()
    const who = await whoDecides('off', v.personId)
    return { ok: true, toast: `Asked. When ${who.names || 'who approves time off'} approves, it comes off Rippling and the team calendar.` }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Extra hours (10C) ───────────────────────────────────────────────────────

/**
 * Ask for extra hours before going over the allowance: for themselves, or a
 * Team Leader for someone on the teams they lead. A week (every allowance is
 * Weekly hours since 5 November 2026), how many
 * hours, the client and why. Whoever the routing names for that person (not
 * who asked) decides on Approvals.
 */
export async function askExtraHours(input: { personId: string; hours: number; when: string; client: string; why: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-extra-hours')
  if (isFail(v)) return v
  try {
    const dir = await loadDirectory()
    const target = String(input.personId ?? v.personId)
    const mine = target === v.personId
    if (!mine && !(dir.people.get(target)?.teamIds ?? []).some(t => v.ledTeamIds.has(t))) return fail('You can ask for extra hours for yourself, or for someone on a team you lead.')
    const hours = Number(String(input.hours ?? '').replace(',', '.'))
    if (!(hours > 0 && hours <= 200)) return fail('Write how many hours, like 8.')
    const m = /^(week):(\d{4}-\d{2}-\d{2})$/.exec(String(input.when ?? ''))
    if (!m) return fail('Pick the week.')
    const period = m[1] as 'week' | 'month'
    const range = allowanceRange(m[2], period, (await loadClockySettings()).weekStart)
    const client = String(input.client ?? '').trim()
    if (!client || !(await loadClients()).includes(client)) return fail('Pick the client or project.')
    const why = String(input.why ?? '').trim().slice(0, 1000)
    if (!why) return fail('Say what the extra hours are for, and who asked.')
    const { data, error } = await db().from('extra_hours_requests').insert({
      person_id: target, asked_by: v.personId, hours: Math.round(hours * 100) / 100, period, period_start: range.from, period_end: range.to, client, reason: why, state: 'pending',
    }).select('id').single()
    if (error) return notSaved(error)
    const when = period === 'month' ? monthYear(range.from) : `the week of ${dateLabel(range.from).replace(/, \d{4}$/, '')}`
    await announceExtraRequested({ id: data.id, personId: target, askedBy: v.personId, hours: formatDuration(hours * 3600), when, client })
    refresh()
    const who = await whoDecides('xh', target)
    // A Team Leader who asks for someone they decide for: theirs on Approvals.
    if (who.ids.includes(v.personId)) return { ok: true, toast: 'Sent. It is yours to decide on Approvals.' }
    return { ok: true, toast: who.names ? `Sent. ${who.names} decides; you hear back in the bell.` : 'Sent. You hear back in the bell.' }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Reimbursement documents (9D) ────────────────────────────────────────────

/** Finance marks an employee's reimbursement document paid, outside Rippling payroll. Paid once; its items show Paid. */
export async function markRmbPaid(input: { id: number; paidOn: string; ref?: string; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-reimbursements')
  if (isFail(v)) return v
  try {
    if (!isFinance(v, await loadInvoiceSettings())) return fail('Only Finance marks reimbursement documents paid.')
    const paidOn = String(input.paidOn ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(`${paidOn}T00:00:00Z`))) return fail('Write the day it was paid, like Nov 3, 2026.')
    if (paidOn > localDate(new Date(), v.zone)) return fail('Paid on cannot be after today.')
    const ref = String(input.ref ?? '').trim().slice(0, 120) || null
    const note = String(input.note ?? '').trim().slice(0, 1000) || null
    const c = db()
    const at = new Date().toISOString()
    const { data, error } = await c.from('reimbursement_documents').update({ state: 'paid', paid_on: paidOn, paid_ref: ref, paid_note: note, paid_by: v.personId, updated_at: at })
      .eq('id', Number(input.id)).eq('state', 'approved').select('id, number, person_id')
    if (error) return notSaved(error)
    const d = data?.[0]
    if (!d) return fail('That document is not waiting to be paid. It may have been marked paid already.')
    // The items go paid with their document; if they cannot, the document goes back to waiting, so the two never disagree.
    const items = await c.from('reimbursements').update({ state: 'paid' }).eq('document_id', d.id).eq('state', 'approved')
    if (items.error) {
      const back = await c.from('reimbursement_documents').update({ state: 'approved', paid_on: null, paid_ref: null, paid_note: null, paid_by: null, updated_at: at }).eq('id', d.id).eq('state', 'paid')
      if (back.error) console.error('[requests] document left paid with its items approved:', d.number, back.error.message)
      return notSaved(items.error)
    }
    await announceRmbPaid({ documentId: d.id, number: d.number, personId: d.person_id, paidOn: dateLabel(paidOn), ref })
    refresh()
    return { ok: true, toast: `${d.number} marked paid. ${(await loadDirectory()).nameOf(d.person_id)} sees it in the bell.` }
  } catch (e) {
    return notSaved(e)
  }
}


// ── Withdraw a reimbursement request (owner, 5 November 2026) ───────────────

/**
 * The person takes back their own request while every receipt of it is still
 * waiting: "report:<id>" (a request with a name or several receipts) or
 * "item:<id>" (one receipt with no name), with a reason if they like. It
 * leaves Approvals, shows "Withdrawn" in their list, and whoever decides hears
 * of it in the bell. Kept in its history (migration 153).
 */
export async function withdrawReimbursement(input: { target: string; reason?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-reimbursements')
  if (isFail(v)) return v
  try {
    const m = /^(report|item):(\d+)$/.exec(String(input.target ?? ''))
    if (!m) return fail('Pick the request to withdraw.')
    const c = db()
    const cols = 'id, person_id, report_id, state, spent_on, category, amount, currency, purpose, client, billable, miles, receipt_name, receipt_number'
    const read = m[1] === 'report'
      ? await c.from('reimbursements').select(cols).eq('report_id', Number(m[2])).order('id')
      : await c.from('reimbursements').select(cols).eq('id', Number(m[2])).is('report_id', null)
    if (read.error) return notSaved(read.error)
    const rows = read.data ?? []
    if (!rows.length || rows.some(r => r.person_id !== v.personId)) return fail('That request is not yours to withdraw.')
    if (!allWaiting(rows)) return fail('This request is no longer waiting: part of it has been decided, so it cannot be withdrawn.')
    const reason = String(input.reason ?? '').trim().slice(0, 1000) || null
    const at = new Date().toISOString()
    const { data, error } = await c.from('reimbursements').update({ state: 'withdrawn', withdrawn_at: at, withdrawn_reason: reason })
      .in('id', rows.map(r => r.id)).eq('person_id', v.personId).eq('state', 'pending').select('id')
    if (error) return notSaved(error)
    // A decision made meanwhile wins: what was withdrawn waits again, so the request is never half withdrawn.
    if ((data ?? []).length !== rows.length) {
      const back = (data ?? []).map(r => r.id)
      if (back.length) await c.from('reimbursements').update({ state: 'pending', withdrawn_at: null, withdrawn_reason: null }).in('id', back).eq('state', 'withdrawn')
      return fail('This request was decided while you withdrew it. Reload the page to see where it is.')
    }
    await logRmbChanges(v.personId, at, rows.map(r => ({ action: 'withdrawn' as const, reimbursementId: r.id, reportId: r.report_id, before: snapshotOf(r), reason })))
    const name = m[1] === 'report' ? (await c.from('reimbursement_reports').select('name').eq('id', Number(m[2])).maybeSingle()).data?.name ?? null : null
    await announceReimbursementChanged({
      firstId: rows[0].id, personId: v.personId, what: 'withdrawn', at, reason,
      title: m[1] === 'report' ? reportTitle(name, rows.length) : rows[0].category,
      total: totalsText(rows.map(r => ({ amount: Number(r.amount), currency: r.currency }))),
    })
    refresh()
    return { ok: true, toast: rows.length === 1 ? 'Withdrawn. It no longer waits for a decision.' : `Withdrawn, all ${rows.length} receipts. They no longer wait for a decision.` }
  } catch (e) {
    return notSaved(e)
  }
}
