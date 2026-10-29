'use server'

/**
 * Time entries (design handoff of 16 October 2026, SPEC sections 8 and 9,
 * Time Entries.dc.html): the list of a period, an entry's history, adding,
 * editing and deleting hours, the overlap fix, the week grid, the time
 * correction request, and submitting and reopening a period.
 *
 * The rules, enforced here and not only on the screen (README "Rules"):
 *   - every time saved is on the quarter hour; a typed duration rounds too;
 *   - every change needs a reason, kept in the entry's history;
 *   - a User only shortens their own entries (start later, end earlier) and
 *     fixes their details; more time comes through a time correction request;
 *   - Team Leaders change their teams' hours, not their own (the same as a
 *     User there); Admins and Super Admins anyone's (lib/timeclock/scope.ts);
 *   - nobody's hours go past their allowance plus the extra hours approved,
 *     whoever adds them (owner, 25 October 2026; allowance-limit.ts);
 *   - no overlaps, no entry over 24 hours;
 *   - a submitted or approved period is locked for everyone; a Super Admin
 *     reopens it first.
 *
 * Writes are for the person really signed in (writerAccess: a verified
 * session, never a View Stage preview) and go through the privileged client.
 * Each returns { ok: true, ... } or { ok: false, error } with a sentence.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, keysOfJob, loadCatalog, loadDirectory, viewerFor, type Catalog, type Viewer } from '@/lib/timeclock/clocky-context'
import { activityNeedsNotes, offeredOn, structureOn } from '@/lib/timeclock/entry-rules'
import {
  audit, cleanFields, cleanNotes, loadEntry, loadSubmissions, lockOn, overlapFor, rewriteSpan, snapshot, type EntryRow,
} from '@/lib/timeclock/clocky-store'
import { correctionHistory, entryHistory, loadEntries, loadSubmitSummary, type EntriesQuery } from '@/lib/timeclock/clocky-entries'
import { correctionGoesTo, loadChoicesFor } from '@/lib/timeclock/clocky-panel'
import { announceCorrectionRequested, announceInvoiceMade, announceTimesheetSubmitted } from '@/lib/timeclock/clocky-notify'
import { usd } from '@/lib/timeclock/invoice-doc'
import { dayLabel, localDate, weekdayShort } from '@/lib/timeclock/format'
import { formatDuration, parseDuration, recordedSeconds, roundIso, roundSeconds, runningSeconds } from '@/lib/timeclock/rounding'
import {
  DAY_SECONDS, DURATION_FORMAT, END_AFTER_START, NOTHING_LEFT, OVER_24H, REASON_REQUIRED, correctionOverlapLine, instantOf,
  overlapLine, reasonOf, trimOther, trimThis,
} from '@/lib/timeclock/entry-rules'
import { changesBetween } from '@/lib/timeclock/history'
import { addDays, isSent, lockedMessage, periodLabel } from '@/lib/timeclock/periods'
import { loadRouteSettings, loadRoutes } from '@/lib/timeclock/pay-terms'
import { currentStep, stateOnSubmit } from '@/lib/timeclock/routing'
import { invoiceBlocker, makeInvoiceForSubmission } from '@/lib/timeclock/invoices-data'
import { SHORTEN_ONLY, canAddFor, changeRight, isLeader, onlyShorter } from '@/lib/timeclock/scope'
import { limitRefusal } from '@/lib/timeclock/allowance-limit'
import type { ClockPanelData, EntriesData, Fail, HistoryData, OverlapInfo, Result, SubmitSummary } from '@/lib/timeclock/clocky-types'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const PREVIEW = 'View Stage is only a preview. Close it to change hours.'
const SIGN_IN = 'Sign in again to save.'
const NO_ACCESS = 'North Time is not open to your access.'
const NOT_YOURS = "That person's hours are not yours to change."
const GONE = 'That entry is not there any more.'
const PICK_JOB = 'Pick a job code.'
/** The week grid's note for a User (exact copy), also the refusal of "Add time" to a User. */
const USER_NO_ADD = 'Hours come from your clock. To add time, ask your Team Leader.'
/** The same to a Team Leader adding to their own hours (owner, 25 October 2026: "só as do time"). */
const LEADER_NO_ADD = 'Hours come from your clock. For missing time of your own, use Request to add time.'
const noAddOwn = (v: Viewer) => (isLeader(v) ? LEADER_NO_ADD : USER_NO_ADD)
/** Whose limit a refusal names: nobody for one's own hours ("your"), else the person. */
const whose = (v: Viewer, personId: string, dir: { nameOf: (id: string) => string }) => (personId === v.personId ? null : dir.nameOf(personId))

