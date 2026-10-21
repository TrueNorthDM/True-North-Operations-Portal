'use server'

/**
 * Clocky's clock (design handoff of 16 October 2026, SPEC section 6, Clock
 * Panel.dc.html): the panel's data, clock in, switch, clock out (and Undo for
 * 10 seconds), the running entry's notes and fields saved as they are typed,
 * "Keep going", the real end time after an automatic stop, the saved
 * combinations, and asking for time off.
 *
 * Every write is the person's own clock, for the person really signed in
 * (writerAccess: a verified session, never a View Stage preview), with Time
 * entries open (clocky-hours), and then goes through the privileged client
 * (lib/timeclock/clocky-store.ts). Every time saved is on the quarter hour; the
 * real instants are kept beside it.
 *
 * Each returns { ok: true, ... } or { ok: false, error }: the error is a
 * sentence for the person; the database's wording goes to the server log.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadCatalog, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import {
  audit, cleanFields, cleanNotes, closeClock, loadEntry, loadSubmissions, lockOn, overlapFor, rewriteSpan,
  runningOf, snapshot, type EntryRow,
} from '@/lib/timeclock/clocky-store'
import { entrySeconds, labelFor, loadClockPanel, loadCombos, stopOwnIfDue, choiceOf } from '@/lib/timeclock/clocky-panel'
import { localDate, minutesLabel, localMinutes, timeLabel } from '@/lib/timeclock/format'
import { formatDuration, roundIso } from '@/lib/timeclock/rounding'
import { FIELD_LABEL, END_AFTER_START, gateText, missingFields, overlapLine } from '@/lib/timeclock/entry-rules'
import { KEEP_GOING_TOAST_BELL, KEEP_GOING_TOAST_PANEL, keptGoingNote, sessionStart, windowStart } from '@/lib/timeclock/safety'
import { lockedMessage } from '@/lib/timeclock/periods'
import type { ClockChoice, ClockPanelData, Fail, Result } from '@/lib/timeclock/clocky-types'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const PREVIEW = 'View Stage is only a preview. Close it to use the clock.'
const SIGN_IN = 'Sign in again to save.'
const NO_ACCESS = 'Clocky is not open to your access.'
const NOT_CLOCKED_IN = 'You are not clocked in.'
const ALREADY = 'You are already clocked in. Stop that one first.'
const PICK_JOB = 'Pick a job code.'
const STOPPED = 'Your clock stopped by itself.'

const fail = (error: string, extra: Omit<Fail, 'ok' | 'error'> = {}): Fail => ({ ok: false, error, ...extra })

/** The detail goes to the server log; the person gets a sentence. */
function notSaved(e: unknown): Fail {
  console.error('[clocky clock]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}

const refresh = () => { revalidatePath('/clocky-hours'); revalidatePath('/hours') }

/** The person really signed in, allowed `key`, or the sentence why not. */
async function actor(key = 'clocky-hours'): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail(PREVIEW)
  const access = await writerAccess()
  if (!access) return fail(SIGN_IN)
  if (!access.can(key)) return fail(NO_ACCESS)
  const v = await viewerFor(access)
  return v ?? fail('Your login is not linked to anyone in the Directory.')
}
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false

/** The running entry, stopped first if it ran past its 5-hour mark (then the person confirms the end, 1L). */
async function running(v: Viewer, now: Date): Promise<EntryRow | Fail> {
  const c = db()
  const e = await runningOf(c, v.personId)
  if (!e) return fail(NOT_CLOCKED_IN)
  if (await stopOwnIfDue(c, e, now)) return fail(STOPPED, { stopped: true })
  return e
}

// ── The panel ───────────────────────────────────────────────────────────────

/** Everything the clock panel and the top-bar button show (1A to 1N). */
export async function getClockPanel(): Promise<Result<{ data: ClockPanelData }>> {
  const access = await loadAccess()
  if (!access.can('clocky-hours')) return fail(NO_ACCESS)
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    // A preview shows; it never stops anyone's clock.
    return { ok: true, data: await loadClockPanel(v, new Date(), { act: !(await getViewAs()) }) }
  } catch (e) {
    console.error('[clocky clock] panel:', (e as Error).message)
    return fail('The clock could not be read. Try again in a moment.')
  }
}

