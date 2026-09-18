import { describe, expect, it } from 'vitest'
import { boardsToProbe, isStale, readOrder, STALE_MONTHS, staleCutoff, staleSweep, type BoardProbe, type BoardStaleness } from './stale'

const NOW = new Date('2026-08-26T12:00:00Z')
const ago = (months: number) => {
  const d = new Date(NOW)
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

const board = (o: Partial<BoardStaleness> = {}): BoardStaleness => ({
  id: 1, included: true, includedPinned: false, lastActivityAt: ago(1), ...o,
})

describe('isStale', () => {
  it('leaves a board touched inside the window alone', () => {
    expect(isStale(board({ lastActivityAt: ago(STALE_MONTHS - 1) }), NOW)).toBe(false)
  })

  it('calls a board quiet past the window', () => {
    expect(isStale(board({ lastActivityAt: ago(STALE_MONTHS + 1) }), NOW)).toBe(true)
  })

  // The stamp is written on every sync from the items actually read, so null
  // means the sync looked and found nothing, not that the board is new.
  it('treats a board with no activity at all as quiet', () => {
    expect(isStale(board({ lastActivityAt: null }), NOW)).toBe(true)
  })

  it('counts months, not days, so the cutoff lands on the same date', () => {
    expect(staleCutoff(NOW).toISOString().slice(0, 10)).toBe('2026-02-26')
  })
})

describe('staleSweep', () => {
  it('hides the quiet boards that are still shown', () => {
    const { hide } = staleSweep([
      board({ id: 1, lastActivityAt: ago(9) }),
      board({ id: 2, lastActivityAt: ago(2) }),
    ], NOW)
    expect(hide).toEqual([1])
  })

  // A project that restarts does not announce itself either.
  it('brings a hidden board back when the work returns', () => {
    const { show } = staleSweep([board({ id: 3, included: false, lastActivityAt: ago(1) })], NOW)
    expect(show).toEqual([3])
  })

  it('leaves a hidden board hidden while it stays quiet', () => {
    expect(staleSweep([board({ included: false, lastActivityAt: ago(9) })], NOW).show).toEqual([])
  })

  // Some boards are hidden for reasons that have nothing to do with activity:
  // a personal space, a duplicate. Pinning takes them out of the rule's hands.
  it('never touches a pinned board, in either direction', () => {
    const pinned = [
      board({ id: 1, includedPinned: true, lastActivityAt: ago(24) }),
      board({ id: 2, included: false, includedPinned: true, lastActivityAt: ago(1) }),
    ]
    expect(staleSweep(pinned, NOW)).toEqual({ hide: [], show: [] })
  })

  it('does nothing when every board already matches its activity', () => {
    expect(staleSweep([board(), board({ id: 2, included: false, lastActivityAt: ago(9) })], NOW))
      .toEqual({ hide: [], show: [] })
  })
})

describe('boardsToProbe', () => {
  const hidden = (o: Partial<BoardProbe> = {}): BoardProbe => ({
    id: 1, included: false, includedPinned: false,
    boardUpdatedAt: ago(1), itemsSyncedAt: ago(3), ...o,
  })

  // The hole this closes: a hidden board's activity is its items, and the sync
  // only read boards that were shown, so it could never come back.
  it('reads a hidden board Monday has touched since we last read it', () => {
    expect(boardsToProbe([hidden()])).toEqual([1])
  })

  it('reads a hidden board that was never read at all', () => {
    expect(boardsToProbe([hidden({ itemsSyncedAt: null })])).toEqual([1])
  })

  it('leaves a hidden board alone when nothing has changed since the last read', () => {
    expect(boardsToProbe([hidden({ boardUpdatedAt: ago(4), itemsSyncedAt: ago(2) })])).toEqual([])
  })

  it('says nothing about shown boards, which are read anyway', () => {
    expect(boardsToProbe([hidden({ included: true })])).toEqual([])
  })

  it('leaves a pinned board to whoever pinned it', () => {
    expect(boardsToProbe([hidden({ includedPinned: true })])).toEqual([])
  })

  // Before migration 086 there is no date to compare, and the sync reads
  // exactly what it read before.
  it('reads nothing when Monday has not told us a date yet', () => {
    expect(boardsToProbe([hidden({ boardUpdatedAt: null })])).toEqual([])
  })
})

describe('readOrder', () => {
  const b = (id: number, included: boolean, itemsSyncedAt: string | null) => ({ id, included, itemsSyncedAt })

  // A firing reads about 28 of 43 shown boards. A hidden board queued after
  // all of them would never be reached, so it takes its place by its stamp.
  it('puts a hidden board worth reading ahead of shown boards read more recently', () => {
    const order = readOrder([b(1, true, ago(0)), b(2, true, ago(0)), b(3, false, ago(14))], new Set([3]))
    expect(order.map(x => x.id)).toEqual([3, 1, 2])
  })

  it('reads a board never read before anything else', () => {
    expect(readOrder([b(1, true, ago(1)), b(2, false, null)], new Set([2])).map(x => x.id)).toEqual([2, 1])
  })

  it('leaves out hidden boards that are not worth reading', () => {
    expect(readOrder([b(1, true, ago(1)), b(2, false, ago(20))], new Set()).map(x => x.id)).toEqual([1])
  })
})
