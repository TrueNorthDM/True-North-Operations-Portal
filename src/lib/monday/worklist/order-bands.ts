// Which order a stretch of the list follows: the team's hand-placed order, or
// True North's.
//
// Chosen on 18 September 2026 (/design-check/order-clarity, option 4, and
// /design-check/order-bands): every row carries a mark, a pin when a leader
// placed it by hand and a compass when it follows True North's order, and the
// list is cut into bands wherever it changes from one to the other. A band is
// a run of the list in the order it is shown, not a category: Jeannette's own
// list has five, because the steps she placed sit at the top, in the middle
// and at the end. Grouping them into two would reorder the list the page is
// there to show.
//
// Pure module: the list and the editor draw it, the tests hold it.

import type { Ranking } from './team-priority'

export interface Band<T> {
  placed: boolean
  items: T[]
}

/** The runs of the list, in order: a new band every time it changes kind. */
export function bandsOf<T>(items: readonly T[], placed: (t: T) => boolean): Band<T>[] {
  const out: Band<T>[] = []
  for (const it of items) {
    const p = placed(it)
    const last = out[out.length - 1]
    if (last && last.placed === p) last.items.push(it)
    else out.push({ placed: p, items: [it] })
  }
  return out
}

/** For every step, how many steps placed by hand come before it in the team's order. */
export function placedAbove(ranking: Pick<Ranking, 'keys' | 'pinned'>): Map<string, number> {
  const out = new Map<string, number>()
  let n = 0
  for (const k of ranking.keys) {
    out.set(k, n)
    if (ranking.pinned.has(k)) n++
  }
  return out
}

/**
 * Why a step that follows True North's order sits where it does, read from the
 * first step of its band. The direction matters: steps placed by hand above a
 * step push it down, and steps a leader moved further down let it rise, and
 * saying "come before these" of a step that rose would be the wrong way round.
 */
export function bandReason(o: { team: number; tn: number; placedAbove: number }): string {
  const place = `True North's #${o.tn.toLocaleString('en-US')} is the team's #${o.team.toLocaleString('en-US')}`
  if (o.team > o.tn) {
    return `${o.placedAbove.toLocaleString('en-US')} ${o.placedAbove === 1 ? 'step' : 'steps'} placed by hand come before these, so ${place}.`
  }
  if (o.team < o.tn) return `Steps placed by hand further down let these move up, so ${place}.`
  return `${place}, the same place.`
}

/** "#1 to #165", or "#192" for a band of one. */
export function bandRange(first: number, last: number): string {
  const f = first.toLocaleString('en-US'), l = last.toLocaleString('en-US')
  return first === last ? `#${f}` : `#${f} to #${l}`
}
