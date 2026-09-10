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
 *
 * It also counts with the dashboard's own function rather than a second copy of
 * the rules. The card is a link to that dashboard, so a number here that does
 * not match the number there is worse than no number: both pages look
 * authoritative and only one can be right. Calling `computePublishingMetrics`
 * once per week is a few more objects allocated and makes disagreement
 * impossible.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { BOARDS } from './config'
import { computePublishingMetrics, enrichPublishingBoard } from './publishing'
import type { PublishedItem } from './publishing'
import type { SnapshotBoard, TargetsMap } from './types'

export interface PublishingWeek {
  /** The Monday, as YYYY-MM-DD. */
  start: string
  /** "Aug 10-16", what the widget prints. */
  label: string
  done: number
  target: number
  /**
   * English on its own, or null when the board has no English target.
   *
   * It is carried separately because the total can hide it completely: in the
   * week of 24 August, AskAnAdventistFriend published 15 against a target of 11
   * while English sat at 0 of 2, and three overachieving translations covered
   * the whole miss.
   */
  en: { done: number; target: number } | null
}

export interface PublishingBoardWeeks {
  boardId: string
  /** The client, not the board: "AskAnAdventistFriend", not "AAAF · Publishing". */
  name: string
  perWeek: number
  /** The English slice of `perWeek`, 0 when the board has no English target. */
  enPerWeek: number
  weeks: PublishingWeek[]
  /** How many of the four met their target, all languages together. */
  hits: number
  /** How many of the four met the English target alone. */
  enHits: number
}

/**
 * The language key, exactly as `publishing_targets` and Monday spell it.
 *
 * It is the text of a Monday dropdown, so a rename on the board would silently
 * turn the English column into a dash rather than crash. That is the reason the
 * widget treats "no English target" as a real state instead of assuming one.
 */
const ENGLISH = 'English'

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

/**
 * "Aug 10-16": both ends, because a single date does not say whether it is the
 * week's first day or its last, and readers guessed wrong.
 *
 * The month is repeated only when the week crosses one, so the common case
 * stays short enough for the column: "Aug 31-Sep 6", but "Aug 10-16".
 */
export function weekLabel(start: Date, end: Date): string {
  const from = `${MON[start.getUTCMonth()]} ${start.getUTCDate()}`
  const to = start.getUTCMonth() === end.getUTCMonth()
    ? `${end.getUTCDate()}`
    : `${MON[end.getUTCMonth()]} ${end.getUTCDate()}`
  return `${from}-${to}`
}

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

  // One flat list, the shape the dashboard's aggregator takes. It does its own
  // per-board filtering, so there is nothing to keep separated here.
  const items: PublishedItem[] = []
  const names: Record<string, string> = {}
  for (const row of (snapRows ?? []) as { board_id: string; data: SnapshotBoard }[]) {
    const config = BOARDS[row.board_id]
    if (!config) continue
    names[row.board_id] = clientName(config.name)
    items.push(...enrichPublishingBoard(row.data, config))
  }

  // "lastweek" only for its arithmetic: it is the period that means exactly one
  // week, so a board's target comes back as its weekly target rather than a
  // multiple of it. The label it carries is thrown away.
  const perWeekStats = weeks.map(({ start, end }) => {
    const m = computePublishingMetrics(items, targets, 'lastweek', start, end)
    return Object.fromEntries(m.boards.map(b => [b.boardId, b]))
  })

  const out: PublishingBoardWeeks[] = []
  for (const boardId of Object.keys(names)) {
    // Summed across languages, which is the dashboard's own board total: the
    // widget answers "did the client's week land", and the full per-language
    // split is what the dashboard behind it is for. English is the one language
    // pulled back out, because it is the one that goes missing unnoticed.
    const langTargets = targets[boardId] ?? {}
    const perWeek = Object.values(langTargets).reduce((s, n) => s + n, 0)
    const enPerWeek = langTargets[ENGLISH] ?? 0

    const counted = weeks.map(({ start, end }, i) => {
      // A board with no targets row gets no stat at all, which is not the same
      // as a bad week: `perWeek` is 0 too, and the widget says so instead of
      // drawing four failed weeks.
      const stat = perWeekStats[i][boardId]
      const en = stat?.langs.find(l => l.lang === ENGLISH)
      return {
        start: ymd(start),
        label: weekLabel(start, end),
        done: stat?.done ?? 0,
        target: perWeek,
        en: enPerWeek > 0 ? { done: en?.done ?? 0, target: enPerWeek } : null,
      }
    })

    out.push({
      boardId,
      name: names[boardId],
      perWeek,
      enPerWeek,
      weeks: counted,
      hits: counted.filter(w => w.target > 0 && w.done >= w.target).length,
      enHits: counted.filter(w => w.en && w.en.done >= w.en.target).length,
    })
  }

  // The order the boards are configured in, so the widget does not reshuffle
  // itself when one board happens to be written to the store first.
  return out.sort((a, b) => boardIds.indexOf(a.boardId) - boardIds.indexOf(b.boardId))
}
