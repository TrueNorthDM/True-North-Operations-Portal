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