const fail = (error: string, extra: Omit<Fail, 'ok' | 'error'> = {}): Fail => ({ ok: false, error, ...extra })
function notSaved(e: unknown): Fail {
  console.error('[clocky entries]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false
const refresh = () => { revalidatePath('/clocky-hours'); revalidatePath('/hours') }

async function actor(key = 'clocky-hours'): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail(PREVIEW)
  const access = await writerAccess()
  if (!access) return fail(SIGN_IN)
  if (!access.can(key)) return fail(NO_ACCESS)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

async function reader(key = 'clocky-hours'): Promise<Viewer | Fail> {
  const access = await loadAccess()
  if (!access.can(key)) return fail(NO_ACCESS)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}


// ── Reading ─────────────────────────────────────────────────────────────────

/** The list, the totals and Needs attention for a period and the viewer's scope (3A, 3D). */
export async function getEntries(query: EntriesQuery): Promise<Result<{ data: EntriesData }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    return { ok: true, data: await loadEntries(v, query, new Date()) }
  } catch (e) {
    console.error('[clocky entries] list:', (e as Error).message)
    return fail('The entries could not be read. Try again in a moment.')
  }
}

/** An entry's history, newest first (3G). */
export async function getEntryHistory(input: { id: number }): Promise<Result<{ data: HistoryData }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    const data = await entryHistory(v, Number(input.id), new Date())
    return data ? { ok: true, data } : fail(GONE)
  } catch (e) {
    console.error('[clocky entries] history:', (e as Error).message)
    return fail('The history could not be read. Try again in a moment.')
  }
}

/**
 * The saved combinations and recent choices of a person the viewer adds for:
 * the week grid's Add row on their week lists theirs, not the viewer's (owner,
 * 28 October 2026).
 */
export async function getChoicesFor(input: { personId: string }): Promise<Result<{ data: Pick<ClockPanelData, 'combinations' | 'recents'> }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    const dir = await loadDirectory()
    const personId = String(input.personId ?? '')
    if (!dir.people.has(personId) || !canAddFor(v, dir.target(personId))) return fail(NOT_YOURS)
    return { ok: true, data: await loadChoicesFor(personId, dir.zoneOf(personId), new Date()) }
  } catch (e) {
    console.error('[clocky entries] choices:', (e as Error).message)
    return fail('Their combinations could not be read. Try again in a moment.')
  }
}

/** A time correction request's history (3G on a pending or denied correction row). */
export async function getCorrectionHistory(input: { id: number }): Promise<Result<{ data: HistoryData }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    const data = await correctionHistory(v, Number(input.id), new Date())
    return data ? { ok: true, data } : fail('That request is not there any more.')
  } catch (e) {
    console.error('[clocky entries] request history:', (e as Error).message)
    return fail('The history could not be read. Try again in a moment.')
  }
}

/** The viewer's own period to submit (3H): the current one, or the one holding `start`. */
export async function getSubmitSummary(input: { start?: string } = {}): Promise<Result<{ data: SubmitSummary }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    return { ok: true, data: await loadSubmitSummary(v, new Date(), input.start) }
  } catch (e) {
    console.error('[clocky entries] submit summary:', (e as Error).message)
    return fail('The period could not be read. Try again in a moment.')
  }
}

// ── Times as a form sends them ──────────────────────────────────────────────

export interface TimesInput {
  /** YYYY-MM-DD, in the entry owner's time zone. */
  date: string
  mode: 'range' | 'duration'
  /** "HH:MM" on a 24-hour clock, the owner's zone (15-minute steps; rounded anyway). */
  start?: string
  /** "HH:MM", or "now" to keep a running entry running. */
  end?: string
  /** "2h 30m", "2:30" or "2.5". */
  duration?: string
}

export interface EntryInput extends TimesInput {
  jobcodeId: number
  fields?: Record<string, string>
  notes?: string
  reason: string
  /** 3F: save anyway by trimming the other entry, or this one. */
  fix?: { otherId: number; trim: 'other' | 'this' }
}

type Span = { kind: 'range'; start: string; end: string | null } | { kind: 'duration'; seconds: number }

const hhmm = (t: string | undefined) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim())
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

function parseTimes(t: TimesInput, zone: string, now: Date, allowNow: boolean): Span | Fail {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date ?? ''))) return fail('Pick a date.')
  if (t.mode === 'duration') {
    const raw = parseDuration(String(t.duration ?? ''))
    if (Number.isNaN(raw) || raw <= 0) return fail(DURATION_FORMAT)
    const seconds = roundSeconds(raw)
    if (seconds <= 0) return fail(DURATION_FORMAT)
    if (seconds > DAY_SECONDS) return fail(OVER_24H)
    return { kind: 'duration', seconds }
  }
  const s = hhmm(t.start)
  const startAt = s ? instantOf(t.date, s, zone) : null
  if (!startAt) return fail('Pick a start time.')
  const start = roundIso(startAt)
  if (t.end === 'now') {
    if (!allowNow) return fail('Pick an end time.')
    if (Date.parse(start) > now.getTime()) return fail('It cannot be later than now.')
    return { kind: 'range', start, end: null }
  }
  const e = hhmm(t.end)
  // An end of 12:00 AM is the midnight that closes the day, as the form reads it (formSpan).
  const endAt = e ? instantOf(e === '00:00' ? addDays(t.date, 1) : t.date, e, zone) : null
  if (!endAt) return fail('Pick an end time.')
  const end = roundIso(endAt)
  if (Date.parse(end) <= Date.parse(start)) return fail(END_AFTER_START)
  if (recordedSeconds(start, end) > DAY_SECONDS) return fail(OVER_24H)
  return { kind: 'range', start, end }
}