// ── Clock in, switch, clock out ─────────────────────────────────────────────

export interface ClockInput {
  jobcodeId: number
  /** tc_fields id -> value; Company, Project, Activity, Billable and (i7 jobs) i7 Code. */
  fields?: Record<string, string>
  notes?: string
}

async function checkedChoice(input: ClockInput): Promise<{ jobcodeId: number; fields: Record<string, string>; notes: string | null; isI7: boolean } | Fail> {
  const catalog = await loadCatalog()
  const job = catalog.jobs.get(Number(input.jobcodeId))
  if (!job?.selectable) return fail(PICK_JOB)
  const f = cleanFields(input.fields, catalog, job)
  if ('error' in f) return fail(f.error)
  return { jobcodeId: job.id, fields: f.fields, notes: cleanNotes(input.notes), isI7: job.isI7 }
}

/** Clock in (the job is required; the fields can wait until a switch or a clock out). */
export async function clockIn(input: ClockInput): Promise<Result<{ entryId: number; startedAt: string; startedAtReal: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const choice = await checkedChoice(input)
    if (isFail(choice)) return choice
    const open = await runningOf(c, v.personId)
    if (open) return (await stopOwnIfDue(c, open, now)) ? fail(STOPPED, { stopped: true }) : fail(ALREADY)

    const start = roundIso(now)
    const date = localDate(start, v.zone)
    const lock = lockOn([date], (await loadSubmissions(c, [v.personId])).get(v.personId) ?? [])
    if (lock) return fail(lockedMessage(lock))

    const row = {
      person_id: v.personId, jobcode_id: choice.jobcodeId, started_at: start, started_at_real: now.toISOString(),
      session_started_at: now.toISOString(), window_started_at: now.toISOString(), ended_at: null, duration_seconds: 0,
      entry_date: date, kind: 'clock', state: 'open', source: 'portal', fields: choice.fields, notes: choice.notes,
      created_by: v.personId,
    }
    const { data, error } = await c.from('tc_entries').insert(row).select('*').single()
    // One running clock per person is a unique index: two clicks are one clock.
    if (error) return error.code === '23505' ? fail(ALREADY) : notSaved(error)
    const e = data as EntryRow
    await audit(c, [{ entryId: e.id, action: 'clock_in', by: v.personId, after: snapshot(e, await loadCatalog()) }])
    refresh()
    return { ok: true, entryId: e.id, startedAt: start, startedAtReal: now.toISOString() }
  } catch (e) {
    return notSaved(e)
  }
}

/** What a switch or a clock out finishes on the running entry first (1F: the inline fields). */
export interface Finish { fields?: Record<string, string>; notes?: string }

/** Apply 1F's fields to the running entry, saved even when something is still missing: the entry is never lost. */
async function finishRunning(v: Viewer, e: EntryRow, finish: Finish | undefined, kind: 'switch' | 'out', toLabel?: string): Promise<EntryRow | Fail> {
  const c = db()
  const catalog = await loadCatalog()
  const job = catalog.jobs.get(e.jobcode_id ?? -1)
  const current = (e.fields ?? {}) as Record<string, string>
  let fields = current
  let notes = e.notes
  if (finish) {
    const f = cleanFields({ ...current, ...(finish.fields ?? {}) }, catalog, job, current)
    if ('error' in f) return fail(f.error)
    fields = f.fields
    if (finish.notes !== undefined) notes = cleanNotes(finish.notes)
    const { error } = await c.from('tc_entries').update({ fields, notes, updated_at: new Date().toISOString() }).eq('id', e.id).is('ended_at', null)
    if (error) return notSaved(error)
  }
  const missing = missingFields(fields, notes, catalog.keys, !!job?.isI7)
  if (missing.length) return fail(`${gateText(kind, toLabel)} ${missing.map(m => FIELD_LABEL[m]).join(', ')}.`, { missing })
  return { ...e, fields, notes }
}

