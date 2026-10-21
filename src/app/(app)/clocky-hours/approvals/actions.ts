'use server'

/**
 * Approvals (design handoff of 16 October 2026, README "Time correction
 * requests and approvals", Time Entries.dc.html frames 3K-3, 3L and 3L-2).
 *
 * Time corrections are decided by the person's Team Lead, an Admin or a Super
 * Admin, never by the person (lib/timeclock/scope.ts); time off by Super
 * Admins only. Approving a correction turns it into a normal entry marked
 * Edited, with the request in its history, unless the time now overlaps an
 * entry; denying needs a reason. The requester hears either way.
 *
 * Writes are for the person really signed in (writerAccess), never during a
 * View Stage preview, and go through the privileged client.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadCatalog, loadDirectory, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { audit, loadSubmissions, lockOn, overlapFor, snapshot, type EntryRow } from '@/lib/timeclock/clocky-store'
import { countWaiting, loadApprovals } from '@/lib/timeclock/clocky-approvals'
import { loadQueue, type QueueData } from '@/lib/timeclock/approval-queue'
import { announceCorrectionDecided, announceExtraDecided, announceHoursApproved, announceInvoiceApproved, announceReimbursementDecided, announceRmbReady, announceTimeOffDecided, announceTimesheetDecided } from '@/lib/timeclock/clocky-notify'
import { usd } from '@/lib/timeclock/invoice-doc'
import { loadInvoiceSettings, loadPayTerms, loadRoutes } from '@/lib/timeclock/pay-terms'
import { currentStep, hoursApprover, invoiceApprover, stateAfterApprove, type TimesheetState } from '@/lib/timeclock/routing'
import { hoursByClient } from '@/lib/timeclock/invoices-data'
import { loadApprovedExtra } from '@/lib/timeclock/allowance-data'
import { allowanceStatus } from '@/lib/timeclock/allowance'
import { loadConnections } from '@/lib/integrations/connections'
import { REASON_REQUIRED, approveOverlapLine, reasonOf } from '@/lib/timeclock/entry-rules'
import { formatDuration, recordedSeconds, roundSeconds } from '@/lib/timeclock/rounding'
import { holidaysBetween, offDays } from '@/lib/timeclock/time-off'
import { enqueue, retryJobs } from '@/lib/integrations/outbox'
import { dayLabel, monthYear } from '@/lib/timeclock/format'
import { lockedMessage, periodLabel } from '@/lib/timeclock/periods'
import { canApproveCorrection, canDecideTimeOff, canReopen } from '@/lib/timeclock/scope'
import type { ApprovalsData, Fail, Result } from '@/lib/timeclock/clocky-types'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const PREVIEW = 'View Stage is only a preview. Close it to decide.'
const SIGN_IN = 'Sign in again to save.'
const NO_ACCESS = 'Approvals is not open to your access.'
const NOT_WAITING = 'That request is not waiting for you. It may have been decided already.'

const fail = (error: string, extra: Omit<Fail, 'ok' | 'error'> = {}): Fail => ({ ok: false, error, ...extra })
function notSaved(e: unknown): Fail {
  console.error('[clocky approvals]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false
const refresh = () => { revalidatePath('/clocky-hours'); revalidatePath('/clocky-hours/approvals'); revalidatePath('/hours') }
const first = (name: string) => name.split(/\s+/)[0] ?? name

async function actor(key: string): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail(PREVIEW)
  const access = await writerAccess()
  if (!access) return fail(SIGN_IN)
  if (!access.can(key)) return fail(NO_ACCESS)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

/** The Approvals page: waiting and decided, in the viewer's scope (3L). */
export async function getApprovals(): Promise<Result<{ data: ApprovalsData }>> {
  const access = await loadAccess()
  if (!access.can('clocky-approvals')) return fail(NO_ACCESS)
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    return { ok: true, data: await loadApprovals(v, new Date()) }
  } catch (e) {
    console.error('[clocky approvals] list:', (e as Error).message)
    return fail('Approvals could not be read. Try again in a moment.')
  }
}

/** The Approvals list of Clocky part 2: waiting for you, with others, decided (approval-queue.ts). */
export async function getQueue(): Promise<Result<{ data: QueueData }>> {
  const access = await loadAccess()
  if (!access.can('clocky-approvals')) return fail(NO_ACCESS)
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    return { ok: true, data: await loadQueue(v, new Date()) }
  } catch (e) {
    console.error('[clocky approvals] queue:', (e as Error).message)
    return fail('Approvals could not be read. Try again in a moment.')
  }
}

