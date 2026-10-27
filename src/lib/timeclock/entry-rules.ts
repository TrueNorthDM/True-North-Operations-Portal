/**
 * The rules every saved entry keeps (design handoff of 16 October 2026, README
 * "Rules" 8 and 11, SPEC sections 8, 9 and 13): no overlaps, no entry over 24
 * hours, entries crossing midnight split per day in the person's time zone,
 * the required fields, and what makes an entry "need attention".
 *
 * Pure. The server checks with it before it writes; the screens can show the
 * same answer before Save.
 */

import { wallToInstant } from './clock'
import { addDays } from './periods'
import { formatDuration } from './rounding'
import { localDate, minutesLabel, localMinutes } from './format'

export const DAY_SECONDS = 24 * 3600
/** "Over 10 hours" in Needs attention. */
export const LONG_ENTRY_SECONDS = 10 * 3600

// ── Copy (Time Entries.dc.html, 3E check line) ─────────────────────────────
export const END_AFTER_START = 'End must be after start.'
export const DURATION_FORMAT = 'Type a duration like 2h 30m, 2:30 or 2.5.'
export const OVER_24H = 'No entry can be longer than 24 hours.'

// ── A reason for every change (README "Rules" 7) ───────────────────────────

/** Server-side only: the screens keep Save and Delete off until a reason is typed. */
export const REASON_REQUIRED = 'Type the reason for the change first.'

/**
 * How approveTimesheet's refusal ends when hours over the allowance need a
 * note: Home's side panel opens its note field when an answer ends with it.
 */
export const NOTE_TO_APPROVE = 'Write a note to approve.'

/** The reason as it is kept (trimmed, at most 2,000 characters), or null when there is none. */
export function reasonOf(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 2000)
  return s || null
}

// ── Overlaps ────────────────────────────────────────────────────────────────

export interface Timed {
  id?: number | string
  start: string | null
  /** null while running: it counts to `now`. */
  end: string | null
}

/** The span two timed entries share, or null. A duration-only entry overlaps nothing. */
export function sharedSpan(a: Timed, b: Timed, now: Date): { start: string; end: string } | null {
  if (!a.start || !b.start) return null
  const ae = a.end ? Date.parse(a.end) : now.getTime()
  const be = b.end ? Date.parse(b.end) : now.getTime()
  const s = Math.max(Date.parse(a.start), Date.parse(b.start))
  const e = Math.min(ae, be)
  return s < e ? { start: new Date(s).toISOString(), end: new Date(e).toISOString() } : null
}

/** The first of `others` a span overlaps, with what they share. */
export function firstOverlap<T extends Timed>(span: Timed, others: readonly T[], now: Date): { other: T; start: string; end: string } | null {
  for (const o of others) {
    if (span.id !== undefined && o.id === span.id) continue
    const s = sharedSpan(span, o, now)
    if (s) return { other: o, ...s }
  }
  return null
}

/** Every entry of a list that overlaps another of the same person: id -> the other. */
export function overlapsAmong<T extends Timed & { personId: string }>(rows: readonly T[], now: Date): Map<T['id'], T> {
  const out = new Map<T['id'], T>()
  const byPerson = new Map<string, T[]>()
  for (const r of rows) if (r.start) (byPerson.get(r.personId) ?? byPerson.set(r.personId, []).get(r.personId)!).push(r)
  for (const list of byPerson.values()) {
    const sorted = [...list].sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sharedSpan(sorted[i], sorted[j], now)) {
          if (!out.has(sorted[i].id)) out.set(sorted[i].id, sorted[j])
          if (!out.has(sorted[j].id)) out.set(sorted[j].id, sorted[i])
        }
      }
    }
  }
  return out
}

/** 3E's red line: "7h 40m. Overlaps 9:00 to 9:45 AM with TN Admin." (times in the person's zone). */
export function overlapLine(seconds: number, shared: { start: string; end: string }, otherName: string, zone: string): string {
  return `${formatDuration(seconds)}. Overlaps ${minutesLabel(localMinutes(shared.start, zone))} to ${minutesLabel(localMinutes(shared.end, zone))} with ${otherName}.`
}