/** Today's total for one label (the switch toast: "i7 Web Dev: 2h 10m"), and the whole day. */
async function todayTotals(v: Viewer, now: Date, label?: string): Promise<{ label: number; day: number }> {
  const c = db()
  const [catalog, combos] = await Promise.all([loadCatalog(), loadCombos(c, v.personId)])
  const today = localDate(now, v.zone)
  const { data } = await c.from('tc_entries').select('*').eq('person_id', v.personId).eq('entry_date', today).neq('kind', 'absence')
  const rows = (data ?? []) as EntryRow[]
  const seconds = (e: EntryRow) => entrySeconds(e, now)
  return {
    day: rows.reduce((s, e) => s + seconds(e), 0),
    label: label === undefined ? 0 : rows.filter(e => labelFor({ jobcode_id: e.jobcode_id, fields: (e.fields ?? {}) as Record<string, string> }, combos, catalog) === label)
      .reduce((s, e) => s + seconds(e), 0),
  }
}

/**
 * Switch: the running entry ends and the next one starts at the same second
 * (recorded on the same quarter hour). The safety window carries over: a
 * switch does not restart it. Refused, with what is missing, while the running
 * entry lacks a required field (1F).
 */
export async function switchTo(input: ClockInput & { finish?: Finish }): Promise<Result<{ entryId: number; previous: { label: string; todaySeconds: number }; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const [catalog, combos] = await Promise.all([loadCatalog(), loadCombos(c, v.personId)])
    const choice = await checkedChoice(input)
    if (isFail(choice)) return choice
    const nextLabel = labelFor({ jobcode_id: choice.jobcodeId, fields: choice.fields }, combos, catalog)
    const cur = await running(v, now)
    if (isFail(cur)) return cur
    const done = await finishRunning(v, cur, input.finish, 'switch', nextLabel)
    if (isFail(done)) return done

    const start = roundIso(now)
    const date = localDate(start, v.zone)
    const lock = lockOn([date], (await loadSubmissions(c, [v.personId])).get(v.personId) ?? [])
    if (lock) return fail(lockedMessage(lock))

    const closed = await closeClock(c, done, now, v.zone)
    if (!closed) return fail(NOT_CLOCKED_IN)
    const { data, error } = await c.from('tc_entries').insert({
      person_id: v.personId, jobcode_id: choice.jobcodeId, started_at: closed.recordedEnd, started_at_real: now.toISOString(),
      session_started_at: sessionStart(done) ?? now.toISOString(), window_started_at: windowStart(done) ?? now.toISOString(),
      ended_at: null, duration_seconds: 0, entry_date: localDate(closed.recordedEnd, v.zone), kind: 'clock', state: 'open',
      source: 'portal', fields: choice.fields, notes: choice.notes, created_by: v.personId,
    }).select('*').single()
    if (error) {
      // Put the clock back the way it was: a failed switch must not leave the person clocked out.
      if (closed.ids.length > 1) await c.from('tc_entries').delete().in('id', closed.ids.slice(1))
      await c.from('tc_entries').update({ ended_at: null, ended_at_real: null, duration_seconds: 0 }).eq('id', done.id)
      return notSaved(error)
    }
    const next = data as EntryRow
    const prevLabel = labelFor({ jobcode_id: done.jobcode_id, fields: (done.fields ?? {}) as Record<string, string> }, combos, catalog)
    await audit(c, [
      { entryId: closed.lastId, action: 'switch', by: v.personId, before: snapshot(done, catalog),
        after: snapshot({ ...done, ended_at: closed.recordedEnd, ended_at_real: closed.realEnd }, catalog, { next_job: catalog.pathOf(choice.jobcodeId), split_ids: closed.ids }) },
      { entryId: next.id, action: 'switch', by: v.personId, after: snapshot(next, catalog) },
    ])
    const t = await todayTotals(v, now, prevLabel)
    refresh()
    return {
      ok: true, entryId: next.id,
      previous: { label: prevLabel, todaySeconds: t.label },
      toast: `Switched to ${nextLabel}. ${prevLabel}: ${formatDuration(t.label)}.`,
    }
  } catch (e) {
    return notSaved(e)
  }
}

