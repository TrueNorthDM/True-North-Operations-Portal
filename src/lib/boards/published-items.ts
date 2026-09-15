/**
 * The few facts the publishing goals need, kept beside the snapshot they came from.
 *
 * The Home page's Publishing goals card used to read `monday_snapshot.data` for
 * both publishing boards on every visit: 14.6 MB for AskAnAdventistFriend and
 * 12 MB for Hope for Africa, measured in September 2026, parsed on the server
 * to count at most a few dozen published pages. Home is the most visited page
 * and the one everybody lands on after signing in, so that cost was paid on the
 * most common request in the portal.
 *
 * What the count actually needs from each item is four things: which item, in
 * which language, published by whom, and when. Those are computed once, by the
 * ingest that writes the snapshot, and stored in `monday_snapshot.published_items`.
 * Home reads that column and never touches `data`.
 *
 * The weeks and the targets are deliberately NOT precomputed. A stored "9 of 11"
 * would go stale the moment somebody edited a target, and would show last week's
 * window for up to four hours after Monday midnight. Storing the facts instead of
 * the figures keeps both of those live, and keeps the counting rules in one place:
 * `computePublishingMetrics`, which the Publishing Goals dashboard also uses.
 */

import type { BoardConfig } from './config'
import { enrichPublishingBoard, type PublishedItem } from './publishing'
import type { SnapshotBoard } from './types'

/**
 * How far back the stored facts reach.
 *
 * The card shows the last four complete weeks, whose first day is at most 34 days
 * ago. Seventy days leaves five weeks of margin, so a snapshot that has not been
 * refreshed for a month still covers the whole window. Anything older is left
 * out because nothing reads it.
 */
export const PUBLISHED_HORIZON_DAYS = 70

export interface CompactPublished {
  id: string
  language: string
  /** Everyone named as publisher. The rule about which names count is applied later. */
  publishers: string[]
  /** An ISO timestamp, as the enrichment produces it. */
  publishedDate: string
}

/**
 * Reduce enriched items to the published ones inside the horizon.
 *
 * Publishers are kept whoever they are. Whether Samuel, Wendy or somebody else
 * counts is `isPublisher`'s decision, made when the numbers are computed; filtering
 * here would bake today's list into data that outlives it.
 */
export function compactFromItems(items: PublishedItem[], now: Date): CompactPublished[] {
  const cutoff = now.getTime() - PUBLISHED_HORIZON_DAYS * 86_400_000
  const out: CompactPublished[] = []
  for (const it of items) {
    if (!it.isPublished || !it.publishedDate) continue
    const at = new Date(it.publishedDate).getTime()
    if (Number.isNaN(at) || at < cutoff) continue
    out.push({ id: it.id, language: it.language, publishers: it.publishers, publishedDate: it.publishedDate })
  }
  return out
}

/** What the ingest stores for one board. */
export function compactPublished(board: SnapshotBoard, config: BoardConfig, now: Date): CompactPublished[] {
  return compactFromItems(enrichPublishingBoard(board, config), now)
}

/**
 * Stored facts back into the shape `computePublishingMetrics` takes.
 *
 * That function reads the board, the language, the publishers, whether the item
 * is published and when. The remaining fields exist for the dashboard's audit
 * view and are filled with values that mean "not known here" rather than guessed.
 */
export function toPublishedItems(boardId: string, boardShort: string, rows: CompactPublished[]): PublishedItem[] {
  return rows.map(r => ({
    id: r.id,
    name: '',
    boardId,
    boardShort,
    language: r.language,
    publishers: r.publishers,
    publishedDate: r.publishedDate,
    isPublished: true,
    currentStatusText: null,
    logEventCount: 0,
    matchingEventCount: 0,
    isDoneWithoutEvent: false,
    group: null,
    isInExcludedGroup: false,
    isStagedToPublish: false,
  }))
}

/**
 * Whether a stored value is a list of facts this code wrote.
 *
 * The column is null for any board the ingest has not written since it existed,
 * and it is jsonb, so its shape is checked rather than trusted.
 */
export function isCompactList(value: unknown): value is CompactPublished[] {
  return Array.isArray(value) && value.every(v =>
    v !== null && typeof v === 'object'
    && typeof (v as CompactPublished).id === 'string'
    && typeof (v as CompactPublished).language === 'string'
    && typeof (v as CompactPublished).publishedDate === 'string'
    && Array.isArray((v as CompactPublished).publishers))
}