/** 3K's red line: the request may only cover time with no entry. */
export function correctionOverlapLine(shared: { start: string; end: string }, otherName: string, zone: string): string {
  return `Overlaps ${minutesLabel(localMinutes(shared.start, zone))} to ${minutesLabel(localMinutes(shared.end, zone))} with ${otherName}. Ask only for time you have no entry for.`
}

/** 3K-3, approving into an overlap: "It overlaps TN Admin (9:00 AM to 9:45 AM). Fix that entry before approving." */
export function approveOverlapLine(other: Timed, otherName: string, zone: string): string {
  const end = other.end ? minutesLabel(localMinutes(other.end, zone)) : 'now'
  return `It overlaps ${otherName} (${minutesLabel(localMinutes(other.start!, zone))} to ${end}). Fix that entry before approving.`
}

/**
 * 3F, "Trim the other entry" / "Trim this one": the new times, as the
 * prototype trims them. Null when nothing would be left of the one trimmed.
 */
export function trimOther(thisSpan: { start: string; end: string }, other: { start: string; end: string }): { start: string; end: string } | null {
  const r = Date.parse(other.start) < Date.parse(thisSpan.start)
    ? { start: other.start, end: thisSpan.start }
    : { start: thisSpan.end, end: other.end }
  return Date.parse(r.end) > Date.parse(r.start) ? r : null
}
export function trimThis(thisSpan: { start: string; end: string }, other: { start: string; end: string }): { start: string; end: string } | null {
  const r = Date.parse(thisSpan.start) >= Date.parse(other.start)
    ? { start: other.end, end: thisSpan.end }
    : { start: thisSpan.start, end: other.start }
  return Date.parse(r.end) > Date.parse(r.start) ? r : null
}

/** The toast when "Trim this one" leaves nothing (Time Entries.dc.html). */
export const NOTHING_LEFT = 'Nothing left to keep. Cancel instead.'

// ── Midnight ────────────────────────────────────────────────────────────────

/**
 * An entry crossing midnight, cut into one piece per day in the person's time
 * zone. Each piece carries the day it belongs to. A piece of no length is left
 * out (an entry ending exactly at midnight stays on its day).
 */
export function splitAtMidnight(start: string, end: string, zone: string): { start: string; end: string; date: string }[] {
  const out: { start: string; end: string; date: string }[] = []
  let s = start
  for (let guard = 0; guard < 400; guard++) {
    const date = localDate(s, zone)
    const midnight = wallToInstant(addDays(date, 1), '00:00', zone)
    if (!midnight || Date.parse(end) <= Date.parse(midnight)) {
      if (Date.parse(end) > Date.parse(s)) out.push({ start: s, end, date })
      break
    }
    if (Date.parse(midnight) > Date.parse(s)) out.push({ start: s, end: midnight, date })
    s = midnight
  }
  return out
}

// ── Required fields ─────────────────────────────────────────────────────────

/** tc_fields ids (as the fields JSON keys them) of the five fields the entry form asks. */
export interface FieldKeys {
  company: string | null
  project: string | null
  activity: string | null
  billable: string | null
  /** 1 - i7 Code: asked, and required, only for i7 jobs. */
  code: string | null
}

export type FieldName = 'company' | 'project' | 'activity' | 'billable' | 'code'
export type MissingName = FieldName | 'notes'

/** How each is named where it is missing ("Add Activity", "Missing Activity, Company"). */
export const FIELD_LABEL: Record<MissingName, string> = {
  company: 'Company', project: 'Project', activity: 'Activity', billable: 'Billable', code: 'i7 Code', notes: 'Notes',
}

/** Notes become required for an Activity that says to explain in the notes ("Other (indicate in Notes)"). */
export const activityNeedsNotes = (activity: string | null | undefined): boolean =>
  /in notes/i.test(activity ?? '') || /^(meeting: )?other$/i.test((activity ?? '').trim())

/**
 * 1 = the TSheets job tree, 2 = the 2026 structure (Client › Division ›
 * Project, structure-2026.ts). A field belongs to one of them: the 2026
 * structure asks only its own Activity, since Client, Division and Project
 * are the job and Billable comes from the project.
 */
