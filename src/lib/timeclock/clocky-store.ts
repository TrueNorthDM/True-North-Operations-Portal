/**
 * Clocky's writes and the reads they decide with, all with the privileged
 * client, after the caller has decided the person may (lib/timeclock/scope.ts).
 * The rules that matter are here once: rounding to the quarter hour, the
 * midnight split, the lock of submitted periods, the overlap check, the audit
 * line with its reason, and the automatic stop of the safety net.
 *
 * Not a "use server" file.
 */

import type { Db } from '@/lib/supabase/types'
import type { Json, Tables, TablesInsert } from '@/lib/types/database.types'
import { allRows, must, type Catalog, type Directory } from './clocky-context'
import { roundIso, recordedSeconds } from './rounding'
import { FIELD_LABEL, fieldsOfStructure, splitAtMidnight, firstOverlap, type Structure, type Timed } from './entry-rules'
import { lockedBy, type SubmittedPeriod } from './periods'
import { safetyState, stopPoint, windowStart, sessionStart } from './safety'
import { limitStopEvent } from './safety-stops'
import type { Snapshot } from './history'

type Client = Db
export type EntryRow = Tables<'tc_entries'>

/** What the audit keeps of an entry. */
export function snapshot(e: Partial<EntryRow>, catalog: Catalog, extra: Partial<Snapshot> & { split_ids?: number[] } = {}): Snapshot & { split_ids?: number[] } {
  return {
    started_at: e.started_at ?? null,
    ended_at: e.ended_at ?? null,
    started_at_real: e.started_at_real ?? null,
    ended_at_real: e.ended_at_real ?? null,
    duration_seconds: e.duration_seconds ?? 0,
    entry_date: e.entry_date,
    jobcode_id: e.jobcode_id ?? null,
    job: catalog.pathOf(e.jobcode_id),
    fields: (e.fields ?? {}) as Record<string, string>,
    notes: e.notes ?? null,
    ...extra,
  }
}

export interface AuditLine {
  entryId: number | null
  action: string
  by: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
}

/**
 * Lines in the trail, written beside the change. A line that fails is logged,
 * not fatal: losing a line of history is bad, losing the hours is worse.
 */
export async function audit(c: Client, lines: readonly AuditLine[]): Promise<void> {
  if (!lines.length) return
  const { error } = await c.from('tc_entry_audit').insert(lines.map(l => ({
    entry_id: l.entryId,
    action: l.action,
    changed_by: l.by,
    before: (l.before ?? null) as Json,
    after: (l.after ?? null) as Json,
    reason: l.reason?.trim() || null,
  })))
  if (error) console.error('[clocky] audit not written:', error.message)
}

// ── Locks ───────────────────────────────────────────────────────────────────

/** Each person's submitted or approved periods, with their days. */
export async function loadSubmissions(c: Client, personIds: readonly string[]): Promise<Map<string, (SubmittedPeriod & { periodId: number; kind: string })[]>> {
  const out = new Map<string, (SubmittedPeriod & { periodId: number; kind: string })[]>()
  if (!personIds.length) return out
  const subs = await allRows<{ person_id: string; period_id: number; state: string }>(
    (a, b) => c.from('tc_submissions').select('person_id, period_id, state').in('person_id', personIds as string[])
      .order('id').range(a, b), 'Submissions could not be read')
  const ids = [...new Set(subs.map(s => s.period_id))]
  const periods = ids.length
    ? (must(await c.from('tc_periods').select('id, start_date, end_date, kind').in('id', ids), 'Periods could not be read') ?? []) as { id: number; start_date: string; end_date: string; kind: string }[]
    : []
  const byId = new Map(periods.map(p => [p.id, p]))
  for (const s of subs) {
    const p = byId.get(s.period_id)
    if (!p) continue
    ;(out.get(s.person_id) ?? out.set(s.person_id, []).get(s.person_id)!).push({
      start: p.start_date, end: p.end_date, state: s.state, periodId: p.id, kind: p.kind,
    })
  }
  return out
}

/** The locked period behind any of these days, or null. */
export function lockOn(days: readonly string[], subs: readonly SubmittedPeriod[], entryState?: string | null): SubmittedPeriod | null {
  for (const d of days) {
    const l = lockedBy(d, subs, entryState)
    if (l) return l
  }
  return null
}

