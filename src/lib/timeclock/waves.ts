/**
 * North Time start date per person (owner's decision, 27 October 2026). The
 * rollout is in two waves, each starting on its own day:
 *
 *   wave 1  everyone at Team Leader level or above (Super Admin, Admin, Lead
 *           of any team) automatically, plus anyone moved there by hand
 *   wave 2  everyone else
 *   no wave (0)  people it is not yet known whether they will use North Time
 *           (owner, 5 November 2026, migration 154): only by hand, never by
 *           level. They have no start date while there: the clock, Switch and
 *           Add time refuse for them (noWaveMessage), the import keeps every
 *           TSheets entry of theirs, and North Time's timesheet and invoice
 *           reminders leave them out. "Not started", never "started".
 *
 * A Super Admin sets the two days in Company settings > North Time rollout,
 * and can move a person to the other wave or to no wave (tc_rollout_people). Until a wave
 * has a day, its people have no start date and nothing changes for them: the
 * clock works as before and the import keeps taking their TSheets hours.
 *
 * From the start date, in the person's own time zone:
 *   - the North Time clock starts for them (before it, Clock in says the day),
 *     and its 12-hour and allowance stops act on their own clocks;
 *   - Add time and the week grid take hours dated from it (entryStartGate);
 *   - the TSheets import stops taking their entries dated on or after it and
 *     sets them aside in tc_import_skipped for someone to decide;
 *
 * Pure: the settings page, the clock, the import and the archive cron all
 * decide with these functions, so they can never disagree.
 */

import { MONTH_SHORT } from '@/lib/format/months'
import type { AccessLevel } from '@/lib/access/catalogue'

/** 1 and 2 are the dated waves; 0 is "No wave" (no start date, set by hand only). */
export type Wave = 1 | 2 | 0
/** A wave with a start day. */
export type DatedWave = 1 | 2

export const NO_WAVE = 0 as const

/** A value saved in tc_rollout_people.wave (migration 154 allows 0). */
export function isWave(v: unknown): v is Wave {
  return v === 0 || v === 1 || v === 2
}

/**
 * What the rollout form may send for a person: 1 or 2, 0 or 'none' (no wave),
 * or null (follow their level again). Anything else is undefined: refused.
 */
export function waveChoice(v: unknown): Wave | null | undefined {
  if (v === null) return null
  if (v === 'none') return NO_WAVE
  return isWave(v) ? v : undefined
}

/** The two waves' days, YYYY-MM-DD, or null while not set. */
export interface WaveDates { 1: string | null; 2: string | null }

export const NO_DATES: WaveDates = { 1: null, 2: null }

export interface WavePerson {
  level: AccessLevel
  /** Lead of at least one team (a Team Leader by position, whatever level they were given). */
  leader?: boolean
}

export interface PersonWave {
  wave: Wave
  /** Where the wave comes from: their level, or a Super Admin moved them. */
  by: 'level' | 'hand'
  /** The day they start on North Time, or null while their wave has no date (always null for no wave). */
  startsOn: string | null
}

/** Team Leader and above: wave 1 without anyone adding them. */
export function automaticWave(p: WavePerson): DatedWave {
  return p.leader || p.level === 'super_admin' || p.level === 'admin' || p.level === 'team_leader' ? 1 : 2
}

/**
 * The person's wave and start date: a hand-set wave wins over the automatic
 * one. No wave (0) has no start date whatever their level and the dates.
 */
export function personWave(p: WavePerson, override: Wave | null | undefined, dates: WaveDates): PersonWave {
  if (override === NO_WAVE) return { wave: NO_WAVE, by: 'hand', startsOn: null }
  const wave = override === 1 || override === 2 ? override : automaticWave(p)
  return { wave, by: override === 1 || override === 2 ? 'hand' : 'level', startsOn: dates[wave] ?? null }
}

/** Whether `today` (the person's own calendar day) is before their start date. No date: never. */
export function beforeStart(startsOn: string | null, today: string): boolean {
  return !!startsOn && today < startsOn
}

