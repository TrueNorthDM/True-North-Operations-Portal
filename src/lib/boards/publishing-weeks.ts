/**
 * The last four complete weeks of publishing, per board, for the Home widget.
 *
 * Week by week rather than four weeks added together, because a month that hits
 * its target can hide a week that missed badly, and the target is set per week.
 *
 * Complete weeks only, Monday to Sunday in New York, ending with the Sunday
 * just gone. The current week is deliberately left out: it is always partly
 * unfinished and would read as behind every day until Friday. Each week is
 * judged against the targets in force that week, by the rules in
 * publishing-rules.ts (decided 10 October 2026).
 *
 * Reads `monday_snapshot.published_items` and `publishing_targets`: two small
 * indexed reads. It used to read `monday_snapshot.data`, and this comment used to
 * say that was cheap. It was 26.7 MB of JSON between the two boards, on every load
 * of the Home page, to count a few dozen pages. The ingest now stores just the
 * facts the count needs beside the snapshot; see published-items.ts.
 *
 * The dashboard (public/boards.html) counts in its own JavaScript, so the two
 * share their rules through /api/targets rather than one function: the same
 * publishers, the same target periods, the same paused languages and the same
 * New York weeks.
 *
 * A read that fails throws: the card says it could not read, rather than
 * showing "no target" or nothing (audit, 10 October 2026).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { addDays } from '@/lib/notifications/schedule'
import { BOARDS } from './config'
import { computePublishingMetrics, enrichPublishingBoard } from './publishing'
import type { PublishedItem } from './publishing'
import { isCompactList, toPublishedItems } from './published-items'
import { loadPublishingRules, publisherTest, targetsForWeek, weekBounds, weekStartDay } from './publishing-rules'
import type { SnapshotBoard } from './types'
import { MONTH_SHORT } from '@/lib/format/months'

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
  /** Published that week in a language with no target, or none: shown beside the score, not in it. */
  untargeted: number
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

/** The board's name without its " · Publishing" suffix, which the widget has no room for. */
function clientName(name: string): string {
  return name.split('·')[0].trim()
}

/**
 * The last four COMPLETE weeks, oldest first, Monday to Sunday in New York.
 *
 * Anchored on the most recent Sunday that has already passed, so a Monday
 * morning shows the week that just ended rather than one still running. Cut
 * on the UTC day, Sunday evening in New York already read as the next week.
 */
export function lastFourWeeks(now: Date): { start: Date; end: Date }[] {
  const thisMonday = weekStartDay(now)
  const out: { start: Date; end: Date }[] = []
  for (let back = 4; back >= 1; back--) out.push(weekBounds(addDays(thisMonday, -7 * back)))
  return out
}

/**
 * "Aug 10-16": both ends, because a single date does not say whether it is the
 * week's first day or its last, and readers guessed wrong.
 *
 * The month is repeated only when the week crosses one, so the common case
 * stays short enough for the column: "Aug 31-Sep 6", but "Aug 10-16".
 */
export function weekLabel(start: Date, end: Date): string {
  const day = (d: Date) => {
    const [y, m, dd] = weekDay(d).split('-').map(Number)
    return { m: m - 1, d: dd, y }
  }
  const a = day(start), b = day(end)
  const from = `${MONTH_SHORT[a.m]} ${a.d}`
  const to = a.m === b.m ? `${b.d}` : `${MONTH_SHORT[b.m]} ${b.d}`
  return `${from}-${to}`
}

/** The New York calendar day of an instant. */
const weekDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/**
 * `ranges` counts other weeks than the last four complete ones. The
 * notifications pass the week still running, to ask whether a client is behind
 * for the days that have gone; the widget never does.
 */