const overlapInfo = (o: Awaited<ReturnType<typeof overlapFor>>, catalog: Catalog): OverlapInfo | undefined =>
  o ? {
    entryId: o.other.row.id, name: catalog.jobs.get(o.other.row.jobcode_id ?? -1)?.short ?? '',
    start: o.other.row.started_at!, end: o.other.row.ended_at, sharedStart: o.start, sharedEnd: o.end,
  } : undefined

/**
 * The overlap check (3E's red line), and 3F's fix when one was chosen: trim
 * the other entry or this one (the span that comes back). Trimming the other
 * comes back as `trimOther`, which the caller runs, with the same reason, only
 * once its own write went through: a refused or failed save leaves the other
 * entry as it was. Never saves an overlap.
 */
async function resolveOverlap(
  v: Viewer, personId: string, span: { start: string; end: string | null }, exclude: number[],
  fix: EntryInput['fix'], reason: string, now: Date,
): Promise<{ start: string; end: string | null; trimOther?: () => Promise<void> } | Fail> {
  const c = db()
  const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
  const zone = dir.zoneOf(personId)
  const o = await overlapFor(c, personId, span, exclude, now)
  if (!o) return span
  const seconds = recordedSeconds(span.start, span.end ?? roundIso(now))
  const refuse = (x: typeof o) => fail(overlapLine(seconds, x!, overlapInfo(x, catalog)!.name, zone), { overlap: overlapInfo(x, catalog) })
  if (!fix || Number(fix.otherId) !== o.other.row.id) return refuse(o)

  const other = o.other.row
  if (fix.trim === 'this') {
    if (!span.end) return refuse(o)
    const r = trimThis({ start: span.start, end: span.end }, { start: other.started_at!, end: other.ended_at ?? roundIso(now) })
    if (!r) return fail(NOTHING_LEFT)
    const again = await overlapFor(c, personId, r, exclude, now)
    return again ? refuse(again) : r
  }
  // Trim the other: it must be finished, open to the viewer, and not locked.
  if (!other.ended_at || !span.end) return refuse(o)
  if (changeRight(v, dir.target(personId)) === 'none') return fail(NOT_YOURS)
  const lock = lockOn([other.entry_date], (await loadSubmissions(c, [personId])).get(personId) ?? [], other.state)
  if (lock) return fail(lockedMessage(lock))
  const r = trimOther({ start: span.start, end: span.end }, { start: other.started_at!, end: other.ended_at })
  if (!r) return fail(NOTHING_LEFT)
  // Trimmed, the other no longer meets this span: anything else still would.
  const again = await overlapFor(c, personId, span, [...exclude, other.id], now)
  if (again) return refuse(again)
  return {
    ...span,
    trimOther: async () => {
      const at = new Date().toISOString()
      await rewriteSpan(c, other, r.start, r.end, zone, {
        edited_by: v.personId, edited_at: at, ...(other.source === 'tsheets' ? { changed_here_at: at } : {}),
      })
      await audit(c, [{
        entryId: other.id, action: 'trim', by: v.personId, reason,
        before: snapshot(other, catalog), after: snapshot({ ...other, started_at: r.start, ended_at: r.end, duration_seconds: recordedSeconds(r.start, r.end) }, catalog),
      }])
    },
  }
}

// ── Add, edit, delete (3E, 3F, 3I) ──────────────────────────────────────────

