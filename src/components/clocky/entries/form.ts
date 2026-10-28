/**
 * The state of the 3E form (Add time / Edit entry) and of 3K-1 (Request a
 * time correction), and how each turns into what the actions take. Pure.
 */

import { wallToInstant } from '@/lib/timeclock/clock'
import { addDays } from '@/lib/timeclock/periods'
import { formatDuration } from '@/lib/timeclock/rounding'
import { localMinutes } from '@/lib/timeclock/format'
import { sharedSpan } from '@/lib/timeclock/entry-rules'
import type { FieldName, Structure } from '@/lib/timeclock/entry-rules'
import type { ClockChoice, EntryView, PanelField, PanelJob } from '@/lib/timeclock/clocky-types'
import { hhmmOf, isWork, type Bounds } from './model'

export type FieldValues = Record<FieldName, string>
export const EMPTY_VALUES: FieldValues = { company: '', project: '', activity: '', billable: '', code: '' }

/** The fields in the order the form asks them: 1 Company, 2 Project, 3 Activity, 4 Billable, 1 - i7 Code. */
export const FIELD_ORDER: readonly FieldName[] = ['company', 'project', 'activity', 'billable', 'code']

export interface FormState {
  /** The entry being edited, or null for "Add time". */
  id: number | null
  personId: string
  personName: string
  zone: string
  date: string
  type: 'range' | 'dur'
  /** Minutes of the day, in the person's zone. */
  start: number
  end: number | 'now'
  dur: string
  /** The chosen combination's id, as text ('' for none). */
  combo: string
  jobcodeId: number | null
  /** The entry's own job path, kept as an option when it is no longer offered. */
  jobPath: string
  /** The entry's own job's structure, for its fields when that job is no longer offered. */
  structure?: Structure
  /** The 2026 structure, picked on the clock panel's first screen: Browse open (its folder and search), the form's
   *  remount key (a row or Browse refills it), and My combinations showing all. */
  browsing?: { folder: number | null; query: string } | null
  formKey?: number
  more?: boolean
  values: FieldValues
  /** Filled from the job's history ("auto"). */
  auto: Partial<Record<FieldName, boolean>>
  notes: string
  reason: string
  running: boolean
  /** A User on their own entry: times only inward. */
  bounds: Bounds | null
  /** 3F's choice, sent with Save. */
  fix: { otherId: number; trim: 'other' | 'this' } | null
  /** What that choice does, said under the times in place of the overlap line. */
  fixNote: string | null
  /** The server's refusal, shown on the check line. */
  error: string | null
}

/** "Add time" for someone, on a day, with times filled (the timeline's drag) or 2 PM to 3 PM. */
export function blankForm(p: { personId: string; personName: string; zone: string; date: string; start?: number; end?: number }): FormState {
  const start = p.start ?? 14 * 60
  const end = p.end ?? 15 * 60
  return {
    id: null, personId: p.personId, personName: p.personName, zone: p.zone, date: p.date, type: 'range',
    start, end, dur: formatDuration((end - start) * 60), combo: '', jobcodeId: null, jobPath: '',
    values: { ...EMPTY_VALUES }, auto: {}, notes: '', reason: '', running: false, bounds: null, fix: null, fixNote: null, error: null,
  }
}

/** "Edit entry" on a row. A User's own entry carries its bounds (shorten only). */
export function formFromRow(r: EntryView): FormState {
  const start = r.start ? localMinutes(r.start, r.zone) : 9 * 60
  const end: number | 'now' = r.running ? 'now' : r.start && r.end ? localMinutes(r.end, r.zone) : 10 * 60
  return {
    id: r.id, personId: r.personId, personName: r.personName, zone: r.zone, date: r.date,
    type: r.start ? 'range' : 'dur', start, end, dur: formatDuration(r.seconds), combo: '',
    jobcodeId: r.jobcodeId, jobPath: r.path, structure: r.structure,
    values: { company: r.company, project: r.project, activity: r.activity, billable: r.billable, code: r.code },
    auto: {}, notes: r.notes, reason: '', running: r.running,
    bounds: r.shortenOnly ? { start: r.start ? start : null, end: r.start && !r.running ? (end as number) : null, seconds: r.start ? null : r.seconds } : null,
    fix: null, fixNote: null, error: null,
  }
}

