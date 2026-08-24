/**
 * access/nav.ts: the surfaces that appear in the sidebar, in rail order, and
 * the route → surface map used to guard pages.
 *
 * Kept apart from surfaces.ts (which is the full matrix, including capabilities
 * that are not nav items) so the sidebar and the page guards agree on one list.
 */

/** Sidebar items, top group then bottom group, in the order they render. */
export const NAV_SURFACES: readonly string[] = [
  'home',
  'tools',
  'my-work',
  'report',
  'my-team',
  'my-hours',
  'directory',
  'human-resources',
  'admin',
  'clocky-hours',
  'settings',
]

/**
 * Which surface guards a given pathname. First match wins, so list the more
 * specific prefixes first. Routes with no entry are ungated by surface (they
 * carry their own checks, e.g. /profile is always your own).
 */
const ROUTE_SURFACES: readonly { prefix: string; surface: string }[] = [
  { prefix: '/admin', surface: 'admin' },
  { prefix: '/clocky-hours', surface: 'clocky-hours' },
  { prefix: '/hours', surface: 'my-hours' },
  { prefix: '/settings', surface: 'settings' },
  { prefix: '/human-resources', surface: 'human-resources' },
  { prefix: '/directory', surface: 'directory' },
  { prefix: '/my-work', surface: 'my-work' },
  // Its own grant now. The My Team TAB inside /my-work carries the 'my-team'
  // surface and is checked in the page, because a prefix cannot see a query
  // parameter and the tab is ?tab=team.
  { prefix: '/report', surface: 'report' },
  { prefix: '/tools', surface: 'tools' },
  { prefix: '/dashboards', surface: 'tools' },
  { prefix: '/boards-beta', surface: 'tools' },
  // Href Link Management lives inside Tools & Dashboards, it has no sidebar
  // item of its own, so its pages are gated by the Tools area plus the
  // 'href-links' tool grant (checked in the pages themselves).
  { prefix: '/projects', surface: 'tools' },
  { prefix: '/aaaf', surface: 'tools' },
  { prefix: '/hfa', surface: 'tools' },
]

export function surfaceForPath(pathname: string): string | null {
  const hit = ROUTE_SURFACES.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
  return hit?.surface ?? null
}