/** "Add time": Team Leaders (their teams, not themselves), Admins and Super Admins (anyone, themselves included), with a reason. */
export async function addTime(input: EntryInput & { personId: string }): Promise<Result<{ entryId: number; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const personId = String(input.personId ?? '')
    if (!dir.people.has(personId)) return fail(NOT_YOURS)
    if (!canAddFor(v, dir.target(personId))) return fail(personId === v.personId ? noAddOwn(v) : NOT_YOURS)
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const job = catalog.jobs.get(Number(input.jobcodeId))
    if (!offeredOn(job, String(input.date ?? ''), catalog.switchDate)) return fail(PICK_JOB)
    const f = cleanFields(input.fields, catalog, job)
    if ('error' in f) return fail(f.error)
    const zone = dir.zoneOf(personId)
    const times = parseTimes(input, zone, now, false)
    if (isFail(times)) return times

    const lock = lockOn([input.date], (await loadSubmissions(c, [personId])).get(personId) ?? [])
    if (lock) return fail(lockedMessage(lock))

    let start: string | null = null
    let end: string | null = null
    let seconds: number
    let trimOther: (() => Promise<void>) | undefined
    if (times.kind === 'range') {
      const r = await resolveOverlap(v, personId, { start: times.start, end: times.end }, [], input.fix, reason, now)
      if (isFail(r)) return r
      start = r.start
      end = r.end
      trimOther = r.trimOther
      seconds = recordedSeconds(start, end!)
    } else {
      seconds = times.seconds
    }
    const limit = await limitRefusal(personId, { add: [{ day: start ? localDate(start, zone) : input.date, seconds }] }, now, whose(v, personId, dir))
    if (limit) return fail(limit)
    const at = now.toISOString()
    const { data, error } = await c.from('tc_entries').insert({
      person_id: personId, jobcode_id: job.id, started_at: start, ended_at: end, duration_seconds: seconds,
      entry_date: start ? localDate(start, zone) : input.date, kind: start ? 'clock' : 'manual', state: 'open', source: 'portal',
      fields: f.fields, notes: cleanNotes(input.notes), created_by: v.personId,
      ...(personId !== v.personId ? { edited_by: v.personId, edited_at: at } : {}),
    }).select('*').single()
    if (error) return notSaved(error)
    const e = data as EntryRow
    await trimOther?.()
    await audit(c, [{ entryId: e.id, action: 'add', by: v.personId, reason, after: snapshot(e, catalog) }])
    refresh()
    return { ok: true, entryId: e.id, toast: `Added ${formatDuration(seconds)} on ${dayLabel(e.entry_date)}.` }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * "Edit entry", with a reason. A User on their own entry: the date and the
 * kind stay, the times only move inward (SHORTEN_ONLY). Editing an automatic
 * stop that was not confirmed confirms it. A running entry stays running
 * (end "now").
 */
export async function editEntry(input: EntryInput & { id: number }): Promise<Result<{ entryId: number; changes: number; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const e = await loadEntry(c, Number(input.id))
    if (!e) return fail(GONE)
    if (e.kind === 'absence') return fail('Time off changes through its request.')
    const right = changeRight(v, dir.target(e.person_id))
    if (right === 'none') return fail(NOT_YOURS)
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const zone = dir.zoneOf(e.person_id)
    const running = e.ended_at === null && e.kind === 'clock' && !!e.started_at

    const subs = (await loadSubmissions(c, [e.person_id])).get(e.person_id) ?? []
    const lock = lockOn([e.entry_date, input.date], subs, e.state)
    if (lock) return fail(lockedMessage(lock))

    const jobId = Number(input.jobcodeId)
    const job = catalog.jobs.get(jobId)
    const day = String(input.date ?? e.entry_date)
    // Its own job stays even if no longer offered (an old imported entry), but not moved to a day
    // of the other structure: a TSheets job is not recorded from the switch date, nor a 2026 project before it.
    const sameJob = jobId === e.jobcode_id
    if (!job || (sameJob ? day !== e.entry_date && job.structure !== structureOn(day, catalog.switchDate) : !offeredOn(job, day, catalog.switchDate))) return fail(PICK_JOB)
    const current = (e.fields ?? {}) as Record<string, string>
    const f = cleanFields(input.fields, catalog, job, current)
    if ('error' in f) return fail(f.error)

    const times = parseTimes(input, zone, now, running)
    if (isFail(times)) return times
    if (running && (times.kind !== 'range' || times.end !== null)) return fail('Clock out first. Your clock is running.')

    const before = { start: e.started_at, end: e.ended_at, seconds: e.duration_seconds }
    const after = times.kind === 'range'
      ? { start: times.start, end: times.end, seconds: times.end ? recordedSeconds(times.start, times.end) : 0 }
      : { start: null, end: null, seconds: times.seconds }
    if (right === 'shorten' && (input.date !== e.entry_date || !onlyShorter(before, after))) return fail(SHORTEN_ONLY)

    let start = after.start
    let end = after.end
    let trimOther: (() => Promise<void>) | undefined
    if (times.kind === 'range') {
      const r = await resolveOverlap(v, e.person_id, { start: times.start, end: times.end }, [e.id], input.fix, reason, now)
      if (isFail(r)) return r
      start = r.start
      end = r.end
      trimOther = r.trimOther
      if (right === 'shorten' && !onlyShorter(before, { start, end, seconds: end ? recordedSeconds(start, end) : 0 })) return fail(SHORTEN_ONLY)
    }
    const next: Partial<EntryRow> = {
      started_at: start,
      ended_at: end,
      duration_seconds: start && end ? recordedSeconds(start, end) : start ? 0 : after.seconds,
      entry_date: start ? localDate(start, zone) : input.date,
      jobcode_id: job.id,
      fields: f.fields,
      notes: cleanNotes(input.notes),
      kind: start ? 'clock' : 'manual',
    }
    // Both structures' fields: a change of a 2026 project's Activity alone is a change, and it is saved.
    const changes = changesBetween(snapshot(e, catalog), snapshot({ ...e, ...next }, catalog), [catalog.keys, catalog.keys2026], zone)
    if (!changes.length) {
      // This entry stays, but the other was picked to give way: that still happens.
      if (trimOther) { await trimOther(); refresh() }
      return { ok: true, entryId: e.id, changes: 0, toast: 'Saved. Nothing changed.' }
    }
    // Longer, or moved to another week or month: not past the person's allowance.
    const counts = start && !end ? runningSeconds(start, now) : next.duration_seconds!
    const limit = await limitRefusal(e.person_id, { add: [{ day: next.entry_date!, seconds: counts }], exclude: [e.id] }, now, whose(v, e.person_id, dir))
    if (limit) return fail(limit)

    const at = now.toISOString()
    const confirm = e.auto_stopped_at && !e.end_confirmed_at ? { end_confirmed_at: at, end_confirmed_by: v.personId } : {}
    const { error } = await c.from('tc_entries').update({
      ...next, updated_at: at, edited_by: v.personId, edited_at: at, ...confirm,
      ...(e.source === 'tsheets' ? { changed_here_at: at } : {}),
    }).eq('id', e.id)
    if (error) return error.code === '23505' ? fail('You are already clocked in. Stop that one first.') : notSaved(error)
    await trimOther?.()
    if ('end_confirmed_at' in confirm) {
      await c.from('tc_safety_events').update({ confirmed_end_at: end, confirmed_at: at }).eq('entry_id', e.id).eq('kind', 'auto_stop')
    }
    await audit(c, [{ entryId: e.id, action: 'edit', by: v.personId, reason, before: snapshot(e, catalog), after: snapshot({ ...e, ...next }, catalog) }])
    refresh()
    const n = changes.length
    return { ok: true, entryId: e.id, changes: n, toast: `Saved. ${n} change${n > 1 ? 's' : ''} kept in the history.` }
  } catch (e) {
    return notSaved(e)
  }
}

