/**
 * The last four complete weeks of publishing, per board, for the Home widget;
 * the last two complete cycles for a board counted in two-week cycles
 * (Bessemeters, 15 October 2026; publishing-cycles.ts).
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
 *
 * The counting itself is boardRows, pure and tested; loadPublishingWeeks only
 * reads and hands it the facts.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { addDays } from '@/lib/notifications/schedule'
import { BOARDS, PUBLISHING_BOARD_IDS } from './config'
import { computePublishingMetrics, enrichPublishingBoard } from './publishing'
import type { PublishedItem } from './publishing'
import { isCompactList, toPublishedItems } from './published-items'
import {
  cycleBounds, loadPublishingRules, PUBLISHING_ZONE, publisherTest, targetsForWeek, weekBounds, weekStartDay,
  type PublishingRules,
} from './publishing-rules'
import { cycleLabel, cycleOf, firstCycleEnd, isCycled, lastCompleteCycles, WEEKLY, type Cadence } from './publishing-cycles'
import type { SnapshotBoard } from './types'
import { MONTH_SHORT } from '@/lib/format/months'
import { zoneDate } from '@/lib/notifications/schedule'

/** One row of the card: a week, or a two-week cycle on a board counted in cycles. */
export interface PublishingWeek {
  /** The Monday, as YYYY-MM-DD: the week's, or the cycle's first. */
  start: string
  /** "Aug 10-16" for a week, "Sep 29 to Oct 12" for a cycle: what the widget prints. */
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
  /** 1: the rows are weeks and the target is per week. 2: they are two-week cycles, and it is per cycle. */
  cycleWeeks: 1 | 2
  /** The target per row (per week, or per cycle). */
  perPeriod: number
  /** The English slice of `perPeriod`, 0 when the board has no English target. */
  enPerPeriod: number
  /** Oldest first: four weeks, or up to two cycles. */
  weeks: PublishingWeek[]
  /** How many of the rows met their target, all languages together. */
  hits: number
  /** How many of the rows met the English target alone. */
  enHits: number
  /**
   * A board counted in cycles whose first cycle has not ended yet: the Sunday
   * it ends, YYYY-MM-DD, for "First cycle ends Oct 26". Null otherwise.
   */
  firstCycleEnds: string | null
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
 * Which rows: "complete" is the card (the last four complete weeks, or the
 * last two complete cycles); "current" is the week or cycle still running,
 * up to now, which the behind-pace notification asks about.
 */
export type RowsMode = 'complete' | 'current'

interface Span { start: Date; end: Date; label: string; monday: string }

/** The spans a board is counted over, by its cadence. */
export function boardSpans(cadence: Cadence, now: Date, mode: RowsMode): Span[] {
  const today = zoneDate(now, PUBLISHING_ZONE)
  if (isCycled(cadence)) {
    if (mode === 'current') {
      const cy = cycleOf(cadence, today)
      return cy ? [{ start: cycleBounds(cy).start, end: now, label: cycleLabel(cy), monday: cy.start }] : []
    }
    return lastCompleteCycles(cadence, today, 2).map(cy => ({ ...cycleBounds(cy), label: cycleLabel(cy), monday: cy.start }))
  }
  if (mode === 'current') {
    const monday = weekStartDay(now)
    const { start, end } = weekBounds(monday)
    return [{ start, end: now, label: weekLabel(start, end), monday }]
  }
  return lastFourWeeks(now).map(({ start, end }) => ({ start, end, label: weekLabel(start, end), monday: weekStartDay(start) }))
}

/**
 * One board's rows, counted. Pure: the items, the rules and the clock in, the
 * card's figures out. Each row is judged against the targets in force in its
 * first week, which for a cycle is the cycle's first week.
 */
export function boardRows(input: {
  boardId: string
  name: string
  items: PublishedItem[]
  rules: Pick<PublishingRules, 'periods' | 'paused' | 'cadence'>
  isPublisher: (name: string | null | undefined) => boolean
  now: Date
  mode?: RowsMode
}): PublishingBoardWeeks {
  const { boardId, items, rules, isPublisher, now, mode = 'complete' } = input
  const cadence = rules.cadence[boardId] ?? WEEKLY
  const spans = boardSpans(cadence, now, mode)

  // Summed across the targeted languages, which is the dashboard's own board
  // total: the widget answers "did the client's week land". English is the
  // one language pulled back out, because it is the one that goes missing
  // unnoticed.
  const counted: PublishingWeek[] = spans.map(({ start, end, label, monday }) => {
    const langTargets = targetsForWeek(rules, monday)[boardId]
    const target = Object.values(langTargets ?? {}).reduce((sum, n) => sum + n, 0)
    const enTarget = langTargets?.[ENGLISH] ?? 0
    // A board with no targets that row gets no stat at all, which is not
    // the same as a bad row: the widget says so instead of drawing a miss.
    const stat = langTargets
      ? computePublishingMetrics(items, { [boardId]: langTargets }, start, end, isPublisher, rules.paused).boards[0]
      : undefined
    const en = stat?.langs.find(l => l.lang === ENGLISH)
    return {
      start: monday,
      label,
      done: stat?.done ?? 0,
      target,
      en: enTarget > 0 ? { done: en?.done ?? 0, target: enTarget } : null,
      untargeted: stat?.untargeted ?? 0,
    }
  })
  const latest = counted[counted.length - 1]

  // No cycle has ended yet, so the card names the day the first one will.
  let firstCycleEnds: string | null = null
  if (isCycled(cadence) && mode === 'complete' && counted.length === 0) {
    const today = zoneDate(now, PUBLISHING_ZONE)
    firstCycleEnds = cycleOf(cadence, today)?.end ?? firstCycleEnd(cadence)
  }

  return {
    boardId,
    name: input.name,
    cycleWeeks: isCycled(cadence) ? 2 : 1,
    // The targets in force in the latest row shown, which is what "per week"
    // (or "per cycle") means to a reader today.
    perPeriod: latest?.target ?? 0,
    enPerPeriod: latest?.en?.target ?? 0,
    weeks: counted,
    hits: counted.filter(w => w.target > 0 && w.done >= w.target).length,
    enHits: counted.filter(w => w.en && w.en.done >= w.en.target).length,
    firstCycleEnds,
  }
}

/**
 * Every publishing board's rows. `mode` "current" counts the week or cycle
 * still running, for the notifications, which ask whether a client is behind
 * for the days that have gone; the widget never does.
 */
export async function loadPublishingWeeks(
  now = new Date(), mode: RowsMode = 'complete',
): Promise<{ boards: PublishingBoardWeeks[]; updatedAt: string | null }> {
  const boardIds = PUBLISHING_BOARD_IDS
  if (boardIds.length === 0) return { boards: [], updatedAt: null }

  const supabase = createAdminClient()
  const [factRes, rules] = await Promise.all([
    supabase.from('monday_snapshot').select('board_id, published_items, ingested_at').in('board_id', boardIds),
    loadPublishingRules(supabase),
  ])
  if (factRes.error) throw new Error(`Publishing goals could not read the boards: ${factRes.error.message}`)
  const isPublisher = publisherTest(rules.publishers)

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

  // The order the boards are configured in (PUBLISHING_BOARD_IDS), so the
  // widget does not reshuffle itself when one board happens to be written to
  // the store first. A board the ingest has not read yet is left out.
  const boards = boardIds
    .filter(id => names[id])
    .map(boardId => boardRows({ boardId, name: names[boardId], items, rules, isPublisher, now, mode }))
  return { boards, updatedAt }
}