// ── Reads ───────────────────────────────────────────────────────────────────

const ENTRY = '*'

export async function loadEntry(c: Client, id: number): Promise<EntryRow | null> {
  return must(await c.from('tc_entries').select(ENTRY).eq('id', id).maybeSingle(), 'The entry could not be read') as EntryRow | null
}

/** The person's running clock, if any (there is at most one). */
export async function runningOf(c: Client, personId: string): Promise<EntryRow | null> {
  const rows = must(await c.from('tc_entries').select(ENTRY).eq('person_id', personId).eq('kind', 'clock').is('ended_at', null).limit(1), 'The running clock could not be read') as EntryRow[]
  return rows[0] ?? null
}

/** The person's timed entries that touch a span (running ones included), for the overlap check. */
export async function timedNear(c: Client, personId: string, fromIso: string, toIso: string): Promise<EntryRow[]> {
  const rows = must(await c.from('tc_entries').select(ENTRY)
    .eq('person_id', personId).not('started_at', 'is', null)
    .lt('started_at', toIso).or(`ended_at.is.null,ended_at.gt.${fromIso}`)
    .limit(200), 'Entries could not be read') as EntryRow[]
  return rows
}

export const timedOf = (e: EntryRow): Timed & { row: EntryRow } => ({ id: e.id, start: e.started_at, end: e.ended_at, row: e })

/** The first entry of the person a span would overlap, ignoring `exclude`. */
export async function overlapFor(c: Client, personId: string, span: { start: string; end: string | null }, exclude: readonly number[], now: Date) {
  const end = span.end ?? roundIso(now)
  const near = (await timedNear(c, personId, span.start, end)).filter(e => !exclude.includes(e.id))
  return firstOverlap({ start: span.start, end: span.end }, near.map(timedOf), now)
}

// ── Closing a running clock ─────────────────────────────────────────────────

export interface Closed {
  /** The entry that holds the end (the last piece when it crossed midnight). */
  lastId: number
  /** Every piece, first the original. */
  ids: number[]
  recordedEnd: string
  realEnd: string
}

/**
 * End a running entry: the recorded end on the quarter hour (never before the
 * recorded start), the real one kept, and the entry cut at each midnight of
 * the person's zone. The original row keeps the first day; each further day is
 * a new row of the same job, carrying the session and the window.
 *
 * Only a row still running is ended: if another write ended it first, nothing
 * changes and null comes back.
 */
export async function closeClock(
  c: Client,
  e: EntryRow,
  endReal: Date | string,
  zone: string,
  opts: { recordedEnd?: string; patch?: Partial<EntryRow> } = {},
): Promise<Closed | null> {
  const real = typeof endReal === 'string' ? endReal : endReal.toISOString()
  const start = e.started_at!
  let end = opts.recordedEnd ?? roundIso(real)
  if (Date.parse(end) < Date.parse(start)) end = start
  const pieces = splitAtMidnight(start, end, zone)
  if (!pieces.length) pieces.push({ start, end: start, date: e.entry_date })
  const now = new Date().toISOString()
  const imported = e.source === 'tsheets'

  const first = pieces[0]
  const only = pieces.length === 1
  const { data, error } = await c.from('tc_entries').update({
    ended_at: first.end,
    ended_at_real: only ? real : null,
    duration_seconds: recordedSeconds(first.start, first.end),
    updated_at: now,
    ...(imported ? { changed_here_at: now } : {}),
    ...(only ? opts.patch ?? {} : {}),
  }).eq('id', e.id).is('ended_at', null).select('id')
  if (error) throw new Error(`The clock could not be stopped: ${error.message}`)
  if (!data?.length) return null

  const ids = [e.id]
  for (let i = 1; i < pieces.length; i++) {
    const p = pieces[i]
    const last = i === pieces.length - 1
    const row: TablesInsert<'tc_entries'> = {
      person_id: e.person_id,
      jobcode_id: e.jobcode_id,
      started_at: p.start,
      ended_at: p.end,
      duration_seconds: recordedSeconds(p.start, p.end),
      entry_date: p.date,
      kind: 'clock',
      state: 'open',
      notes: e.notes,
      fields: e.fields,
      source: 'portal',
      created_by: e.created_by,
      session_started_at: e.session_started_at,
      window_started_at: e.window_started_at,
      ended_at_real: last ? real : null,
      ...(last ? opts.patch ?? {} : {}),
    }
    const ins = await c.from('tc_entries').insert(row).select('id').single()
    if (ins.error) throw new Error(`The day after midnight could not be saved: ${ins.error.message}`)
    ids.push((ins.data as { id: number }).id)
  }
  return { lastId: ids[ids.length - 1], ids, recordedEnd: pieces[pieces.length - 1].end, realEnd: real }
}

