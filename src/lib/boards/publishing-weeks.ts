/**
 * The last four complete weeks of publishing, per board, for the Home widget.
 *
 * Week by week rather than four weeks added together, because a month that hits
 * its target can hide a week that missed badly, and the target is set per week.
 *
 * Complete weeks only, Monday to Sunday, ending with the Sunday just gone. The
 * current week is deliberately left out: it is always partly unfinished and
 * would read as behind every day until Friday.
 *
 * Reads the same two sources the dashboard reads, and reads them directly:
 * `monday_snapshot`, the warm store the nightly cron fills, and
 * `publishing_targets`. No Monday API call, so this costs the Home page a
 * couple of indexed reads rather than a third-party round trip.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { BOARDS } from './config'
import { enrichPublishingBoard } from './publishing'
import type { SnapshotBoard, TargetsMap } from './types'

export interface PublishingWeek {
  /** The Monday, as YYYY-MM-DD. */
  start: string
  /** "Aug 11", what the widget prints. */
  label: string
  done: number
  target: number
}

export interface PublishingBoardWeeks {
  boardId: string
  /** The client, not the board: "AskAnAdventistFriend", not "AAAF · Publishing". */
  name: string
  perWeek: number
  weeks: PublishingWeek[]
  /** How many of the four met their target. */
  hits: number
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The board's name without its " · Publishing" suffix, which the widget has no room for. */
function clientName(name: string): string {
  return name.split('·')[0].trim()
}

/**
 * The Mondays of the last four COMPLETE weeks, oldest first.
 *
 * Anchored on the most recent Sunday that has already passed, so a Monday
 * morning shows the week that just ended rather than one still running.
 */
export function lastFourWeeks(now: Date): { start: Date; end: Date }[] {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  // 0 is Sunday. Step back to the Monday that began the current week, then one
  // more week: that Monday starts the most recent complete week.
  const sinceMonday = (d.getUTCDay() + 6) % 7
  const thisMonday = new Date(d)
  thisMonday.setUTCDate(d.getUTCDate() - sinceMonday)

  const out: { start: Date; end: Date }[] = []
  for (let back = 4; back >= 1; back--) {
    const start = new Date(thisMonday)
    start.setUTCDate(thisMonday.getUTCDate() - back * 7)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    end.setUTCHours(23, 59, 59, 999)
    out.push({ start, end })
  }
  return out
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const weekLabel = (d: Date) => `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`

export async function loadPublishingWeeks(now = new Date()): Promise<PublishingBoardWeeks[]> {
  const boardIds = Object.keys(BOARDS).filter(id => BOARDS[id].publishingMode)
  if (boardIds.length === 0) return []

  const supabase = createAdminClient()
  const [{ data: snapRows }, { data: targetRows }] = await Promise.all([
    supabase.from('monday_snapshot').select('board_id, data').in('board_id', boardIds),
    supabase.from('publishing_targets').select('board_id, language, target_value').eq('period_type', 'weekly'),
  ])

  const targets: TargetsMap = {}
  for (const t of (targetRows ?? []) as { board_id: string; language: string; target_value: number }[]) {
    ;(targets[t.board_id] ??= {})[t.language] = Number(t.target_value)
  }

  const weeks = lastFourWeeks(now)
  const out: PublishingBoardWeeks[] = []

  for (const row of (snapRows ?? []) as { board_id: string; data: SnapshotBoard }[]) {
    const config = BOARDS[row.board_id]
    if (!config) continue

    // Summed across languages: the widget answers "did the client's week land",
    // and the per-language split is what the dashboard behind it is for.
    const perWeek = Object.values(targets[row.board_id] ?? {}).reduce((s, n) => s + n, 0)
    const items = enrichPublishingBoard(row.data, config)

    const counted = weeks.map(({ start, end }) => {
      const done = items.filter(it => {
        if (!it.isPublished || !it.publishedDate) return false
        const d = new Date(it.publishedDate)
        return d >= start && d <= end
      }).length
      return { start: ymd(start), label: weekLabel(start), done, target: perWeek }
    })

    out.push({
      boardId: row.board_id,
      name: clientName(config.name),
      perWeek,
      weeks: counted,
      hits: counted.filter(w => w.target > 0 && w.done >= w.target).length,
    })
  }

  // The order the boards are configured in, so the widget does not reshuffle
  // itself when one board happens to be written to the store first.
  return out.sort((a, b) => boardIds.indexOf(a.boardId) - boardIds.indexOf(b.boardId))
}
