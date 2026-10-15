/**
 * The rules the publishing goals are counted by, read once from the database
 * (migration 106, decided 10 October 2026), for the Home card, the behind-pace
 * notification and the Publishing Goals dashboard alike:
 *
 *   publishers  who counts as the publisher of a page: a list in Settings, not
 *               two names written into the code twice
 *   periods     each target and the weeks it was in force: a change applies
 *               from the week it is made, past weeks keep the target they had
 *   paused      a language paused on the site is left out of targets and counts,
 *               as Settings promises
 *   cadence     each board's rhythm: every week, or two-week cycles from a start
 *               Monday (15 October 2026, migration 111; publishing-cycles.ts)
 *
 * And the calendar: a week runs Monday 00:00 to Sunday 23:59 in New York.
 */

import type { Db } from '@/lib/supabase/types'
import { addDays, weekOf, zoneDate, zoneTime } from '@/lib/notifications/schedule'
import { languageName } from '@/lib/language-display'
import type { TargetsMap } from './types'
import { toCadence, type Cadence, type Cycle } from './publishing-cycles'

export const PUBLISHING_ZONE = 'America/New_York'

export interface TargetPeriod {
  boardId: string
  language: string
  target: number
  /** The Monday it started, YYYY-MM-DD. */
  from: string
  /** The Sunday it ended, or null while in force. */
  to: string | null
}

export interface PublishingRules {
  publishers: string[]
  periods: TargetPeriod[]
  /** Board id -> language names paused on its site. */
  paused: Record<string, string[]>
  /** Board id -> its rhythm. A board missing here is weekly. */
  cadence: Record<string, Cadence>
}

/** A publishing board's site row: what the goals read from it. */
export interface PublishingSite {
  boardId: string
  /** Language codes the site publishes ("en"). */
  languages: string[]
  /** Language codes paused on the site. */
  paused: string[]
  cadence: Cadence
}

function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`Publishing goals could not read ${what}: ${error.message}`)
}

/**
 * The sites rows that belong to a Monday board. Deployed before migration 111
 * is applied, the cadence columns do not exist and the whole read would fail,
 * taking the Home card, the dashboard and Settings with it: the read is made
 * again without them, every board weekly, and the log says why.
 */
export async function readPublishingSites(db: Db): Promise<PublishingSite[]> {
  type Row = { monday_board_id: string | null; languages: string[] | null; paused_languages: string[] | null; target_cycle_weeks?: number | null; target_cycle_start?: string | null }
  let res = await db.from('sites').select('monday_board_id, languages, paused_languages, target_cycle_weeks, target_cycle_start')
  if (res.error && /target_cycle/.test(res.error.message)) {
    console.warn('[publishing] sites has no cadence columns, apply migration 111:', res.error.message)
    res = await db.from('sites').select('monday_board_id, languages, paused_languages') as typeof res
  }
  failed('the sites', res.error)
  return ((res.data ?? []) as Row[])
    .filter(s => s.monday_board_id)
    .map(s => ({
      boardId: s.monday_board_id as string,
      languages: s.languages ?? [],
      paused: s.paused_languages ?? [],
      cadence: toCadence(s.target_cycle_weeks, s.target_cycle_start),
    }))
}

export async function loadPublishingRules(db: Db): Promise<PublishingRules> {
  const [pubs, periods, sites] = await Promise.all([
    db.from('publishing_publishers').select('name').order('name'),
    db.from('publishing_target_periods').select('board_id, language, target_value, valid_from, valid_to'),
    readPublishingSites(db),
  ])
  failed('the publishers', pubs.error)
  failed('the targets', periods.error)

  const paused: Record<string, string[]> = {}
  const cadence: Record<string, Cadence> = {}
  for (const s of sites) {
    cadence[s.boardId] = s.cadence
    if (s.paused.length) paused[s.boardId] = s.paused.map(languageName)
  }

  return {
    publishers: ((pubs.data ?? []) as { name: string }[]).map(p => p.name),
    periods: ((periods.data ?? []) as { board_id: string; language: string; target_value: number; valid_from: string; valid_to: string | null }[])
      .map(p => ({ boardId: p.board_id, language: p.language, target: Number(p.target_value), from: p.valid_from, to: p.valid_to })),
    paused,
    cadence,
  }
}

/** Whether a Monday name is one of the publishers: the full name, any case, trimmed. */
export function publisherTest(publishers: readonly string[]): (name: string | null | undefined) => boolean {
  const set = new Set(publishers.map(p => p.trim().toLowerCase()))
  return name => set.has(String(name ?? '').trim().toLowerCase())
}

/** The weekly targets in force in the week starting this Monday, paused languages left out. */
export function targetsForWeek(rules: Pick<PublishingRules, 'periods' | 'paused'>, monday: string): TargetsMap {
  const out: TargetsMap = {}
  for (const p of rules.periods) {
    if (p.from > monday || (p.to !== null && p.to < monday)) continue
    if (rules.paused[p.boardId]?.includes(p.language)) continue
    ;(out[p.boardId] ??= {})[p.language] = p.target
  }
  return out
}

/** The Monday (New York) of the week a moment falls in. */
export function weekStartDay(at: Date): string {
  return weekOf(zoneDate(at, PUBLISHING_ZONE))
}

/** A week as two instants: Monday 00:00 and Sunday 23:59:59.999, New York. */
export function weekBounds(monday: string): { start: Date; end: Date } {
  const start = zoneTime(monday, 0, PUBLISHING_ZONE)
  const end = new Date(zoneTime(addDays(monday, 7), 0, PUBLISHING_ZONE).getTime() - 1)
  return { start, end }
}

/** A two-week cycle as two instants: its Monday 00:00 and its last Sunday 23:59:59.999, New York. */
export function cycleBounds(cycle: Cycle): { start: Date; end: Date } {
  return { start: weekBounds(cycle.start).start, end: weekBounds(addDays(cycle.start, 7)).end }
}
