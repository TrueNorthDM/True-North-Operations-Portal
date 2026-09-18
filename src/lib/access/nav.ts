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
  'my-hours',
  'directory',
  'human-resources',
  'admin',
  'clocky-hours',
  'settings',
]

/**
 * Rail items that open a module of several separately granted views.
 *
 * My Work, Report and My Team are three grants behind one icon: three icons
 * for three tabs of one header would be three ways to open the same page. The
 * rail shows the module when the person can reach ANY of them, and opens
 * whichever they can, which is why the href cannot be a constant.
 */
export const MODULE_VIEWS: Record<string, readonly { surface: string; href: string }[]> = {
  'my-work': [
    { surface: 'my-work', href: '/my-work' },
    { surface: 'report', href: '/report' },
    { surface: 'my-team', href: '/my-work?tab=team' },
  ],
}

/** Can this person open the rail item at all, module or plain surface? */
export function navVisible(key: string, can: (surfaceKey: string) => boolean): boolean {
  const views = MODULE_VIEWS[key]
  return views ? views.some(v => can(v.surface)) : can(key)
}

/** Where the rail item goes: the first view they are actually allowed. */
export function navHref(key: string, can: (surfaceKey: string) => boolean): string | null {
  const views = MODULE_VIEWS[key]
  if (!views) return null
  return views.find(v => can(v.surface))?.href ?? null
}

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
  { prefix: '/work-tools', surface: 'tools' },
  { prefix: '/dashboards', surface: 'tools' },
  { prefix: '/boards-beta', surface: 'tools' },
  // Href Link Management lives inside Work Tools, it has no sidebar
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
