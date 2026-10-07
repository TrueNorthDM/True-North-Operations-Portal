/**
 * The pages a person can reach, grouped the way they think of them: their own
 * things first ("Yours"), then each Tools group, then each hub. Built from the
 * same resolved rail the navigation draws (lib/access/nav.ts), so it never
 * offers a page the person cannot open. Shared by the Launcher, the "Add a
 * page" picker in Settings, and the favourites on Home. Pure.
 */

import type { NavItem, ResolvedEntry } from '@/lib/access/nav'

export interface PageGroup { label: string; rows: NavItem[] }

export function pageGroups(rail: readonly ResolvedEntry[]): PageGroup[] {
  const yours: NavItem[] = []
  const out: PageGroup[] = []
  const add = (label: string, rows: readonly NavItem[]) => {
    const g = out.find(x => x.label === label)
    if (g) g.rows.push(...rows)
    else out.push({ label, rows: [...rows] })
  }
  for (const e of rail) {
    if (e.kind === 'rule') continue
    if (e.kind === 'page') { yours.push(e.item); continue }
    if (e.key === 'my-work' || e.key === 'my-hours') { yours.push(...e.groups.flatMap(g => g.items)); continue }
    if (e.key === 'tools') { for (const g of e.groups) add(g.label ?? 'Tools', g.items); continue }
    add(e.label, e.groups.flatMap(g => g.items))
  }
  return [{ label: 'Yours', rows: yours }, ...out]
}

/** What can be pinned to Home: every page but Home itself and the ones not built yet. */
export function pinnable(rail: readonly ResolvedEntry[]): PageGroup[] {
  return pageGroups(rail)
    .map(g => ({ label: g.label, rows: g.rows.filter(r => !r.soon && r.key !== 'home') }))
    .filter(g => g.rows.length > 0)
}

/** A person's favourites, in their order, keeping only pages they can still open. */
export function resolveFavourites(rail: readonly ResolvedEntry[], keys: readonly string[]): NavItem[] {
  const byKey = new Map(pinnable(rail).flatMap(g => g.rows).map(r => [r.key, r]))
  return keys.map(k => byKey.get(k)).filter((r): r is NavItem => !!r)
}