/** "Delete this entry?" with a reason (3I), kept in the trail with the entry as it was. */
export async function deleteEntry(input: { id: number; reason: string }): Promise<Result<{ toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const e = await loadEntry(c, Number(input.id))
    if (!e) return fail(GONE)
    if (e.kind === 'absence') return fail('Time off changes through its request.')
    if (changeRight(v, dir.target(e.person_id)) === 'none') return fail(NOT_YOURS)
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const lock = lockOn([e.entry_date], (await loadSubmissions(c, [e.person_id])).get(e.person_id) ?? [], e.state)
    if (lock) return fail(lockedMessage(lock))
    const { error, count } = await c.from('tc_entries').delete({ count: 'exact' }).eq('id', e.id)
    if (error) return notSaved(error)
    if (!count) return fail(GONE)
    await audit(c, [{ entryId: null, action: 'delete', by: v.personId, reason, before: { ...snapshot(e, catalog), id: e.id, person_id: e.person_id } }])
    refresh()
    return { ok: true, toast: 'Entry deleted. The reason is kept in the change log.' }
  } catch (e) {
    return notSaved(e)
  }
}

// ── The week grid (3B) ──────────────────────────────────────────────────────

export interface GridRowInput {
  jobcodeId: number
  /** The row's fields (Activity names the row with the job). */
  fields?: Record<string, string>
  /** YYYY-MM-DD -> what was typed ("2:30", "2.5", "" to clear). Only the cells changed. */
  cells: Record<string, string>
}

/**
 * Save the hours typed in the week grid (leaders, for the people they manage),
 * with a reason. A cell is a duration-only entry for its row (job and
 * Activity) and day, rounded to the quarter hour; saving a cell replaces what
 * the grid saved there before. Cells with clocked entries, imported ones and
 * locked days cannot be typed into; no day may pass 24 hours.
 */