/**
 * The job whose fields the form asks and sends: the one picked from the list,
 * else the entry's own (switched off since, so not in the list) by its
 * structure. Without it a 2026 project's Activity was sent as the TSheets one
 * and the server dropped it.
 */
export function formJob(f: Pick<FormState, 'jobcodeId' | 'structure'>, jobs: readonly PanelJob[]): PanelJob | { structure: Structure } | undefined {
  return jobs.find(j => j.id === f.jobcodeId) ?? (f.structure ? { structure: f.structure } : undefined)
}

/** The values a set of fields carries, by name (a combination's, an entry's). */
export function valuesOf(fields: Readonly<Record<string, string>>, defs: readonly PanelField[]): FieldValues {
  const out = { ...EMPTY_VALUES }
  for (const f of defs) out[f.key] = fields[f.id] ?? ''
  return out
}

/** The fields the actions take: tc_fields id -> value, the i7 Code only on i7 jobs, nothing empty. */
export function fieldsOf(values: FieldValues, defs: readonly PanelField[], isI7: boolean): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of defs) {
    if (f.required === 'i7' && !isI7) continue
    const v = values[f.key]?.trim()
    if (v) out[f.id] = v
  }
  return out
}

/**
 * A job picked: Company, Project and Billable (and the i7 Code on an i7 job)
 * come from the job's usual values, marked "auto"; Activity stays the person's.
 */
export function withJob(values: FieldValues, jobId: number, isI7: boolean, defaults: Readonly<Record<string, Record<string, string>>>, defs: readonly PanelField[]): { values: FieldValues; auto: Partial<Record<FieldName, boolean>> } {
  const d = defaults[String(jobId)] ?? {}
  const byName = valuesOf(d, defs)
  const next: FieldValues = { ...values, company: byName.company, project: byName.project, billable: byName.billable, code: isI7 ? byName.code : '' }
  return { values: next, auto: { company: !!byName.company, project: !!byName.project, billable: !!byName.billable, code: isI7 && !!byName.code } }
}

/** A combination picked: its job and fields. */
export function withCombination(c: ClockChoice, defs: readonly PanelField[]): { jobcodeId: number; values: FieldValues } {
  return { jobcodeId: c.jobcodeId, values: valuesOf(c.fields, defs) }
}

/** The form's span as instants, in the person's zone (the end is now while running). */
export function formSpan(f: Pick<FormState, 'date' | 'start' | 'end' | 'zone' | 'type'>, nowMs: number): { start: string; end: string } | null {
  if (f.type !== 'range') return null
  const start = wallToInstant(f.date, hhmmOf(f.start), f.zone)
  if (!start) return null
  if (f.end === 'now') return { start, end: new Date(nowMs).toISOString() }
  // An end at or before the start on the clock is the next day only past midnight: never, here.
  const end = wallToInstant(f.end === 0 ? addDays(f.date, 1) : f.date, hhmmOf(f.end), f.zone)
  return end ? { start, end } : null
}

/** The first entry of the person's that a span runs into, among the rows on screen. */
export function overlapAmong(span: { start: string; end: string }, personId: string, rows: readonly EntryView[], exceptKey: string | null, nowMs: number): { row: EntryView; start: string; end: string } | null {
  const now = new Date(nowMs)
  for (const r of rows) {
    if (r.personId !== personId || !isWork(r) || !r.start || r.key === exceptKey) continue
    const s = sharedSpan({ start: span.start, end: span.end }, { start: r.start, end: r.end }, now)
    if (s) return { row: r, ...s }
  }
  return null
}

// ── 3K-1 ────────────────────────────────────────────────────────────────────

export interface RequestState {
  date: string
  start: number
  end: number
  combo: string
  jobcodeId: number | null
  values: FieldValues
  reason: string
  error: string | null
}

export function blankRequest(p: Partial<RequestState> & { date: string }): RequestState {
  return { start: 15 * 60, end: 16 * 60, combo: '', jobcodeId: null, values: { ...EMPTY_VALUES }, reason: '', error: null, ...p }
}
