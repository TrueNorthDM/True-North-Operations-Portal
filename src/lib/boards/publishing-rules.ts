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
 *
 * And the calendar: a week runs Monday 00:00 to Sunday 23:59 in New York.
 */

import type { Db } from '@/lib/supabase/types'
import { addDays, weekOf, zoneDate, zoneTime } from '@/lib/notifications/schedule'
import { languageName } from '@/lib/language-display'
import type { TargetsMap } from './types'

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
}

function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`Publishing goals could not read ${what}: ${error.message}`)
}

export async function loadPublishingRules(db: Db): Promise<PublishingRules> {
  const [pubs, periods, sites] = await Promise.all([
    db.from('publishing_publishers').select('name').order('name'),
    db.from('publishing_target_periods').select('board_id, language, target_value, valid_from, valid_to'),
    db.from('sites').select('monday_board_id, paused_languages'),
  ])
  failed('the publishers', pubs.error)
  failed('the targets', periods.error)
  failed('the sites', sites.error)

  const paused: Record<string, string[]> = {}
  for (const s of (sites.data ?? []) as { monday_board_id: string | null; paused_languages: string[] | null }[]) {
    if (!s.monday_board_id || !s.paused_languages?.length) continue
    paused[s.monday_board_id] = s.paused_languages.map(languageName)
  }

  return {
    publishers: ((pubs.data ?? []) as { name: string }[]).map(p => p.name),
    periods: ((periods.data ?? []) as { board_id: string; language: string; target_value: number; valid_from: string; valid_to: string | null }[])
      .map(p => ({ boardId: p.board_id, language: p.language, target: Number(p.target_value), from: p.valid_from, to: p.valid_to })),
    paused,
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