export async function saveWeekGrid(input: { personId: string; weekStart: string; rows: GridRowInput[]; reason: string }): Promise<Result<{ weekSeconds: number; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const personId = String(input.personId ?? '')
    if (!dir.people.has(personId)) return fail(NOT_YOURS)
    if (!canAddFor(v, dir.target(personId))) return fail(personId === v.personId ? noAddOwn(v) : NOT_YOURS)
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.weekStart ?? ''))) return fail('Pick a week.')
    const days = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i))
    const { data, error } = await c.from('tc_entries').select('*').eq('person_id', personId).gte('entry_date', days[0]).lte('entry_date', days[6])
    if (error) return notSaved(error)
    const week = (data ?? []) as EntryRow[]
    const subs = (await loadSubmissions(c, [personId])).get(personId) ?? []
    // A row is its job and Activity, as the grid shows it: a 2026 project's Activity is its own field.
    const keyOf = (jobcode: number | null, fields: Record<string, string>) => {
      const k = keysOfJob(catalog, catalog.jobs.get(jobcode ?? -1))
      return `${jobcode}|${k.activity ? fields[k.activity] ?? '' : ''}`
    }
    const gridOwned = (e: EntryRow) => e.kind === 'manual' && e.source === 'portal' && !e.manual_batch

    type Change = { day: string; key: string; seconds: number; jobcodeId: number; fields: Record<string, string>; replace: EntryRow[] }
    const changes: Change[] = []
    for (const row of input.rows ?? []) {
      const job = catalog.jobs.get(Number(row.jobcodeId))
      if (!job) return fail(PICK_JOB)
      // A row's fields come from an entry of the week (or a combination): values it already carries stay valid.
      const typedKey = keyOf(job.id, (row.fields ?? {}) as Record<string, string>)
      const source = week.find(e => keyOf(e.jobcode_id, (e.fields ?? {}) as Record<string, string>) === typedKey)
      const f = cleanFields(row.fields, catalog, job, (source?.fields ?? {}) as Record<string, string>)
      if ('error' in f) return fail(f.error)
      const key = keyOf(job.id, f.fields)
      // "Other" and "Meeting: Other" ask for Notes, and a grid cell has none (audit, 29 October 2026).
      const actKey = keysOfJob(catalog, job).activity
      const needsNotes = activityNeedsNotes(actKey ? f.fields[actKey] ?? '' : '')
      for (const [day, typed] of Object.entries(row.cells ?? {})) {
        if (!days.includes(day)) continue
        const raw = parseDuration(String(typed ?? ''))
        if (Number.isNaN(raw)) return fail(`Use "2:30" or "2.5" in ${weekdayShort(day)}.`)
        const seconds = roundSeconds(raw)
        const here = week.filter(e => e.entry_date === day && keyOf(e.jobcode_id, (e.fields ?? {}) as Record<string, string>) === key)
        const mine = here.filter(gridOwned)
        if (mine.reduce((s, e) => s + e.duration_seconds, 0) === seconds) continue
        if (here.some(e => !gridOwned(e))) {
          return fail('Cells with a clock come from clocked entries; change those in the List or the Day timeline.')
        }
        const lock = lockOn([day], subs, null)
        if (lock || mine.some(e => lockOn([day], subs, e.state))) return fail(lockedMessage(lock ?? { start: day, end: day }))
        if (seconds > 0 && !offeredOn(job, day, catalog.switchDate)) return fail(PICK_JOB)
        if (seconds > 0 && needsNotes) return fail(`${actKey ? f.fields[actKey] : 'This Activity'} asks for Notes, which the grid has no place for. Add that time with Add time.`)
        changes.push({ day, key, seconds, jobcodeId: job.id, fields: f.fields, replace: mine })
      }
    }
    // No day over 24 hours, counting everything else already there.
    for (const day of days) {
      const replaced = new Set(changes.filter(ch => ch.day === day).flatMap(ch => ch.replace.map(e => e.id)))
      const total = week.filter(e => e.entry_date === day && !replaced.has(e.id) && e.kind !== 'absence').reduce((s, e) => s + e.duration_seconds, 0)
        + changes.filter(ch => ch.day === day).reduce((s, ch) => s + ch.seconds, 0)
      if (total > DAY_SECONDS) return fail(`More than 24 hours on ${weekdayShort(day)}. A day has 24 hours; fix the cells in red.`)
    }
    // Not past the person's allowance, in each week or month the cells fall in.
    const limit = await limitRefusal(personId, { add: changes.map(ch => ({ day: ch.day, seconds: ch.seconds })), exclude: changes.flatMap(ch => ch.replace.map(e => e.id)) }, now, whose(v, personId, dir))
    if (limit) return fail(limit)

    const at = now.toISOString()
    for (const ch of changes) {
      if (ch.replace.length) {
        const { error: delErr } = await c.from('tc_entries').delete().in('id', ch.replace.map(e => e.id))
        if (delErr) return notSaved(delErr)
        await audit(c, ch.replace.map(e => ({ entryId: null, action: 'delete', by: v.personId, reason, before: { ...snapshot(e, catalog), id: e.id, person_id: e.person_id } })))
      }
      if (ch.seconds > 0) {
        const { data: ins, error: insErr } = await c.from('tc_entries').insert({
          person_id: personId, jobcode_id: ch.jobcodeId, started_at: null, ended_at: null, duration_seconds: ch.seconds,
          entry_date: ch.day, kind: 'manual', state: 'open', source: 'portal', fields: ch.fields, created_by: v.personId,
          ...(personId !== v.personId ? { edited_by: v.personId, edited_at: at } : {}),
        }).select('*').single()
        if (insErr) return notSaved(insErr)
        await audit(c, [{ entryId: (ins as EntryRow).id, action: 'grid', by: v.personId, reason, after: snapshot(ins as EntryRow, catalog) }])
      }
    }
    const { data: after } = await c.from('tc_entries').select('duration_seconds, kind, ended_at, started_at').eq('person_id', personId)
      .gte('entry_date', days[0]).lte('entry_date', days[6]).neq('kind', 'absence')
    const weekSeconds = ((after ?? []) as { duration_seconds: number }[]).reduce((s, e) => s + e.duration_seconds, 0)
    refresh()
    return { ok: true, weekSeconds, toast: `Saved. Week total ${formatDuration(weekSeconds)}.` }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Request to add time (3K) ────────────────────────────────────────────────

