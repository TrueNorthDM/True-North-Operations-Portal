/**
 * favorites/catalog.ts — the set of destinations a user may pin to Home.
 *
 * Kept as a static catalog (not crawled from routes) so labels are curated and
 * hrefs are validated server-side before saving — a favourite can only ever
 * point at a known portal destination. Admin-only targets are filtered out of
 * the picker for non-admins (their server guards still apply regardless).
 */

export interface FavoriteTarget {
  href: string
  label: string
  group: 'Dashboards' | 'Projects' | 'Tools' | 'Admin'
  adminOnly?: boolean
}

export const FAVORITE_TARGETS: FavoriteTarget[] = [
  { href: '/dashboards', label: 'Dashboards', group: 'Dashboards' },
  { href: '/dashboards/publishing', label: 'Publishing Goals', group: 'Dashboards' },
  { href: '/boards-beta', label: 'Workload (beta)', group: 'Dashboards' },

  { href: '/projects', label: 'Projects', group: 'Projects' },
  { href: '/aaaf', label: 'AAAF — Href Links', group: 'Projects' },
  { href: '/hfa', label: 'HFA — Href Links', group: 'Projects' },

  { href: '/tools', label: 'Tools', group: 'Tools' },

  { href: '/admin', label: 'Admin', group: 'Admin', adminOnly: true },
  { href: '/admin/tickets', label: 'Tickets', group: 'Admin', adminOnly: true },
  { href: '/admin/tests', label: 'Tests', group: 'Admin', adminOnly: true },
  { href: '/directory', label: 'Directory', group: 'Admin', adminOnly: true },
]

export const MAX_FAVORITES = 5

export function catalogFor(isAdmin: boolean): FavoriteTarget[] {
  return FAVORITE_TARGETS.filter(t => !t.adminOnly || isAdmin)
}