/** "Clocked out at 5:10 PM, recorded as 5:15 PM. Today 8h 15m." (1H) */
function clockOutToast(real: Date, recorded: string, zone: string, todaySeconds: number): string {
  const realLabel = minutesLabel(localMinutes(new Date(Math.floor(real.getTime() / 60_000) * 60_000), zone))
  const recLabel = timeLabel(recorded, zone)
  return `Clocked out at ${realLabel}${realLabel !== recLabel ? `, recorded as ${recLabel}` : ''}. Today ${formatDuration(todaySeconds)}.`
}

/** Clock out: immediate when the entry is complete, else what is missing (1F/1H). Undo for 10 seconds. */
export async function clockOut(input: { finish?: Finish } = {}): Promise<Result<{ entryId: number; endedAt: string; recordedEnd: string; todaySeconds: number; undoUntil: string; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const catalog = await loadCatalog()
    const cur = await running(v, now)
    if (isFail(cur)) return cur
    const done = await finishRunning(v, cur, input.finish, 'out')
    if (isFail(done)) return done
    const closed = await closeClock(c, done, now, v.zone)
    if (!closed) return fail(NOT_CLOCKED_IN)
    await audit(c, [{
      entryId: closed.lastId, action: 'clock_out', by: v.personId, before: snapshot(done, catalog),
      after: snapshot({ ...done, ended_at: closed.recordedEnd, ended_at_real: closed.realEnd }, catalog, { split_ids: closed.ids }),
    }])
    const t = await todayTotals(v, now)
    refresh()
    return {
      ok: true, entryId: closed.lastId, endedAt: now.toISOString(), recordedEnd: closed.recordedEnd, todaySeconds: t.day,
      undoUntil: new Date(now.getTime() + UNDO_MS).toISOString(),
      toast: clockOutToast(now, closed.recordedEnd, v.zone, t.day),
    }
  } catch (e) {
    return notSaved(e)
  }
}

/** The toast offers Undo for 10 seconds; the server allows a little more for the round trip. */
const UNDO_MS = 10_000
const UNDO_GRACE_MS = 5_000

/** Undo a clock out within its 10 seconds: the entry runs again as if nothing happened. */
export async function undoClockOut(input: { entryId: number }): Promise<Result> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const e = await loadEntry(c, Number(input.entryId))
    if (!e || e.person_id !== v.personId || e.kind !== 'clock' || !e.ended_at) return fail('There is nothing to undo.')
    const { data: last } = await c.from('tc_entry_audit').select('changed_at, after').eq('entry_id', e.id).eq('action', 'clock_out')
      .order('changed_at', { ascending: false }).limit(1).maybeSingle()
    const row = last as { changed_at: string; after: { split_ids?: number[] } | null } | null
    if (!row || Date.now() - Date.parse(row.changed_at) > UNDO_MS + UNDO_GRACE_MS) return fail('It is too late to undo that clock out.')
    if (await runningOf(c, v.personId)) return fail(ALREADY)
    const ids = row.after?.split_ids?.length ? row.after.split_ids : [e.id]
    const first = ids[0]
    if (ids.length > 1) {
      const { error } = await c.from('tc_entries').delete().in('id', ids.slice(1)).eq('person_id', v.personId)
      if (error) return notSaved(error)
    }
    const { error } = await c.from('tc_entries').update({ ended_at: null, ended_at_real: null, duration_seconds: 0, updated_at: new Date().toISOString() })
      .eq('id', first).eq('person_id', v.personId)
    if (error) return error.code === '23505' ? fail(ALREADY) : notSaved(error)
    await audit(c, [{ entryId: first, action: 'undo_clock_out', by: v.personId }])
    refresh()
    return { ok: true }
  } catch (e) {
    return notSaved(e)
  }
}