/**
 * "Request to add time": a day of this week, a start and an end (on the
 * quarter hour, the person's zone), the job and Activity, and "What happened".
 * It may not overlap an entry. It counts in no total until approved; the
 * person's Team Lead, Admins and Super Admins are told in the bell.
 */
export async function requestCorrection(input: { date: string; start: string; end: string; jobcodeId: number; fields?: Record<string, string>; notes?: string; reason: string }): Promise<Result<{ requestId: number; goesTo: string; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const catalog = await loadCatalog()
    const reason = reasonOf(input.reason)
    if (!reason) return fail('Say what happened.')
    const today = localDate(now, v.zone)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? '')) || input.date > today || input.date < addDays(today, -6)) return fail('Pick a day of this week.')
    const job = catalog.jobs.get(Number(input.jobcodeId))
    if (!offeredOn(job, String(input.date), catalog.switchDate)) return fail(PICK_JOB)
    const f = cleanFields(input.fields, catalog, job)
    if ('error' in f) return fail(f.error)
    const times = parseTimes({ date: input.date, mode: 'range', start: input.start, end: input.end }, v.zone, now, false)
    if (isFail(times)) return times
    if (times.kind !== 'range' || !times.end) return fail(END_AFTER_START)
    const lock = lockOn([input.date], (await loadSubmissions(c, [v.personId])).get(v.personId) ?? [])
    if (lock) return fail(lockedMessage(lock))
    const o = await overlapFor(c, v.personId, { start: times.start, end: times.end }, [], now)
    if (o) return fail(correctionOverlapLine(o, overlapInfo(o, catalog)!.name, v.zone), { overlap: overlapInfo(o, catalog) })

    const { data, error } = await c.from('tc_correction_requests').insert({
      person_id: v.personId, entry_date: input.date, started_at: times.start, ended_at: times.end, jobcode_id: job.id,
      fields: f.fields, notes: cleanNotes(input.notes), reason, state: 'pending',
    }).select('id, person_id, started_at, ended_at, entry_date').single()
    if (error) return notSaved(error)
    const r = data as { id: number; person_id: string; started_at: string; ended_at: string; entry_date: string }
    await announceCorrectionRequested(r)
    const goesTo = await correctionGoesTo(v.personId)
    const lead = /^Goes to (.+), your Team Leader\./.exec(goesTo)?.[1]
    refresh()
    return {
      ok: true, requestId: r.id, goesTo,
      toast: lead ? `Request sent to ${lead}. It counts once it is approved.` : 'Request sent. It counts once it is approved.',
    }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Submit and reopen (3H) ──────────────────────────────────────────────────

/**
 * Submit the viewer's own period (a month, or a pay period, by their cadence).
 * Refused while the clock is running in it, while anything needs attention,
 * when there is nothing in it, or when nobody could approve it. Its entries
 * lock with it.
 */
