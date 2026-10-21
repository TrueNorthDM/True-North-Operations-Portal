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
import { announceCorrectionDecided, announceTimeOffDecided } from '@/lib/timeclock/clocky-notify'
import { REASON_REQUIRED, approveOverlapLine, reasonOf } from '@/lib/timeclock/entry-rules'
import { formatDuration, recordedSeconds, roundSeconds } from '@/lib/timeclock/rounding'
import { workingDays } from '@/lib/timeclock/absence'
import { lockedMessage } from '@/lib/timeclock/periods'
import { canApproveCorrection, canDecideTimeOff } from '@/lib/timeclock/scope'
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
 * Approve or deny time off (Super Admins, 3J). Approving writes its entries,
 * one per working day, and is refused when a day sits in a locked period
 * (audit finding N8); denying needs a reason.
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
    const days = workingDays(r.start_date, r.end_date)
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
    }
    // The person hears of it (the card's toast promises so).
    await announceTimeOffDecided({
      id: r.id, person_id: r.person_id, start_date: r.start_date, end_date: r.end_date,
      kind: (await loadCatalog()).jobs.get(r.jobcode_id)?.short ?? 'Time off',
      seconds: Math.round(days.length * Number(r.hours_per_day) * 3600),
    }, v.personId, input.decision === 'approve', note)
    refresh()
    return { ok: true }
  } catch (e) {
    return notSaved(e)
  }
}
