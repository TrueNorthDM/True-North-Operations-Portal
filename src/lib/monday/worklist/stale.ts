// A board's visibility, following its activity, in both directions.
//
// Six months of silence on a Monday board almost always means the project
// finished, and those boards do not announce themselves. Neither does a
// project that restarts, which is why the rule runs both ways: work coming
// back should not need somebody to remember the board exists.

/** How long a board may sit untouched before the rule hides it. */
export const STALE_MONTHS = 6

export type BoardStaleness = {
  id: number
  included: boolean
  /**
   * Hidden or shown for a reason that is not about activity: a personal
   * space, an experiment, a duplicate. The rule leaves these alone in
   * whichever state they were left.
   */
  includedPinned: boolean
  /** Most recent change to any item on the board. Null means never seen. */
  lastActivityAt: string | null
}

export function staleCutoff(now: Date): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() - STALE_MONTHS)
  return d
}

/**
 * Has this board gone quiet?
 *
 * A board with no activity stamp at all counts as quiet. The stamp is written
 * on every sync from the items actually read, so a null means the sync has
 * seen it and found nothing, not that it is new.
 */
export function isStale(board: BoardStaleness, now: Date): boolean {
  if (!board.lastActivityAt) return true
  return Date.parse(board.lastActivityAt) < staleCutoff(now).getTime()
}

/**
 * What one pass of the rule would change, in both directions.
 *
 * Pinned boards are untouched either way. Everything else follows its own
 * activity, so a finished project falls off and a restarted one comes back
 * without anybody having to notice.
 */
export function staleSweep(
  boards: BoardStaleness[], now: Date,
): { hide: number[]; show: number[] } {
  const open = boards.filter(b => !b.includedPinned)
  return {
    hide: open.filter(b => b.included && isStale(b, now)).map(b => b.id),
    show: open.filter(b => !b.included && !isStale(b, now)).map(b => b.id),
  }
}

/** A hidden board, and the two dates that decide whether it is worth reading again. */
export type BoardProbe = {
  id: number
  included: boolean
  includedPinned: boolean
  /** Monday's own updated_at for the board, from discovery (migration 086). */
  boardUpdatedAt: string | null
  /** When the sync last read this board's items. Null means never. */
  itemsSyncedAt: string | null
}

/**
 * Hidden boards to read once more, so the rule's second half can fire.
 *
 * The rule brings a board back when it is touched again, but a board's activity
 * is read from its items and the sync only reads boards that are shown. So a
 * hidden board's activity was frozen where it stood, and it could never come
 * back: on 16 September 2026, with the switch on, 221 boards were hidden and
 * none had been read in over a week.
 *
 * Monday's own updated_at for the board, which discovery now stores for every
 * board, says whether anything happened there at all. Newer than our last read
 * of its items means read it once more; the read stamps the board's real item
 * activity, and staleSweep then decides as it always has. That keeps a board
 * from coming back on a column rename: Monday bumps updated_at for changes that
 * are not work, and a board with year-old items stays hidden after the read.
 *
 * A board read since its last change is left alone, so this asks Monday for a
 * board once per change and not once per sync. A pinned board is nobody's
 * business but the person who pinned it.
 */
export function boardsToProbe(boards: BoardProbe[]): number[] {
  return boards
    .filter(b => !b.included && !b.includedPinned && b.boardUpdatedAt)
    .filter(b => !b.itemsSyncedAt || b.boardUpdatedAt! > b.itemsSyncedAt)
    .map(b => b.id)
}

/**
 * The order the sync reads boards in: the shown ones and the hidden ones worth
 * a look (boardsToProbe) together. Boards Monday says have changed since we
 * last read them go first, then everything else, least recently read first,
 * never read before all of them.
 *
 * Changed first because a firing reads about 28 of the 43 shown boards before
 * its time runs out, and the next hop that should read the rest is routinely
 * lost. Read purely by age, a change made in Monday (a label newly marked as
 * completed, say) could wait two firings, about eight hours, to reach My Work;
 * found on 18 September 2026 with six "Not Relevant" rows still open after
 * Monday had marked the label completed. Monday bumps a board's updated_at for
 * item changes and for settings changes alike, and discovery refreshes it at
 * the head of every firing, so a changed board is read in the next one.
 *
 * One order and not "shown first": a hidden board worth reading was queued
 * after the shown ones once, and a firing that stops at 28 never reached it.
 */
export function readOrder<T extends {
  id: number
  included: boolean
  itemsSyncedAt: string | null
  boardUpdatedAt?: string | null
}>(boards: T[], probe: ReadonlySet<number>): T[] {
  const changed = (b: T) => !!b.boardUpdatedAt && (!b.itemsSyncedAt || b.boardUpdatedAt > b.itemsSyncedAt)
  return boards
    .filter(b => b.included || probe.has(b.id))
    .sort((a, b) => Number(changed(b)) - Number(changed(a))
      || (a.itemsSyncedAt ?? '').localeCompare(b.itemsSyncedAt ?? ''))
}