// ── The automatic stop ──────────────────────────────────────────────────────

export interface AutoStop {
  eventId: number | null
  personId: string
  entryId: number
  jobcodeId: number | null
  windowStartedAt: string
  sessionStartedAt: string | null
  /** Where it stopped: recorded and real. */
  stoppedAt: string
  stoppedAtReal: string
}

/**
 * Stop a running clock whose 5-hour window has run out, at the 5-hour mark,
 * and log it for Clock safety. Does nothing (null) for a clock still inside
 * its window, or one another write already ended. Used by the safety job, and
 * by any action or panel that notices first ("as soon as it notices", SPEC 1L).
 */
export async function stopIfDue(c: Client, e: EntryRow, now: Date, dir: Directory, catalog: Catalog): Promise<AutoStop | null> {
  if (e.ended_at !== null || e.kind !== 'clock' || !e.started_at) return null
  const ws = windowStart(e)
  if (!ws || !safetyState(ws, now).due) return null
  const stop = stopPoint(ws, e.started_at)
  const zone = dir.zoneOf(e.person_id)
  const closed = await closeClock(c, e, stop.real, zone, { recordedEnd: stop.recorded, patch: { auto_stopped_at: stop.real } })
  if (!closed) return null

  const ev = await c.from('tc_safety_events').upsert({
    person_id: e.person_id,
    entry_id: closed.lastId,
    kind: 'auto_stop',
    at: now.toISOString(),
    window_started_at: ws,
    session_started_at: sessionStart(e),
    jobcode_id: e.jobcode_id,
    stopped_at: stop.real,
  }, { onConflict: 'person_id,kind,window_started_at' }).select('id').maybeSingle()
  if (ev.error) console.error('[clocky] safety event not written:', ev.error.message)

  await audit(c, [{
    entryId: closed.lastId, action: 'auto_stop', by: null,
    before: snapshot(e, catalog),
    after: snapshot({ ...e, ended_at: closed.recordedEnd, ended_at_real: stop.real }, catalog, { split_ids: closed.ids }),
  }])
  return {
    eventId: (ev.data as { id: number } | null)?.id ?? null,
    personId: e.person_id,
    entryId: closed.lastId,
    jobcodeId: e.jobcode_id,
    windowStartedAt: ws,
    sessionStartedAt: sessionStart(e),
    stoppedAt: closed.recordedEnd,
    stoppedAtReal: stop.real,
  }
}

// ── The stop at the hours allowance ─────────────────────────────────────────

export interface LimitStop {
  personId: string
  entryId: number
  /** Where it stopped: recorded (what counts) and real. */
  stoppedAt: string
  stoppedAtReal: string
}

/**
 * End a running clock where it reached the person's hours allowance (owner,
 * 25 October 2026), at that instant, with a line in its history naming the
 * allowance ("140h 00m allowance for October"). It is not the safety net's
 * automatic stop: the clock was not forgotten, the hours ran out, so there is
 * no end time to confirm (no auto_stopped_at). Clock safety lists it with its
 * own reason, "Allowance reached" (a limit_stop row, migration 126); a row
 * that cannot be written is logged and the clock stays stopped. Does nothing
 * (null) for a clock another write already ended.
 */