/** The count on the Clocky menu row "Approvals" (0 shows none). */
export async function getApprovalsCount(): Promise<Result<{ count: number }>> {
  const access = await loadAccess()
  if (!access.can('clocky-approvals')) return { ok: true, count: 0 }
  const v = await viewerFor(access)
  if (!v) return { ok: true, count: 0 }
  try {
    return { ok: true, count: await countWaiting(v) }
  } catch (e) {
    console.error('[clocky approvals] count:', (e as Error).message)
    return { ok: true, count: 0 }
  }
}

type Request = { id: number; person_id: string; entry_date: string; started_at: string; ended_at: string; jobcode_id: number; fields: Record<string, string>; notes: string | null; reason: string; state: string }

/**
 * Approve or deny a time correction. Approve: the time becomes a normal entry
 * (marked Edited by the approver), refused if it now overlaps an entry or its
 * period is locked. Deny: a reason, which the requester is told.
 */
export async function decideCorrection(input: { id: number; decision: 'approve' | 'deny'; note?: string }): Promise<Result<{ entryId?: number; toast: string }>> {
  const v = await actor('clocky-approvals')
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const { data, error } = await c.from('tc_correction_requests').select('*').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    const r = data as Request | null
    if (!r || r.state !== 'pending' || !canApproveCorrection(v, dir.target(r.person_id))) return fail(NOT_WAITING)
    const name = dir.nameOf(r.person_id)
    const at = now.toISOString()

    if (input.decision === 'deny') {
      const note = reasonOf(input.note)
      if (!note) return fail(REASON_REQUIRED)
      const { data: done, error: e2 } = await c.from('tc_correction_requests')
        .update({ state: 'denied', decided_by: v.personId, decided_at: at, decision_note: note }).eq('id', r.id).eq('state', 'pending').select('id')
      if (e2) return notSaved(e2)
      if (!done?.length) return fail(NOT_WAITING)
      await announceCorrectionDecided(r, v.personId, false, note)
      refresh()
      return { ok: true, toast: `Denied. ${first(name)} gets the reason.` }
    }

    const zone = dir.zoneOf(r.person_id)
    const lock = lockOn([r.entry_date], (await loadSubmissions(c, [r.person_id])).get(r.person_id) ?? [])
    if (lock) return fail(lockedMessage(lock))
    const o = await overlapFor(c, r.person_id, { start: r.started_at, end: r.ended_at }, [], now)
    if (o) {
      const other = catalog.jobs.get(o.other.row.jobcode_id ?? -1)?.short ?? ''
      return fail(approveOverlapLine(o.other, other, zone), {
        overlap: { entryId: o.other.row.id, name: other, start: o.other.row.started_at!, end: o.other.row.ended_at, sharedStart: o.start, sharedEnd: o.end },
      })
    }
    // Claimed first, so two approvers at once make one entry.
    const { data: claimed, error: e3 } = await c.from('tc_correction_requests')
      .update({ state: 'approved', decided_by: v.personId, decided_at: at }).eq('id', r.id).eq('state', 'pending').select('id')
    if (e3) return notSaved(e3)
    if (!claimed?.length) return fail(NOT_WAITING)
    const { data: made, error: e4 } = await c.from('tc_entries').insert({
      person_id: r.person_id, jobcode_id: r.jobcode_id, started_at: r.started_at, ended_at: r.ended_at,
      duration_seconds: recordedSeconds(r.started_at, r.ended_at), entry_date: r.entry_date, kind: 'clock', state: 'open',
      source: 'portal', fields: r.fields ?? {}, notes: r.notes, created_by: v.personId, edited_by: v.personId, edited_at: at,
    }).select('*').single()
    if (e4) {
      await c.from('tc_correction_requests').update({ state: 'pending', decided_by: null, decided_at: null }).eq('id', r.id)
      return notSaved(e4)
    }
    const entry = made as EntryRow
    await c.from('tc_correction_requests').update({ entry_id: entry.id }).eq('id', r.id)
    await audit(c, [{ entryId: entry.id, action: 'correction_approved', by: v.personId, after: snapshot(entry, catalog) }])
    await announceCorrectionDecided(r, v.personId, true, null)
    refresh()
    return { ok: true, entryId: entry.id, toast: `Approved. ${formatDuration(entry.duration_seconds)} added to ${name}'s entries. ${first(name)} gets a notification.` }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * Approve or deny time off (Super Admins; Requests.dc.html 7C). Approving
 * writes its entries, one per working day that is not a company holiday, and
 * is refused when a day sits in a locked period (audit finding N8); then, by
 * itself, Rippling gets it for payroll and the team calendar shows the person
 * out (both through the outbox: they wait for their connection). Denying needs
 * a reason.
 */
export async function decideTimeOff(input: { id: number; decision: 'approve' | 'deny'; note?: string }): Promise<Result> {
  const v = await actor('ck-timeoff')
  if (isFail(v)) return v
  try {
    const c = db()
    const dir = await loadDirectory()
    const { data, error } = await c.from('tc_absence_requests').select('*').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    const r = data as { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string } | null
    if (!r || r.state !== 'pending' || !canDecideTimeOff(v, dir.target(r.person_id))) return fail(NOT_WAITING)
    const note = reasonOf(input.note)
    if (input.decision === 'deny' && !note) return fail(REASON_REQUIRED)
    const days = offDays(r.start_date, r.end_date, holidaysBetween(r.start_date, r.end_date)).days
    if (input.decision === 'approve') {
      const lock = lockOn(days, (await loadSubmissions(c, [r.person_id])).get(r.person_id) ?? [])
      if (lock) return fail(lockedMessage(lock))
    }
    const at = new Date().toISOString()
    const { data: done, error: e2 } = await c.from('tc_absence_requests').update({
      state: input.decision === 'approve' ? 'approved' : 'denied', decided_by: v.personId, decided_at: at, decision_note: note,
    }).eq('id', r.id).eq('state', 'pending').select('id')
    if (e2) return notSaved(e2)
    if (!done?.length) return fail(NOT_WAITING)
    const kind = (await loadCatalog()).jobs.get(r.jobcode_id)?.short ?? 'Time off'
    if (input.decision === 'approve' && days.length) {
      const seconds = roundSeconds(Number(r.hours_per_day) * 3600)
      const { error: e3 } = await c.from('tc_entries').insert(days.map(day => ({
        person_id: r.person_id, jobcode_id: r.jobcode_id, started_at: null, ended_at: null, duration_seconds: seconds,
        entry_date: day, kind: 'absence', state: 'open', notes: `Time off request #${r.id}`, fields: {}, source: 'portal',
        created_by: v.personId, updated_at: at,
      })))
      if (e3) {
        await c.from('tc_absence_requests').update({ state: 'pending', decided_by: null, decided_at: null, decision_note: null }).eq('id', r.id)
        return notSaved(e3)
      }
      // What happens by itself after the approval (7D): Rippling and the team calendar, through the outbox.
      const payload = { person_id: r.person_id, kind, start: r.start_date, end: r.end_date, days, hours_per_day: Number(r.hours_per_day), who: dir.nameOf(r.person_id) }
      const [rip, cal] = await Promise.all([
        enqueue({ kind: 'rippling_pto', refTable: 'tc_absence_requests', refId: r.id, payload, key: `rippling_pto:${r.id}` }),
        enqueue({ kind: 'gcal_upsert', refTable: 'tc_absence_requests', refId: r.id, payload, key: `gcal_upsert:${r.id}` }),
      ])
      await c.from('tc_absence_requests').update({ entries_written_at: at, rippling_state: rip === 'queued' ? 'queued' : 'waiting_connection', calendar_state: cal === 'queued' ? 'queued' : 'waiting_connection' }).eq('id', r.id)
    }
    // The person hears of it (the card's toast promises so).
    await announceTimeOffDecided({
      id: r.id, person_id: r.person_id, start_date: r.start_date, end_date: r.end_date, kind,
      seconds: Math.round(days.length * Number(r.hours_per_day) * 3600),
    }, v.personId, input.decision === 'approve', note)
    refresh()
    return { ok: true }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * An approved time off its person asked to cancel (7E): approving takes it off
 * the time entries, Rippling and the team calendar; denying keeps it, with the
 * reason. Super Admins, as for the time off itself.
 */
export async function decideTimeOffCancel(input: { id: number; decision: 'approve' | 'deny'; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('ck-timeoff')
  if (isFail(v)) return v
  try {
    const c = db()
    const dir = await loadDirectory()
    const { data: r, error } = await c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, state, cancel_asked_at, rippling_state, calendar_event_id').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    if (!r || r.state !== 'approved' || !r.cancel_asked_at || !canDecideTimeOff(v, dir.target(r.person_id))) return fail(NOT_WAITING)
    const note = reasonOf(input.note)
    const at = new Date().toISOString()
    const kind = (await loadCatalog()).jobs.get(r.jobcode_id)?.short ?? 'Time off'
    const label = r.start_date === r.end_date ? dayLabel(r.start_date) : `${dayLabel(r.start_date)} to ${dayLabel(r.end_date)}`
    if (input.decision === 'deny') {
      if (!note) return fail(REASON_REQUIRED)
      const { data: moved, error: e2 } = await c.from('tc_absence_requests').update({ cancel_asked_at: null, decision_note: note }).eq('id', r.id).not('cancel_asked_at', 'is', null).select('id')
      if (e2) return notSaved(e2)
      if (!moved?.length) return fail(NOT_WAITING)
      await announceTimeOffDecided({ id: r.id, person_id: r.person_id, start_date: r.start_date, end_date: r.end_date, kind, seconds: 0 }, v.personId, false, note, 'cancel')
      refresh()
      return { ok: true, toast: `Kept. ${dir.nameOf(r.person_id)} hears your reason.` }
    }
    const days = offDays(r.start_date, r.end_date, holidaysBetween(r.start_date, r.end_date)).days
    const lock = lockOn(days, (await loadSubmissions(c, [r.person_id])).get(r.person_id) ?? [])
    if (lock) return fail(lockedMessage(lock))
    const { data: moved, error: e2 } = await c.from('tc_absence_requests').update({ state: 'cancelled', cancelled_at: at, cancelled_by: v.personId })
      .eq('id', r.id).eq('state', 'approved').select('id')
    if (e2) return notSaved(e2)
    if (!moved?.length) return fail(NOT_WAITING)
    await c.from('tc_entries').delete().eq('person_id', r.person_id).eq('kind', 'absence').eq('source', 'portal').eq('notes', `Time off request #${r.id}`)
    const payload = { person_id: r.person_id, kind, start: r.start_date, end: r.end_date, event_id: r.calendar_event_id }
    // Only what went out comes back off: Rippling if it was sent, the calendar if it is on it.
    if (r.rippling_state === 'sent') await enqueue({ kind: 'rippling_pto_cancel', refTable: 'tc_absence_requests', refId: r.id, payload, key: `rippling_pto_cancel:${r.id}` })
    else await c.from('integration_jobs').delete().eq('ref_table', 'tc_absence_requests').eq('ref_id', r.id).eq('kind', 'rippling_pto').in('state', ['waiting_connection', 'queued', 'failed'])
    if (r.calendar_event_id) await enqueue({ kind: 'gcal_delete', refTable: 'tc_absence_requests', refId: r.id, payload, key: `gcal_delete:${r.id}` })
    else await c.from('integration_jobs').delete().eq('ref_table', 'tc_absence_requests').eq('ref_id', r.id).eq('kind', 'gcal_upsert').in('state', ['waiting_connection', 'queued', 'failed'])
    await announceTimeOffDecided({ id: r.id, person_id: r.person_id, start_date: r.start_date, end_date: r.end_date, kind, seconds: 0 }, v.personId, true, null, 'cancel')
    refresh()
    return { ok: true, toast: `Cancelled. ${label} came off ${first(dir.nameOf(r.person_id))}'s time entries.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** "Try again" when Rippling refused a time off (7D-x): it goes back in the queue. Super Admins. */
export async function retryTimeOffRippling(input: { id: number }): Promise<Result<{ toast: string }>> {
  const v = await actor('ck-timeoff')
  if (isFail(v)) return v
  try {
    const c = db()
    const { data: r, error } = await c.from('tc_absence_requests').select('id, state, rippling_state').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    if (!r || r.state !== 'approved' || r.rippling_state !== 'refused') return fail('Rippling did not refuse that time off.')
    await retryJobs('tc_absence_requests', r.id, ['rippling_pto'])
    const conn = await loadConnections()
    await c.from('tc_absence_requests').update({ rippling_state: conn.rippling.connected ? 'queued' : 'waiting_connection', rippling_error: null }).eq('id', r.id)
    refresh()
    return { ok: true, toast: conn.rippling.connected ? 'Sent again. Rippling answers in the next few minutes.' : 'Queued again. It goes when Rippling is connected.' }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Reimbursements and extra hours (Requests.dc.html 9C, 10D) ───────────────

/**
 * A reimbursement (9C), Super Admins (rq-decide), never their own. Approved:
 * a contractor's waits for their next invoice, which takes it by itself; an
 * employee's goes on their open reimbursement document (a new one when none is
 * open), and Finance hears it is ready to pay. Denied: with the reason.
 */
export async function decideReimbursement(input: { id: number; decision: 'approve' | 'deny'; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-decide')
  if (isFail(v)) return v
  try {
    const c = db()
    const { data: r, error } = await c.from('reimbursements').select('id, person_id, purpose, amount, currency, state').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    if (!r || r.state !== 'pending' || r.person_id === v.personId) return fail(NOT_WAITING)
    const note = reasonOf(input.note)
    const at = new Date().toISOString()
    const dir = await loadDirectory()
    const who = dir.nameOf(r.person_id)
    if (input.decision === 'deny') {
      if (!note) return fail(REASON_REQUIRED)
      const { data: moved, error: e2 } = await c.from('reimbursements').update({ state: 'denied', decided_by: v.personId, decided_at: at, decision_note: note }).eq('id', r.id).eq('state', 'pending').select('id')
      if (e2) return notSaved(e2)
      if (!moved?.length) return fail(NOT_WAITING)
      await announceReimbursementDecided({ id: r.id, personId: r.person_id, deciderId: v.personId, purpose: r.purpose, amount: Number(r.amount), currency: r.currency, approved: false, where: '', note })
      refresh()
      return { ok: true, toast: `Denied. ${first(who)} sees your reason.` }
    }
    const [routes, settings] = await Promise.all([loadRoutes([r.person_id]), loadInvoiceSettings()])
    const contractor = !!routes.get(r.person_id)?.isContractor
    let where = 'It goes on your next invoice by itself.'
    let toast = `Approved. It goes on ${first(who)}'s next invoice by itself.`
    let documentId: number | null = null
    if (!contractor) {
      // The employee's open document, or a new one.
      const { data: open } = await c.from('reimbursement_documents').select('id, number').eq('person_id', r.person_id).eq('state', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle()
      let doc = open
      if (!doc) {
        const { data: number, error: nErr } = await c.rpc('next_document_number', { p_kind: 'rmb' })
        if (nErr || !number) return notSaved(nErr ?? new Error('No document number'))
        const { data: made, error: mErr } = await c.from('reimbursement_documents').insert({ number: number as string, person_id: r.person_id, total: 0, state: 'approved' }).select('id, number').single()
        if (mErr) return notSaved(mErr)
        doc = made
      }
      documentId = doc.id
      where = `It is on reimbursement document ${doc.number}, for Finance to pay.`
      toast = `Approved. It is on ${doc.number} for Finance to pay.`
    }
    const { data: moved, error: e2 } = await c.from('reimbursements').update({ state: 'approved', decided_by: v.personId, decided_at: at, decision_note: note, document_id: documentId }).eq('id', r.id).eq('state', 'pending').select('id')
    if (e2) return notSaved(e2)
    if (!moved?.length) return fail(NOT_WAITING)
    if (documentId) {
      const { data: items } = await c.from('reimbursements').select('amount').eq('document_id', documentId)
      const total = (items ?? []).reduce((n, i) => n + Math.round(Number(i.amount) * 100), 0) / 100
      const { data: doc } = await c.from('reimbursement_documents').update({ total, updated_at: at }).eq('id', documentId).select('number').single()
      if (doc) await announceRmbReady({ documentId, itemId: r.id, number: doc.number, personId: r.person_id, total, finance: settings.finance })
    }
    await announceReimbursementDecided({ id: r.id, personId: r.person_id, deciderId: v.personId, purpose: r.purpose, amount: Number(r.amount), currency: r.currency, approved: true, where, note: null })
    refresh()
    return { ok: true, toast }
  } catch (e) {
    return notSaved(e)
  }
}

/** Extra hours (10D), Super Admins (rq-decide), never their own. Approved, the allowance of that week or month grows by them. */
export async function decideExtraHours(input: { id: number; decision: 'approve' | 'deny'; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('rq-decide')
  if (isFail(v)) return v
  try {
    const c = db()
    const { data: r, error } = await c.from('extra_hours_requests').select('id, person_id, asked_by, hours, period, period_start, client, state').eq('id', Number(input.id)).maybeSingle()
    if (error) return notSaved(error)
    if (!r || r.state !== 'pending' || r.person_id === v.personId) return fail(NOT_WAITING)
    const note = reasonOf(input.note)
    if (input.decision === 'deny' && !note) return fail(REASON_REQUIRED)
    const approve = input.decision === 'approve'
    const { data: moved, error: e2 } = await c.from('extra_hours_requests').update({ state: approve ? 'approved' : 'denied', decided_by: v.personId, decided_at: new Date().toISOString(), decision_note: note })
      .eq('id', r.id).eq('state', 'pending').select('id')
    if (e2) return notSaved(e2)
    if (!moved?.length) return fail(NOT_WAITING)
    const hours = formatDuration(Number(r.hours) * 3600)
    const when = r.period === 'month' ? monthYear(r.period_start) : `the week of ${dayLabel(r.period_start)}`
    await announceExtraDecided({ id: r.id, personId: r.person_id, askedBy: r.asked_by, deciderId: v.personId, hours, when, client: r.client, approved: approve, note })
    refresh()
    const who = first((await loadDirectory()).nameOf(r.person_id))
    return { ok: true, toast: approve ? `Approved. ${who}'s allowance for ${when} grows by ${hours}.` : `Denied. ${who} sees your reason.` }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Timesheets and invoices (Clocky part 2, README_PART2 "Approval routing") ─
//
// The owner of the current step decides: the hours go to whoever the person
// reports to, the invoice to Arnaldo Oliveira or Dave Sharpe; one step when it
// is the same person, for employees (then Rippling) and for fixed with no
// timesheet. Return at any step returns the timesheet and the invoice together
// and tells everyone who approved. Hours over the allowance are decided by the
// invoice approver, with a note. Every decision is a tc_approval_events row.

type SentRow = {
  id: number; person_id: string; state: TimesheetState; hours_approved_by: string | null
  tc_periods: { start_date: string; end_date: string } | null
}

async function loadSent(id: number): Promise<{ id: number; personId: string; state: TimesheetState; hoursBy: string | null; start: string; end: string } | null> {
  const { data, error } = await db().from('tc_submissions').select('id, person_id, state, hours_approved_by, tc_periods(start_date, end_date)').eq('id', Number(id)).maybeSingle()
  if (error) throw new Error(error.message)
  const r = data as unknown as SentRow | null
  return r?.tc_periods ? { id: r.id, personId: r.person_id, state: r.state, hoursBy: r.hours_approved_by, start: r.tc_periods.start_date, end: r.tc_periods.end_date } : null
}

/** A signed-in decider (no access key: the routing says whose decision it is). */
async function decider(): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail(PREVIEW)
  const access = await writerAccess()
  if (!access) return fail(SIGN_IN)
  if (!access.can('clocky-approvals')) return fail(NO_ACCESS)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

/** Hours over the allowance in a timesheet, after the extra hours approved for it. */
async function overFor(personId: string, start: string, end: string): Promise<number> {
  const t = (await loadPayTerms([personId])).get(personId)
  if (!t?.allowance || t.allowance.period !== 'month') return 0
  const [byClient, extra] = await Promise.all([hoursByClient(personId, start, end), loadApprovedExtra([personId], start, end)])
  return allowanceStatus(byClient.reduce((n, x) => n + x.seconds, 0), t.allowance.hours, extra(personId, start, end)).over
}

/** Approve the step that is yours: the hours, the invoice, both, or (employees) send to Rippling. */
export async function approveTimesheet(input: { id: number; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await decider()
  if (isFail(v)) return v
  try {
    const c = db()
    const t = await loadSent(input.id)
    if (!t) return fail(NOT_WAITING)
    const [settings, routes] = await Promise.all([loadInvoiceSettings(), loadRoutes([t.personId])])
    const route = routes.get(t.personId)
    const step = route ? currentStep(route, settings, t.state) : null
    if (!route || !step || step.owner !== v.personId || t.personId === v.personId) return fail(NOT_WAITING)
    const next = stateAfterApprove(route, settings, t.state)!
    const note = reasonOf(input.note)
    // Over the allowance: the invoice approver decides, and says why.
    if (step.step === 'both' || step.step === 'invoice') {
      const over = await overFor(t.personId, t.start, t.end)
      if (over > 0 && !note) return fail(`${formatDuration(over)} over the allowance were not approved in advance. Write a note to approve.`)
    }
    const at = new Date().toISOString()
    const patch = next === 'hours_approved'
      ? { state: next, hours_approved_by: v.personId, hours_approved_at: at }
      : { state: next, approved_by: v.personId, approved_at: at, note: note ?? null }
    const { data: moved, error } = await c.from('tc_submissions').update(patch).eq('id', t.id).eq('state', t.state).select('id')
    if (error) return notSaved(error)
    if (!moved?.length) return fail(NOT_WAITING)
    const { data: inv } = await c.from('invoices').select('id, number, total').eq('submission_id', t.id).maybeSingle()
    if (next === 'approved') {
      if (inv) await c.from('invoices').update({ state: 'approved', approved_by: v.personId, approved_at: at, updated_at: at }).eq('id', inv.id).eq('state', 'waiting')
      await c.from('tc_entries').update({ state: 'approved', updated_at: at })
        .eq('person_id', t.personId).eq('state', 'submitted').eq('source', 'portal').gte('entry_date', t.start).lte('entry_date', t.end)
      // Employees: the hours and the time off go to Rippling (the outbox sends them, or waits for the connection).
      if (!route.isContractor) await queueRipplingHours(t.id, t.personId, t.start, t.end)
    }
    await c.from('tc_approval_events').insert({ submission_id: t.id, invoice_id: inv?.id ?? null, step: step.step, action: 'approve', by_person: v.personId, at, note })
    const dir = await loadDirectory()
    const label = periodLabel(t).full
    const ib = invoiceApprover(route, settings)
    if (next === 'hours_approved' && ib && inv) {
      await announceHoursApproved({ submissionId: t.id, at, personId: t.personId, hoursBy: v.personId, invoiceBy: ib, month: periodLabel(t).label, number: inv.number, total: usd(Number(inv.total)) })
    } else {
      await announceTimesheetDecided({ submissionId: t.id, at, personId: t.personId, deciderId: v.personId, period: label, how: 'approve', note: null })
    }
    // Approved with its invoice: Finance hears it is ready to pay.
    if (next === 'approved' && inv) await announceInvoiceApproved({ invoiceId: inv.id, personId: t.personId, number: inv.number, total: usd(Number(inv.total)), finance: settings.finance })
    refresh()
    const who = dir.nameOf(t.personId)
    const toast = next === 'hours_approved'
      ? `Hours approved. ${ib ? dir.nameOf(ib) : 'The invoice approver'} finishes the approval.`
      : !route.isContractor ? 'Approved and sent to Rippling.'
        : step.step === 'invoice' ? `Invoice approved. ${label} is locked${inv ? ` and ${inv.number} is Approved for Finance` : ''}.`
          : `Approved both. ${label} is locked${inv ? ` and ${inv.number} is Approved for Finance` : ''}.`
    void who
    return { ok: true, toast }
  } catch (e) {
    return notSaved(e)
  }
}

/** Return it at any step: the timesheet reopens, the invoice goes back to Draft, everyone who approved is told. */
export async function returnTimesheet(input: { id: number; reason: string }): Promise<Result<{ toast: string }>> {
  const v = await decider()
  if (isFail(v)) return v
  try {
    const c = db()
    const t = await loadSent(input.id)
    if (!t) return fail(NOT_WAITING)
    const [settings, routes] = await Promise.all([loadInvoiceSettings(), loadRoutes([t.personId])])
    const route = routes.get(t.personId)
    const step = route ? currentStep(route, settings, t.state) : null
    if (!route || !step || step.owner !== v.personId || t.personId === v.personId) return fail(NOT_WAITING)
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const at = new Date().toISOString()
    const { data: moved, error } = await c.from('tc_submissions').update({ state: 'returned', approved_by: v.personId, approved_at: at, note: reason }).eq('id', t.id).eq('state', t.state).select('id')
    if (error) return notSaved(error)
    if (!moved?.length) return fail(NOT_WAITING)
    const { data: inv } = await c.from('invoices').select('id').eq('submission_id', t.id).maybeSingle()
    if (inv) {
      await c.from('invoices').update({ state: 'draft', approved_by: null, approved_at: null, updated_at: at }).eq('id', inv.id)
      // Its reimbursements wait for the invoice made again.
      await c.from('reimbursements').update({ state: 'approved', invoice_id: null }).eq('invoice_id', inv.id).eq('state', 'on_invoice')
    }
    await c.from('tc_entries').update({ state: 'open', updated_at: at })
      .eq('person_id', t.personId).eq('state', 'submitted').eq('source', 'portal').gte('entry_date', t.start).lte('entry_date', t.end)
    await c.from('tc_approval_events').insert({ submission_id: t.id, invoice_id: inv?.id ?? null, step: step.step, action: 'return', by_person: v.personId, at, note: reason })
    const label = periodLabel(t).full
    await announceTimesheetDecided({ submissionId: t.id, at, personId: t.personId, deciderId: v.personId, period: label, how: 'return', note: reason })
    // Whoever approved the hours before hears it went back.
    if (t.hoursBy && t.hoursBy !== v.personId) await announceTimesheetDecided({ submissionId: t.id, at: `${at}:h`, personId: t.hoursBy, deciderId: v.personId, period: label, how: 'return', note: reason })
    refresh()
    const dir = await loadDirectory()
    return { ok: true, toast: `Returned to ${dir.nameOf(t.personId)}. They see your reason.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** Reopen an approved timesheet (Super Admins): it unlocks, the invoice goes back to Draft. */
export async function reopenTimesheet(input: { id: number; reason: string }): Promise<Result<{ toast: string }>> {
  const v = await actor('ck-reopen')
  if (isFail(v)) return v
  if (!canReopen(v)) return fail('Only a Super Admin can reopen a period.')
  try {
    const c = db()
    const t = await loadSent(input.id)
    if (!t || (t.state !== 'approved' && t.state !== 'recorded')) return fail('That timesheet is not approved, so there is nothing to reopen.')
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const at = new Date().toISOString()
    const { data: moved, error } = await c.from('tc_submissions').update({ state: 'returned', approved_by: v.personId, approved_at: at, note: reason }).eq('id', t.id).eq('state', t.state).select('id')
    if (error) return notSaved(error)
    if (!moved?.length) return fail('That timesheet is not approved, so there is nothing to reopen.')
    const { data: inv } = await c.from('invoices').select('id, state').eq('submission_id', t.id).maybeSingle()
    if (inv?.state === 'paid') {
      await c.from('tc_submissions').update({ state: t.state }).eq('id', t.id)
      return fail('Its invoice is already paid, so the timesheet stays as it is.')
    }
    if (inv) {
      await c.from('invoices').update({ state: 'draft', approved_by: null, approved_at: null, updated_at: at }).eq('id', inv.id)
      await c.from('reimbursements').update({ state: 'approved', invoice_id: null }).eq('invoice_id', inv.id).eq('state', 'on_invoice')
    }
    await c.from('tc_entries').update({ state: 'open', updated_at: at })
      .eq('person_id', t.personId).in('state', ['submitted', 'approved']).eq('source', 'portal').gte('entry_date', t.start).lte('entry_date', t.end)
    await c.from('tc_approval_events').insert({ submission_id: t.id, invoice_id: inv?.id ?? null, step: 'both', action: 'reopen', by_person: v.personId, at, note: reason })
    await audit(c, [{ entryId: null, action: 'reopen', by: v.personId, reason, after: { person_id: t.personId, start: t.start, end: t.end } }])
    await announceTimesheetDecided({ submissionId: t.id, at, personId: t.personId, deciderId: v.personId, period: periodLabel(t).full, how: 'reopen', note: reason })
    refresh()
    const dir = await loadDirectory()
    return { ok: true, toast: `${periodLabel(t).full} is open again for ${first(dir.nameOf(t.personId))}.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** Fixed, no timesheet: the invoice alone, one step, its approver. */
export async function decideInvoice(input: { id: number; decision: 'approve' | 'return'; note?: string }): Promise<Result<{ toast: string }>> {
  const v = await decider()
  if (isFail(v)) return v
  try {
    const c = db()
    const { data: inv, error: e1 } = await c.from('invoices').select('id, number, person_id, state, kind, total, period_start, period_end').eq('id', Number(input.id)).maybeSingle()
    if (e1) return notSaved(e1)
    if (!inv || inv.kind !== 'fixed_no_timesheet' || inv.state !== 'waiting') return fail(NOT_WAITING)
    const [settings, routes] = await Promise.all([loadInvoiceSettings(), loadRoutes([inv.person_id])])
    const route = routes.get(inv.person_id)
    if (!route || invoiceApprover(route, settings) !== v.personId || inv.person_id === v.personId) return fail(NOT_WAITING)
    const note = reasonOf(input.note)
    if (input.decision === 'return' && !note) return fail(REASON_REQUIRED)
    const at = new Date().toISOString()
    const approve = input.decision === 'approve'
    const { data: moved, error } = await c.from('invoices')
      .update(approve ? { state: 'approved', approved_by: v.personId, approved_at: at, updated_at: at } : { state: 'draft', approved_by: v.personId, approved_at: at, updated_at: at, paid_note: note })
      .eq('id', inv.id).eq('state', 'waiting').select('id')
    if (error) return notSaved(error)
    if (!moved?.length) return fail(NOT_WAITING)
    await c.from('tc_approval_events').insert({ submission_id: null, invoice_id: inv.id, step: 'invoice', action: approve ? 'approve' : 'return', by_person: v.personId, at, note })
    if (approve) await announceInvoiceApproved({ invoiceId: inv.id, personId: inv.person_id, number: inv.number, total: usd(Number(inv.total)), finance: settings.finance })
    refresh()
    return { ok: true, toast: approve ? `Approved. ${inv.number} waits for Finance to pay it.` : `Returned. ${inv.number} is back to Draft.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** Queues an employee's approved hours for Rippling (the outbox sends them, or waits for the connection). */
async function queueRipplingHours(submissionId: number, personId: string, start: string, end: string): Promise<void> {
  try {
    await enqueue({ kind: 'rippling_hours', refTable: 'tc_submissions', refId: submissionId, payload: { person_id: personId, start, end }, key: `rippling_hours:${submissionId}:${start}` })
  } catch (e) {
    console.error('[clocky approvals] rippling queue:', e instanceof Error ? e.message : e)
  }
}

/** "Try again" when Rippling refused an approved pay period: the job goes back in the queue. */
export async function retryRippling(input: { submissionId: number }): Promise<Result<{ toast: string }>> {
  const v = await decider()
  if (isFail(v)) return v
  try {
    const t = await loadSent(input.submissionId)
    if (!t || t.state !== 'approved') return fail('That pay period is not approved.')
    const [settings, routes] = await Promise.all([loadInvoiceSettings(), loadRoutes([t.personId])])
    const route = routes.get(t.personId)
    if (!route || route.isContractor || !(v.isSuperAdmin || hoursApprover(route, settings) === v.personId)) return fail(NO_ACCESS)
    await retryJobs('tc_submissions', t.id, ['rippling_hours'])
    const conn = await loadConnections()
    refresh()
    return { ok: true, toast: conn.rippling.connected ? 'Sent to Rippling again. It shows here in a moment.' : 'Rippling is not connected yet: it goes as soon as it is, in Company settings.' }
  } catch (e) {
    return notSaved(e)
  }
}