export async function submitPeriod(input: { start: string; end: string }): Promise<Result<{ toast: string; locked: number; invoiceId: number | null }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const s = await loadSubmitSummary(v, now, input.start)
    if (s.start !== input.start || s.end !== input.end) return fail('That period has changed. Reload and try again.')
    if (s.running) return fail('Clock out first. Your clock is running.')
    if (s.state === 'approved' || s.state === 'recorded') return fail('That period is already approved.')
    if (isSent(s.state)) return fail('That period has already been sent.')
    if (s.attention.length) return fail('Fix the entries that need attention first.', { attention: s.attention })
    const { count } = await c.from('tc_entries').select('id', { count: 'exact', head: true })
      .eq('person_id', v.personId).gte('entry_date', s.start).lte('entry_date', s.end)
    if (!count) return fail('There is nothing logged in that period yet.')

    // Who decides (README_PART2 "Approval routing"); the Deputy Director's own is recorded.
    const [settings, routes] = await Promise.all([loadRouteSettings(), loadRoutes([v.personId])])
    const route = routes.get(v.personId)
    if (!route) return fail('Your login is not linked to anyone in the Directory.')
    const nextState = stateOnSubmit(route, settings)
    if (nextState === 'submitted' && !currentStep(route, settings, 'submitted')?.owner) {
      return fail('Nobody is set up to approve your hours yet, so this would go nowhere. Ask a Super Admin.')
    }
    // A contractor's invoice is made with it: say now if it cannot be.
    const blocked = await invoiceBlocker(v.personId)
    if (blocked) return fail(blocked)

    const kind = s.kind
    const { data: found, error: findErr } = await c.from('tc_periods').select('id').eq('start_date', s.start).eq('end_date', s.end).maybeSingle()
    if (findErr) return notSaved(findErr)
    let periodId = (found as { id: number } | null)?.id
    if (!periodId) {
      const { data: made, error: makeErr } = await c.from('tc_periods').insert({ start_date: s.start, end_date: s.end, kind }).select('id').single()
      if (makeErr) return notSaved(makeErr)
      periodId = (made as { id: number }).id
    }
    const at = now.toISOString()
    const { data: sub, error: subErr } = await c.from('tc_submissions').select('id, state').eq('person_id', v.personId).eq('period_id', periodId).maybeSingle()
    if (subErr) return notSaved(subErr)
    const row = sub as { id: number; state: string } | null
    let sentId = row?.id ?? 0
    const fresh = { state: nextState, submitted_at: at, approved_at: null, approved_by: null, hours_approved_at: null, hours_approved_by: null, note: null }
    if (row) {
      // Sent again after a return: the last decision and its reason go.
      const { data: moved, error } = await c.from('tc_submissions').update(fresh).eq('id', row.id).in('state', ['draft', 'returned']).select('id')
      if (error) return notSaved(error)
      // Sent or approved in another tab since the summary was read: nothing changed here.
      if (!moved?.length) return fail('That period has already been sent. Reload to see where it stands.')
    } else {
      const { data: made, error } = await c.from('tc_submissions').insert({ person_id: v.personId, period_id: periodId, ...fresh }).select('id').single()
      if (error) return notSaved(error)
      sentId = (made as { id: number }).id
    }

    // The invoice is made with it (contractors); if that fails, nothing was sent.
    const { data: had, error: hadErr } = await c.from('invoices').select('id').eq('submission_id', sentId).maybeSingle()
    if (hadErr) {
      await c.from('tc_submissions').update({ state: row ? row.state : 'draft', submitted_at: null }).eq('id', sentId)
      return notSaved(hadErr)
    }
    let invoiceId: number | null = null
    try {
      invoiceId = await makeInvoiceForSubmission(sentId, now)
    } catch (e) {
      await c.from('tc_submissions').update({ state: row ? row.state : 'draft', submitted_at: null }).eq('id', sentId)
      // writeInvoice undoes its own half-made invoice; should that undo fail, none is left waiting with the timesheet back in draft.
      const { data: left } = await c.from('invoices').select('id').eq('submission_id', sentId).eq('state', 'waiting').maybeSingle()
      if (left && had) await c.from('invoices').update({ state: 'draft', updated_at: now.toISOString() }).eq('id', left.id)
      else if (left) {
        await c.from('reimbursements').update({ state: 'approved', invoice_id: null }).eq('invoice_id', left.id).eq('state', 'on_invoice')
        await c.from('invoices').delete().eq('id', left.id)
      }
      console.error('[clocky submit] invoice:', e instanceof Error ? e.message : e)
      return fail('Your invoice could not be made, so nothing was sent. Try again in a moment.')
    }

    // The portal's own rows freeze with it (imported ones keep QuickBooks Time's state).
    await c.from('tc_entries').update({ state: nextState === 'recorded' ? 'approved' : 'submitted', updated_at: at })
      .eq('person_id', v.personId).eq('state', 'open').eq('source', 'portal').gte('entry_date', s.start).lte('entry_date', s.end)
    await c.from('tc_approval_events').insert({ submission_id: sentId, invoice_id: invoiceId, step: 'submit', action: nextState === 'recorded' ? 'record' : 'submit', by_person: v.personId, at })
    // Whoever decides first hears of it.
    const owner = currentStep(route, settings, nextState)?.owner
    if (owner) await announceTimesheetSubmitted({ submissionId: sentId, sentAt: at, personId: v.personId, to: [owner], period: periodLabel(s).full, seconds: s.totalSeconds })
    // The contractor hears the invoice was made, with its number and total.
    if (invoiceId) {
      const { data: inv } = await c.from('invoices').select('number, total').eq('id', invoiceId).maybeSingle()
      if (inv) await announceInvoiceMade({ invoiceId, at, personId: v.personId, number: inv.number, month: periodLabel(s).label, total: usd(Number(inv.total)), withHours: true })
    }
    refresh()
    const what = nextState === 'recorded' ? 'recorded' : 'submitted'
    // Invoices.dc.html: a contractor goes to the invoice it made; an employee hears where the hours go.
    const toast = invoiceId ? `${s.label} ${what}. Your invoice is waiting for approval with it.`
      : s.block?.kind === 'payroll' && nextState !== 'recorded' ? `${s.label} submitted. Your payroll summary goes to Rippling when it is approved.`
        : `${s.label} ${what}. ${count} entries are now locked.`
    return { ok: true, locked: count, invoiceId, toast }
  } catch (e) {
    return notSaved(e)
  }
}