export async function stopAtLimit(c: Client, e: EntryRow, at: { real: string; recorded: string }, zone: string, catalog: Catalog, allowance: string, now: Date = new Date()): Promise<LimitStop | null> {
  if (e.ended_at !== null || e.kind !== 'clock' || !e.started_at) return null
  const closed = await closeClock(c, e, at.real, zone, { recordedEnd: at.recorded })
  if (!closed) return null
  try {
    const ev = await c.from('tc_safety_events')
      .upsert(limitStopEvent({ ...e, started_at: e.started_at }, closed.lastId, at.real, allowance, now), { onConflict: 'person_id,kind,window_started_at' })
    if (ev.error) console.error('[clocky] allowance stop not written to Clock safety:', ev.error.message)
  } catch (err) {
    console.error('[clocky] allowance stop not written to Clock safety:', (err as Error).message)
  }
  await audit(c, [{
    entryId: closed.lastId, action: 'auto_stop', by: null,
    before: snapshot(e, catalog),
    after: snapshot({ ...e, ended_at: closed.recordedEnd, ended_at_real: at.real }, catalog, { split_ids: closed.ids, allowance }),
  }])
  return { personId: e.person_id, entryId: closed.lastId, stoppedAt: closed.recordedEnd, stoppedAtReal: at.real }
}

// ── Checking what a form sent ───────────────────────────────────────────────

/**
 * The five fields as a form sent them, checked against their options: only
 * known values, the i7 Code only on i7 jobs, an empty value left out. A value
 * the entry already carries is kept even if its option has since been switched
 * off (an old imported entry), and fields the form does not ask (QuickBooks
 * Time's Tasks, the old i7 Rate) are carried over untouched.
 */
export function cleanFields(
  values: Readonly<Record<string, unknown>> | undefined,
  catalog: Catalog,
  job: { isI7: boolean; structure?: Structure } | undefined,
  keep: Readonly<Record<string, string>> = {},
): { fields: Record<string, string> } | { error: string } {
  const out: Record<string, string> = {}
  // Only the fields of the job's structure (the 2026 projects ask their own Activity).
  for (const f of fieldsOfStructure(catalog.fields, job?.structure)) {
    const v = String(values?.[f.id] ?? '').trim()
    if (!v) continue
    if (f.key === 'code' && !job?.isI7) continue
    if (!f.options.includes(v) && v !== keep[f.id]) return { error: `Choose ${FIELD_LABEL[f.key]} from the list.` }
    out[f.id] = v
  }
  for (const [k, v] of Object.entries(keep)) if (!catalog.fields.some(f => f.id === k) && v) out[k] = v
  return { fields: out }
}

/** Notes as saved: trimmed, at most 4,000 characters (QuickBooks Time's limit), null when empty. */
export function cleanNotes(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 4000)
  return s || null
}

/**
 * Give a finished entry new recorded times, cut at each midnight of the
 * person's zone like a clock that ran across it: the entry keeps the first
 * day, each further day becomes a row of its own (same job, fields and notes).
 * `patch` goes on the entry, `lastPatch` on the piece that holds the end.
 * Returns the ids, the entry first.
 */
export async function rewriteSpan(
  c: Client, e: EntryRow, start: string, end: string, zone: string,
  patch: Partial<EntryRow> = {}, lastPatch: Partial<EntryRow> = {},
): Promise<number[]> {
  const pieces = splitAtMidnight(start, end, zone)
  if (!pieces.length) pieces.push({ start, end, date: e.entry_date })
  const now = new Date().toISOString()
  const one = pieces.length === 1
  const { error } = await c.from('tc_entries').update({
    started_at: pieces[0].start,
    ended_at: pieces[0].end,
    duration_seconds: recordedSeconds(pieces[0].start, pieces[0].end),
    entry_date: pieces[0].date,
    updated_at: now,
    ...patch,
    ...(one ? lastPatch : {}),
  }).eq('id', e.id)
  if (error) throw new Error(`The entry could not be saved: ${error.message}`)
  const ids = [e.id]
  for (let i = 1; i < pieces.length; i++) {
    const p = pieces[i]
    const ins = await c.from('tc_entries').insert({
      person_id: e.person_id, jobcode_id: e.jobcode_id, started_at: p.start, ended_at: p.end,
      duration_seconds: recordedSeconds(p.start, p.end), entry_date: p.date, kind: 'clock', state: 'open',
      notes: e.notes, fields: e.fields, source: 'portal', created_by: e.created_by,
      session_started_at: e.session_started_at, window_started_at: e.window_started_at,
      edited_by: patch.edited_by ?? null, edited_at: patch.edited_at ?? null,
      ...(i === pieces.length - 1 ? lastPatch : {}),
    }).select('id').single()
    if (ins.error) throw new Error(`The day after midnight could not be saved: ${ins.error.message}`)
    ids.push((ins.data as { id: number }).id)
  }
  return ids
}
