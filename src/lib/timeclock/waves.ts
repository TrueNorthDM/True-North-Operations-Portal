/**
 * North Time start date per person (owner's decision, 27 October 2026). The
 * rollout is in two waves, each starting on its own day:
 *
 *   wave 1  everyone at Team Leader level or above (Super Admin, Admin, Lead
 *           of any team) automatically, plus anyone moved there by hand
 *   wave 2  everyone else
 *
 * A Super Admin sets the two days in Company settings > North Time rollout,
 * and can move a person to the other wave (tc_rollout_people). Until a wave
 * has a day, its people have no start date and nothing changes for them: the
 * clock works as before and the import keeps taking their TSheets hours.
 *
 * From the start date, in the person's own time zone:
 *   - the North Time clock starts for them (before it, Clock in says the day);
 *   - the TSheets import stops taking their entries dated on or after it and
 *     sets them aside in tc_import_skipped for someone to decide;
 *   - their TSheets account is archived (only with TSHEETS_ARCHIVE_USERS=on).
 *
 * Pure: the settings page, the clock, the import and the archive cron all
 * decide with these functions, so they can never disagree.
 */

import { MONTH_SHORT } from '@/lib/format/months'
import type { AccessLevel } from '@/lib/access/catalogue'

export type Wave = 1 | 2

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
  /** The day they start on North Time, or null while their wave has no date. */
  startsOn: string | null
}

/** Team Leader and above: wave 1 without anyone adding them. */
export function automaticWave(p: WavePerson): Wave {
  return p.leader || p.level === 'super_admin' || p.level === 'admin' || p.level === 'team_leader' ? 1 : 2
}

/** The person's wave and start date: a hand-set wave wins over the automatic one. */
export function personWave(p: WavePerson, override: Wave | null | undefined, dates: WaveDates): PersonWave {
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

/** The clock's gate: the sentence to show, or null when the clock may start. */
export function clockGate(startsOn: string | null, today: string): string | null {
  return beforeStart(startsOn, today) ? notYetMessage(startsOn!) : null
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

// ── The TSheets archive ─────────────────────────────────────────────────────

export interface ArchiveCandidate { personId: string; tsheetsUserId: number; startsOn: string | null; today: string }

/** The accounts to archive now: the person has started and the account was not archived yet. */
export function dueForArchive<C extends ArchiveCandidate>(list: readonly C[], archived: ReadonlySet<number>): C[] {
  return list.filter(c => hasStarted(c.startsOn, c.today) && !archived.has(c.tsheetsUserId))
}

/**
 * Whether the archive writes to TSheets: only when TSHEETS_ARCHIVE_USERS is
 * exactly "on". The staging copy reads the same TSheets account as
 * production, so there it also needs TSHEETS_ARCHIVE_ON_STAGING=on; without
 * both, the job only logs what it would do.
 */
export const archiveEnabled = (flag: string | undefined, staging = false, stagingFlag?: string): boolean =>
  flag === 'on' && (!staging || stagingFlag === 'on')
