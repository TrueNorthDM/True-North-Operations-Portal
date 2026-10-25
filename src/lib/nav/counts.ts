/**
 * The rail's attention counters, for the rail in the browser.
 *
 * Its own module for the reason path.ts is: lib/access/nav.ts holds the whole
 * rail and must never reach the browser (lib/access/view-as-links.test.ts
 * refuses a browser import of it that is not type-only), while the rail needs
 * these names and sums to draw each person's own numbers.
 */

import type { ResolvedEntry } from '@/lib/access/nav'

/**
 * The counts a panel row can carry (owner, 25 October 2026: every rail icon
 * shows a counter whenever something in it needs this person's attention).
 *
 *   approvals            what waits for their decision (North Time, Requests)
 *   my-late              their own open steps past their due date (My Work)
 *   integration-errors   failed outbox jobs Company settings offers to try again
 *   monday-unlinked      Monday accounts waiting on an answer (Monday accounts)
 *   automations-down     services down, warning, or checks gone stale (Automations)
 *   no-rate              contractors whose invoice cannot be made for want of a rate (Rates & Costs)
 */
export const NAV_COUNTS = ['approvals', 'my-late', 'integration-errors', 'monday-unlinked', 'automations-down', 'no-rate'] as const
export type NavCount = (typeof NAV_COUNTS)[number]

/** What the number on a panel row means, for its pill's title and the row's spoken label. */
export const NAV_COUNT_LABEL: Record<NavCount, string> = {
  approvals: 'Waiting for a decision',
  'my-late': 'Late steps',
  'integration-errors': 'Failed jobs to try again',
  'monday-unlinked': 'Accounts to link',
  'automations-down': 'Down or stale',
  'no-rate': 'Contractors with no rate',
}

/** A rail icon's number: past 99 it reads "99+", which still says "a lot" and keeps the pill small. */
export const badgeText = (n: number): string => (n > 99 ? '99+' : String(n))

/** The count keys a resolved rail carries, once each: what the rail asks the server for. */
export function railCountKeys(rail: readonly ResolvedEntry[]): NavCount[] {
  const keys = rail.flatMap(e => (e.kind === 'hub' ? e.groups.flatMap(g => g.items.map(i => i.count)) : []))
  return NAV_COUNTS.filter(k => keys.includes(k))
}

/**
 * A hub's number on the rail: the sum of the distinct counts among its visible
 * rows, so Approvals, which Requests repeats as a shortcut, is counted once per
 * hub. A count not read yet adds nothing.
 */
export function hubCount(hub: Extract<ResolvedEntry, { kind: 'hub' }>, counts: Partial<Record<NavCount, number>>): number {
  const keys = new Set(hub.groups.flatMap(g => g.items.map(i => i.count)).filter((c): c is NavCount => !!c))
  let sum = 0
  for (const k of keys) sum += Math.max(0, counts[k] ?? 0)
  return sum
}
