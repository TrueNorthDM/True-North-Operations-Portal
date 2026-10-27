'use server'

/**
 * Requests (Clocky part 2, Requests.dc.html): what people ask for.
 *
 *   Time off (7A, 7B, 7E)    US employees ask for days off, cancel one still
 *                            waiting, or ask a Super Admin to cancel an
 *                            approved one still to come
 *   Extra hours (10C)        before going over the allowance, for themselves or,
 *                            a Team Leader, for someone on their teams
 *   Reimbursement documents  Finance marks one paid (9D); the reimbursement
 *   (9D)                     itself is sent with its receipt by a route
 *                            (reimbursements/new/route.ts)
 *
 * Super Admins decide on Approvals (approvals/actions.ts). Writes are for the
 * person really signed in (writerAccess), never during a View Stage preview,
 * and go through the privileged client.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadCatalog, loadDirectory, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { announceTimeOffCancelAsked, announceTimeOffRequested } from '@/lib/timeclock/clocky-notify'
import { loadApprovers } from '@/lib/timeclock/approvers'
import { localDate } from '@/lib/timeclock/format'
import { loadRoutes } from '@/lib/timeclock/pay-terms'
import { daysText, holidaysBetween, offDays } from '@/lib/timeclock/time-off'
import { allowanceRange } from '@/lib/timeclock/allowance'
import { loadClockySettings } from '@/lib/timeclock/clocky-context'
import { announceExtraRequested, announceRmbPaid } from '@/lib/timeclock/clocky-notify'
import { dateLabel, monthYear } from '@/lib/timeclock/format'
import { isFinance, loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { formatDuration } from '@/lib/timeclock/rounding'
import { loadClients } from '@/lib/timeclock/requests-data'
import type { Fail, Result } from '@/lib/timeclock/clocky-types'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const fail = (error: string): Fail => ({ ok: false, error })
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false
function notSaved(e: unknown): Fail {
  console.error('[requests]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}
const refresh = () => { revalidatePath('/requests', 'layout'); revalidatePath('/clocky-hours/approvals'); revalidatePath('/clocky-hours') }

async function actor(key: string): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to send a request.')
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
    if (!route || route.isContractor) return fail('Time off is for employees. Contractors are not paid for days off, so there is nothing to ask.')
    const code = (await loadCatalog()).jobs.get(Number(input.jobcodeId))
    if (!code || !code.active || (code.kind !== 'pto' && code.kind !== 'unpaid')) return fail('Pick a kind of time off.')
    const start = String(input.start ?? ''), end = String(input.end || input.start || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return fail('Pick the days: one day, or the first and the last.')
    if (start < localDate(new Date(), v.zone)) return fail('Time off is asked before it starts. For days already gone, tell a Super Admin.')
    const hours = Number(input.hoursPerDay)
    if (!(hours >= 1 && hours <= 8 && Number.isInteger(hours))) return fail('Hours a day go from 1h to 8h.')
    const { days } = offDays(start, end, holidaysBetween(start, end))
    if (!days.length) return fail('Those days are weekends or company holidays. Nothing to ask for.')
    const approvers = await loadApprovers(c, v.personId)
    if (!approvers.length) return fail('Nobody is set up to approve time off yet. Ask a Super Admin.')
    const { data: mine, error: readErr } = await c.from('tc_absence_requests').select('start_date, end_date').eq('person_id', v.personId).in('state', ['pending', 'approved'])
    if (readErr) return notSaved(readErr)
    const clash = (mine ?? []).find(r => r.start_date <= end && r.end_date >= start)
    if (clash) return fail(`You already have time off asked for ${daysText(clash.start_date, clash.end_date)}.`)
    const note = String(input.note ?? '').trim().slice(0, 1000) || null
    const { data, error } = await c.from('tc_absence_requests').insert({
      person_id: v.personId, jobcode_id: code.id, start_date: start, end_date: end, hours_per_day: hours, state: 'pending', reason: note,
    }).select('id').single()
    if (error) return notSaved(error)
    // Whoever they report to hears of it too, when that is not one of the Super Admins who decide.
    const leader = route.reportsTo && !approvers.some(a => a.id === route.reportsTo) ? route.reportsTo : null
    await announceTimeOffRequested({ id: data.id, person_id: v.personId, start_date: start, end_date: end, kind: code.short || code.path, seconds: days.length * hours * 3600, teamLeader: leader })
    refresh()
    const leaderName = leader ? (await loadDirectory()).nameOf(leader) : null
    return { ok: true, toast: leaderName ? `Sent. A Super Admin decides; ${leaderName}, your Team Leader, was told.` : 'Sent. A Super Admin decides; you hear back in the bell.' }
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

/** 7E: an approved time off still to come; a Super Admin approves the cancellation. The reason is required. */
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
    return { ok: true, toast: 'Asked. When a Super Admin approves, it comes off Rippling and the team calendar.' }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Extra hours (10C) ───────────────────────────────────────────────────────

/**
 * Ask for extra hours before going over the allowance: for themselves, or a
 * Team Leader for someone on the teams they lead. A week or a month, how many
 * hours, the client and why. A Super Admin decides on Approvals.
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
    const m = /^(week|month):(\d{4}-\d{2}-\d{2})$/.exec(String(input.when ?? ''))
    if (!m) return fail('Pick the week or the month.')
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
    return { ok: true, toast: 'Sent. A Super Admin decides on Approvals.' }
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

