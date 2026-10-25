'use server'

// The rail's numbers in one round trip (owner, 25 October 2026): the rail asks
// for the counts its rows carry when it mounts, after each navigation and when
// a panel opens, and every count it may show comes back together. What each
// number means, and who sees it, is lib/access/rail-counts.ts.

import { loadAccess } from '@/lib/access/resolve'
import { NAV_COUNTS, type NavCount } from '@/lib/nav/counts'
import { mayCount, railCounts } from '@/lib/access/rail-counts'

/** The counts asked for (the keys in this person's rail); one the person may not see comes back 0. Never throws. */
export async function getRailCounts(keys: readonly string[]): Promise<Partial<Record<NavCount, number>>> {
  try {
    const access = await loadAccess()
    const asked = (Array.isArray(keys) ? keys : []).filter((k): k is NavCount => (NAV_COUNTS as readonly string[]).includes(k))
    const open = asked.filter(k => mayCount(key => access.can(key), k))
    const read = await railCounts(access, open)
    return Object.fromEntries(asked.map(k => [k, read[k] ?? 0]))
  } catch (e) {
    console.error('[rail counts]', e instanceof Error ? e.message : e)
    return {}
  }
}