// ── The running entry ───────────────────────────────────────────────────────

/**
 * Notes and fields of the running clock, saved as they are typed ("Saving..."
 * then "Saved"): no Save button, no reason (it is the clock being filled in,
 * not a change to saved hours). Returns what is still missing.
 */
export async function saveRunningDetails(input: Finish): Promise<Result<{ missing: string[] }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const catalog = await loadCatalog()
    const cur = await running(v, now)
    if (isFail(cur)) return cur
    const job = catalog.jobs.get(cur.jobcode_id ?? -1)
    const current = (cur.fields ?? {}) as Record<string, string>
    const f = cleanFields({ ...current, ...(input.fields ?? {}) }, catalog, job, current)
    if ('error' in f) return fail(f.error)
    const notes = input.notes !== undefined ? cleanNotes(input.notes) : cur.notes
    const { error, data } = await c.from('tc_entries').update({ fields: f.fields, notes, updated_at: now.toISOString() })
      .eq('id', cur.id).is('ended_at', null).select('id')
    if (error) return notSaved(error)
    if (!data?.length) return fail(NOT_CLOCKED_IN)
    return { ok: true, missing: missingFields(f.fields, notes, catalog.keys, !!job?.isI7) }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * "Keep going" (1I, N1): a new 5-hour window from now. The bell's row says so.
 * From the bell it names its row: an older "Still working?" (its clock already
 * stopped or went on) is only marked read, never applied to today's clock.
 */