/** On or after the start date. No date: never. */
export function hasStarted(startsOn: string | null, today: string): boolean {
  return !!startsOn && today >= startsOn
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** "Sunday, Nov 22" */
export function startDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${WEEKDAY_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTH_SHORT[m - 1]} ${d}`
}

/** What the clock says before the person's start date. */
export function notYetMessage(startsOn: string): string {
  return `You start on North Time on ${startDayLabel(startsOn)}. Until then, keep clocking in TSheets.`
}

/** What the clock and Add time say to someone in no wave: they are not on North Time. */
export const NO_WAVE_MESSAGE = 'You are not on North Time yet. Keep recording your time in TSheets.'

/** The same, when someone adds time for a person in no wave. */
export function noWaveFor(name: string): string {
  return `${name} is not on North Time yet: their time stays in TSheets.`
}

/**
 * The clock's gate: the sentence to show, or null when the clock may start.
 * No wave refuses on every day, dates set or not.
 */
export function clockGate(startsOn: string | null, today: string, noWave = false): string | null {
  if (noWave) return NO_WAVE_MESSAGE
  return beforeStart(startsOn, today) ? notYetMessage(startsOn!) : null
}

/** A person's start as read from the database; `unread` when the read failed. */
export interface StartRead { startsOn: string | null; noWave: boolean; unread?: boolean }

/** What North Time says when it could not read a start date: it fails closed, never "no gate". */
export const START_UNREAD = 'North Time could not check your start date. Try again in a moment.'

/** The same, about someone else's start date. */
export function startUnreadFor(name: string): string {
  return `North Time could not check ${name}'s start date. Try again in a moment.`
}

/** The clock's gate from a read start: a failed read refuses, as no wave and a day before the start do. */
export function clockGateOf(s: StartRead, today: string): string | null {
  if (s.unread) return START_UNREAD
  return clockGate(s.startsOn, today, s.noWave)
}

/**
 * Whether North Time acts on a person's clock today (the 12-hour stop, the
 * allowance stop): only once their start date has arrived in their own zone,
 * never in no wave, never on a failed read.
 */
export function startedOn(s: StartRead, today: string): boolean {
  return !s.unread && !s.noWave && hasStarted(s.startsOn, today)
}

/** "Your North Time starts on Sunday, Nov 22. Until then, keep recording your time in TSheets." */
export function startsLaterMessage(startsOn: string): string {
  return `Your North Time starts on ${startDayLabel(startsOn)}. Until then, keep recording your time in TSheets.`
}

/** The same, about someone else. */
export function startsLaterFor(name: string, startsOn: string): string {
  return `${name}'s North Time starts on ${startDayLabel(startsOn)}. Time before then stays in TSheets.`
}

/** No start date yet (their wave has no day): TSheets keeps every hour. */
export const NO_START_MESSAGE = 'Your North Time start date is not set yet. Keep recording your time in TSheets.'

export function noStartFor(name: string): string {
  return `${name} has no North Time start date yet: their time stays in TSheets.`
}

/**
 * The gate on hours typed in (Add time, the week grid, and a person's own
 * edits and deletes): refused for anyone in no wave or with no start date,
 * and for any of `days` before the start date. TSheets owns those hours and
 * the import copies them, so an entry here would count them twice. `name` is
 * null for one's own hours ("Your..."), else the person's name. Pure.
 */
export function entryStartGate(s: StartRead, days: readonly string[], name: string | null): string | null {
  if (s.unread) return name ? startUnreadFor(name) : START_UNREAD
  if (s.noWave) return name ? noWaveFor(name) : NO_WAVE_MESSAGE
  if (!s.startsOn) return name ? noStartFor(name) : NO_START_MESSAGE
  return days.some(d => d < s.startsOn!) ? (name ? startsLaterFor(name, s.startsOn) : startsLaterMessage(s.startsOn)) : null
}

/** A valid start day: a real calendar date, YYYY-MM-DD. */
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * The two dates as a Super Admin may save them: each a real day or empty, and
 * wave 2 never before wave 1 (Team Leaders start first, so they can help).
 */
export function checkDates(d: { 1: unknown; 2: unknown }): { ok: true; dates: WaveDates } | { ok: false; error: string } {
  const one = d[1] === '' || d[1] == null ? null : d[1]
  const two = d[2] === '' || d[2] == null ? null : d[2]
  if (one !== null && !isDay(one)) return { ok: false, error: 'The wave 1 date is not a day. Pick it on the calendar.' }
  if (two !== null && !isDay(two)) return { ok: false, error: 'The wave 2 date is not a day. Pick it on the calendar.' }
  if (one && two && two < one) return { ok: false, error: 'Wave 2 starts after wave 1: Team Leaders start first.' }
  return { ok: true, dates: { 1: one, 2: two } }
}

// ── The import ──────────────────────────────────────────────────────────────

/**
 * Which TSheets entries the import still writes to tc_entries and which it
 * sets aside: an entry dated on or after its person's start date is set
 * aside (kept whole in tc_import_skipped), never dropped. People with no
 * start date, and entries before it, import as before.
 */
export function splitByStart<T extends { person_id: string; entry_date: string }>(
  rows: readonly T[], starts: ReadonlyMap<string, string>,
): { keep: T[]; skip: (T & { starts_on: string })[] } {
  const keep: T[] = []
  const skip: (T & { starts_on: string })[] = []
  for (const r of rows) {
    const s = starts.get(r.person_id)
    if (s && r.entry_date >= s) skip.push({ ...r, starts_on: s })
    else keep.push(r)
  }
  return { keep, skip }
}