export type Structure = 1 | 2

/** The fields a job of this structure asks; lists without a structure are the TSheets ones. */
export const fieldsOfStructure = <F extends { structure?: Structure }>(fields: readonly F[], structure: Structure | undefined): F[] =>
  fields.filter(f => (f.structure ?? 1) === (structure ?? 1))

/**
 * Which structure an entry on this day is recorded in: the 2026 one from the
 * switch date, the TSheets one before it (and while no date is set).
 */
export const structureOn = (day: string, switchDate: string | null | undefined): Structure =>
  switchDate && day >= switchDate ? 2 : 1

/** A job can be picked for an entry on this day: pickable at all, and of that day's structure. */
export const offeredOn = <J extends { selectable: boolean; structure?: Structure }>(job: J | null | undefined, day: string, switchDate: string | null | undefined): job is J =>
  !!job?.selectable && (job.structure ?? 1) === structureOn(day, switchDate)

/**
 * What an entry still lacks to switch or clock out (README "Rules" 11):
 * Company, Project, Activity and Billable always, the i7 Code on i7 jobs, and
 * notes when the Activity asks for them. In the order the panel asks.
 */
export function missingFields(
  fields: Readonly<Record<string, string>>,
  notes: string | null | undefined,
  keys: FieldKeys,
  isI7: boolean,
): MissingName[] {
  const has = (k: string | null) => !k || !!(fields[k] ?? '').trim()
  const out: MissingName[] = []
  for (const name of ['company', 'project', 'activity', 'billable'] as const) if (!has(keys[name])) out.push(name)
  if (isI7 && !has(keys.code)) out.push('code')
  const activity = keys.activity ? fields[keys.activity] : ''
  if (activityNeedsNotes(activity) && !(notes ?? '').trim()) out.push('notes')
  return out
}

/** The gate sentence of 1F: "Before you switch to TN Admin, finish the current entry:" / "Before you clock out, ...". */
export const gateText = (kind: 'switch' | 'out', toLabel?: string): string =>
  kind === 'out'
    ? 'Before you clock out, finish the current entry:'
    : `Before you switch${toLabel ? ` to ${toLabel}` : ''}, finish the current entry:`

// ── Needs attention (SPEC 3D, README "Time entries") ───────────────────────

export interface AttentionInput {
  kind: 'clock' | 'manual' | 'absence' | 'correction' | 'time_off'
  /** For corrections and time off: still pending. */
  pending?: boolean
  /** The viewer may decide this correction (their Team Lead, an Admin, a Super Admin), or this time off (Super Admin). */
  viewerDecides?: boolean
  autoStoppedUnconfirmed?: boolean
  missing?: readonly MissingName[]
  seconds?: number
  overlaps?: boolean
}

/**
 * The first reason an entry needs attention, or null, in the prototype's
 * order. Pending corrections count only for whoever can decide them; pending
 * time off only for Super Admins.
 */
export function attentionReason(x: AttentionInput): string | null {
  if (x.kind === 'correction') return x.pending && x.viewerDecides ? 'Correction request waiting for you' : null
  if (x.kind === 'time_off') return x.pending && x.viewerDecides ? 'Time off request waiting for you' : null
  if (x.kind === 'absence') return null
  if (x.autoStoppedUnconfirmed) return 'Auto clocked out, end time not confirmed'
  const order: MissingName[] = ['activity', 'company', 'project', 'billable', 'code']
  const miss = order.filter(m => x.missing?.includes(m)).map(m => FIELD_LABEL[m])
  if (miss.length) return `Missing ${miss.join(', ')}`
  if ((x.seconds ?? 0) > LONG_ENTRY_SECONDS) return 'Over 10 hours'
  if (x.overlaps) return 'Overlaps another entry'
  return null
}

/** The instant a wall-clock time on a day means in a zone, rounded to the quarter hour by the caller. */
export const instantOf = (date: string, time: string, zone: string): string | null => wallToInstant(date, time, zone)