export async function keepGoing(input?: { notificationId?: string }): Promise<Result<{ windowStartedAt: string; toast: string; toastFromBell: string; done: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const cur = await running(v, now)
    const old = isFail(cur) ? null : windowStart(cur) ?? cur.started_at!
    if (input?.notificationId) {
      const { data: row } = await c.from('notifications').select('dedupe_key')
        .eq('id', input.notificationId).eq('person_id', v.personId).eq('type_key', 'clocky-still-working').maybeSingle()
      if (!row || (row as { dedupe_key: string | null }).dedupe_key !== old) {
        await c.from('notifications').update({ read_at: now.toISOString() }).eq('id', input.notificationId).eq('person_id', v.personId)
        return fail('That reminder is for an earlier clock, so there is nothing to keep going.')
      }
    }
    if (isFail(cur) || !old) return isFail(cur) ? cur : fail(NOT_CLOCKED_IN)
    const { error, data } = await c.from('tc_entries').update({ window_started_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', cur.id).is('ended_at', null).select('id')
    if (error) return notSaved(error)
    if (!data?.length) return fail(NOT_CLOCKED_IN)
    const ev = await c.from('tc_safety_events').upsert({
      person_id: v.personId, entry_id: cur.id, kind: 'keep_going', at: now.toISOString(), window_started_at: old,
      session_started_at: sessionStart(cur), jobcode_id: cur.jobcode_id,
    }, { onConflict: 'person_id,kind,window_started_at' })
    if (ev.error) console.error('[clocky clock] keep going event:', ev.error.message)
    await audit(c, [{ entryId: cur.id, action: 'keep_going', by: v.personId, before: { window_started_at: old }, after: { window_started_at: now.toISOString() } }])
    // The "Still working?" row in the bell shows what was done about it.
    const note = await c.from('notifications').update({ done_note: keptGoingNote(now, v.zone), read_at: now.toISOString() })
      .eq('person_id', v.personId).eq('type_key', 'clocky-still-working').eq('dedupe_key', old)
    if (note.error) console.error('[clocky clock] still working row:', note.error.message)
    refresh()
    return { ok: true, windowStartedAt: now.toISOString(), toast: KEEP_GOING_TOAST_PANEL, toastFromBell: KEEP_GOING_TOAST_BELL, done: keptGoingNote(now, v.zone) }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * The real end after an automatic stop (1L). `end` is a time from the picker
 * (an instant on a quarter hour); "Keep 1:00 PM" sends the stop itself. Later
 * than the stop only with "I was still working until..." (`stillWorking`), up
 * to now, and then flagged for the approver.
 */
export async function confirmEnd(input: { entryId: number; end: string; stillWorking?: boolean }): Promise<Result<{ recordedEnd: string; flagged: boolean; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const now = new Date()
    const c = db()
    const catalog = await loadCatalog()
    const e = await loadEntry(c, Number(input.entryId))
    if (!e || e.person_id !== v.personId || !e.auto_stopped_at || !e.started_at || !e.ended_at) return fail('That entry is not waiting for an end time.')
    if (e.end_confirmed_at) return fail('That end time is already confirmed.')
    const t = Date.parse(input.end)
    if (Number.isNaN(t)) return fail('Pick a time.')
    const end = roundIso(t)
    const stop = e.ended_at
    const later = Date.parse(end) > Date.parse(stop)
    if (later && !input.stillWorking) return fail('It cannot be later than the stop unless you choose "I was still working until...".')
    if (later && Date.parse(end) > now.getTime()) return fail('It cannot be later than now.')
    if (Date.parse(end) <= Date.parse(e.started_at)) return fail(END_AFTER_START)

    const days = [e.entry_date, localDate(end, v.zone)]
    const lock = lockOn(days, (await loadSubmissions(c, [v.personId])).get(v.personId) ?? [], e.state)
    if (lock) return fail(lockedMessage(lock))
    if (later) {
      const o = await overlapFor(c, v.personId, { start: e.started_at, end }, [e.id], now)
      if (o) {
        const name = catalog.jobs.get(o.other.row.jobcode_id ?? -1)?.short ?? ''
        return fail(overlapLine((Date.parse(end) - Date.parse(e.started_at)) / 1000, o, name, v.zone), {
          overlap: { entryId: o.other.row.id, name, start: o.other.row.started_at!, end: o.other.row.ended_at, sharedStart: o.start, sharedEnd: o.end },
        })
      }
    }

    const at = now.toISOString()
    const ids = await rewriteSpan(c, e, e.started_at, end, v.zone,
      { end_confirmed_at: at, end_confirmed_by: v.personId, end_flagged: later, ...(e.source === 'tsheets' ? { changed_here_at: at } : {}) },
      { ended_at_real: new Date(t).toISOString() })
    const ev = await c.from('tc_safety_events').update({ confirmed_end_at: new Date(t).toISOString(), confirmed_at: at, flagged: later })
      .eq('entry_id', e.id).eq('kind', 'auto_stop')
    if (ev.error) console.error('[clocky clock] safety confirm:', ev.error.message)
    // The "clock stopped" row in the bell shows it is done, and its button goes.
    const toastText = `End time confirmed: ${timeLabel(new Date(t), v.zone)}.`
    const note = await c.from('notifications').update({ done_note: toastText, read_at: at })
      .eq('person_id', v.personId).eq('type_key', 'clocky-stopped').eq('dedupe_key', `stop:${e.id}`)
    if (note.error) console.error('[clocky clock] stopped row:', note.error.message)
    await audit(c, [{
      entryId: e.id, action: 'confirm_end', by: v.personId, before: snapshot(e, catalog),
      after: snapshot({ ...e, ended_at: end, ended_at_real: new Date(t).toISOString() }, catalog, { split_ids: ids }),
    }])
    const { data } = await c.from('tc_entries').select('*').eq('person_id', v.personId).eq('entry_date', e.entry_date).neq('kind', 'absence')
    const day = ((data ?? []) as EntryRow[]).reduce((s, x) => s + entrySeconds(x, now), 0)
    refresh()
    return {
      ok: true, recordedEnd: end, flagged: later,
      toast: `${toastText} Today ${formatDuration(day)}.${later ? ' Flagged for the approver.' : ''}`,
    }
  } catch (e) {
    return notSaved(e)
  }
}

// ── Combinations (1J, 1K) ───────────────────────────────────────────────────

export interface CombinationInput { name: string; jobcodeId: number; fields?: Record<string, string>; notes?: string }

async function checkedCombination(input: CombinationInput): Promise<{ name: string; jobcode_id: number; fields: Record<string, string>; notes: string | null } | Fail> {
  const name = String(input.name ?? '').trim().slice(0, 60)
  if (!name) return fail('Give it a name.')
  const choice = await checkedChoice(input)
  if (isFail(choice)) return choice
  return { name, jobcode_id: choice.jobcodeId, fields: choice.fields, notes: choice.notes }
}

export async function createCombination(input: CombinationInput): Promise<Result<{ combination: ClockChoice; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const row = await checkedCombination(input)
    if (isFail(row)) return row
    const mine = await loadCombos(c, v.personId)
    const position = mine.reduce((m, x) => Math.max(m, x.position), -1) + 1
    const { data, error } = await c.from('tc_combinations').insert({ ...row, person_id: v.personId, position }).select('id, name, jobcode_id, fields, notes').single()
    if (error) return notSaved(error)
    const saved = data as { id: number; name: string; jobcode_id: number; fields: Record<string, string>; notes: string | null }
    refresh()
    return { ok: true, combination: choiceOf(saved, await loadCatalog()), toast: `Saved ${saved.name}.` }
  } catch (e) {
    return notSaved(e)
  }
}

export async function updateCombination(input: CombinationInput & { id: number }): Promise<Result<{ combination: ClockChoice; toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const row = await checkedCombination(input)
    if (isFail(row)) return row
    const { data, error } = await c.from('tc_combinations').update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', Number(input.id)).eq('person_id', v.personId).select('id, name, jobcode_id, fields, notes')
    if (error) return notSaved(error)
    const saved = (data ?? [])[0] as { id: number; name: string; jobcode_id: number; fields: Record<string, string>; notes: string | null } | undefined
    if (!saved) return fail('That combination is not there any more.')
    refresh()
    return { ok: true, combination: choiceOf(saved, await loadCatalog()), toast: `Saved ${saved.name}.` }
  } catch (e) {
    return notSaved(e)
  }
}