export async function loadPublishingWeeks(
  now = new Date(), ranges?: { start: Date; end: Date }[],
): Promise<{ boards: PublishingBoardWeeks[]; updatedAt: string | null }> {
  const boardIds = Object.keys(BOARDS).filter(id => BOARDS[id].publishingMode)
  if (boardIds.length === 0) return { boards: [], updatedAt: null }

  const supabase = createAdminClient()
  const [factRes, rules] = await Promise.all([
    supabase.from('monday_snapshot').select('board_id, published_items, ingested_at').in('board_id', boardIds),
    loadPublishingRules(supabase),
  ])
  if (factRes.error) throw new Error(`Publishing goals could not read the boards: ${factRes.error.message}`)
  const isPublisher = publisherTest(rules.publishers)

  const weeks = ranges ?? lastFourWeeks(now)

  // One flat list, the shape the counting takes. It does its own per-board
  // filtering, so there is nothing to keep separated here.
  const items: PublishedItem[] = []
  const names: Record<string, string> = {}

  // A board the ingest has not written since migration 081 has no stored
  // facts (null), and only that board goes to the slow path.
  const factRows = (factRes.data ?? []) as { board_id: string; published_items: unknown; ingested_at: string | null }[]
  const stale: string[] = []
  let updatedAt: string | null = null
  for (const row of factRows) {
    const config = BOARDS[row.board_id]
    if (!config) continue
    // The older board's time: the only one true of the whole card.
    if (row.ingested_at && (!updatedAt || row.ingested_at < updatedAt)) updatedAt = row.ingested_at
    if (!isCompactList(row.published_items)) { stale.push(row.board_id); continue }
    names[row.board_id] = clientName(config.name)
    items.push(...toPublishedItems(row.board_id, config.short, row.published_items))
  }

  if (stale.length > 0) {
    // Loud on purpose: this is the path that made Home slow.
    console.warn(`[publishing-weeks] no stored facts for ${stale.join(', ')}; reading the full snapshot`)
    const { data: snapRows, error } = await supabase.from('monday_snapshot').select('board_id, data').in('board_id', stale)
    if (error) throw new Error(`Publishing goals could not read the boards: ${error.message}`)
    // data is the JSON column the ingest wrote from a board snapshot.
    for (const row of (snapRows ?? []) as unknown as { board_id: string; data: SnapshotBoard }[]) {
      const config = BOARDS[row.board_id]
      if (!config) continue
      names[row.board_id] = clientName(config.name)
      items.push(...enrichPublishingBoard(row.data, config))
    }
  }

  // Each week against the targets in force that week.
  const perWeek = weeks.map(({ start, end }) => {
    const targets = targetsForWeek(rules, weekStartDay(start))
    const m = computePublishingMetrics(items, targets, start, end, isPublisher, rules.paused)
    return { targets, stats: Object.fromEntries(m.boards.map(b => [b.boardId, b])) }
  })

  const out: PublishingBoardWeeks[] = []
  for (const boardId of Object.keys(names)) {
    // Summed across the targeted languages, which is the dashboard's own board
    // total: the widget answers "did the client's week land". English is the
    // one language pulled back out, because it is the one that goes missing
    // unnoticed.
    const counted = weeks.map(({ start, end }, i) => {
      const langTargets = perWeek[i].targets[boardId] ?? {}
      const target = Object.values(langTargets).reduce((s, n) => s + n, 0)
      const enTarget = langTargets[ENGLISH] ?? 0
      // A board with no targets that week gets no stat at all, which is not
      // the same as a bad week: the widget says so instead of drawing a miss.
      const stat = perWeek[i].stats[boardId]
      const en = stat?.langs.find(l => l.lang === ENGLISH)
      return {
        start: weekStartDay(start),
        label: weekLabel(start, end),
        done: stat?.done ?? 0,
        target,
        en: enTarget > 0 ? { done: en?.done ?? 0, target: enTarget } : null,
        untargeted: stat?.untargeted ?? 0,
      }
    })
    const latest = counted[counted.length - 1]

    out.push({
      boardId,
      name: names[boardId],
      // The targets in force in the latest week shown, which is what "per
      // week" means to a reader today.
      perWeek: latest?.target ?? 0,
      enPerWeek: latest?.en?.target ?? 0,
      weeks: counted,
      hits: counted.filter(w => w.target > 0 && w.done >= w.target).length,
      enHits: counted.filter(w => w.en && w.en.done >= w.en.target).length,
    })
  }

  // The order the boards are configured in, so the widget does not reshuffle
  // itself when one board happens to be written to the store first.
  return { boards: out.sort((a, b) => boardIds.indexOf(a.boardId) - boardIds.indexOf(b.boardId)), updatedAt }
}