export async function deleteCombination(input: { id: number }): Promise<Result<{ toast: string }>> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const { data, error } = await c.from('tc_combinations').delete().eq('id', Number(input.id)).eq('person_id', v.personId).select('name')
    if (error) return notSaved(error)
    const gone = (data ?? [])[0] as { name: string } | undefined
    if (!gone) return fail('That combination is not there any more.')
    refresh()
    return { ok: true, toast: `Deleted ${gone.name}.` }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * The person's order (1K, drag to reorder): the combinations the panel shows,
 * each once. One whose job is no longer selectable is not shown there, so it
 * keeps its place after the others instead of blocking the save.
 */
export async function reorderCombinations(input: { ids: number[] }): Promise<Result> {
  const v = await actor()
  if (isFail(v)) return v
  try {
    const c = db()
    const mine = await loadCombos(c, v.personId)
    const shown = (input.ids ?? []).map(Number)
    const known = new Set(mine.map(x => x.id))
    if (!shown.length || new Set(shown).size !== shown.length || shown.some(id => !known.has(id))) {
      return fail('Your combinations changed in the meantime. Reload and try again.')
    }
    const ids = [...shown, ...mine.map(x => x.id).filter(id => !shown.includes(id))]
    for (let i = 0; i < ids.length; i++) {
      const { error } = await c.from('tc_combinations').update({ position: i }).eq('id', ids[i]).eq('person_id', v.personId)
      if (error) return notSaved(error)
    }
    refresh()
    return { ok: true }
  } catch (e) {
    return notSaved(e)
  }
}

