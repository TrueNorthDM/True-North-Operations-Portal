/**
 * What each place in the portal is called, in one table.
 *
 * Every page used to spell its own trail out by hand, and they drifted the way
 * hand-copied things do: the rail said "Tools & Dashboards" while two reports
 * under it said "Tools", and the home page was "Home" on four pages and
 * "Dashboard" on twelve. Nobody typed the wrong name on purpose. They copied
 * the trail from whichever page they happened to have open.
 *
 * So the name lives here and both ends read it: the rail draws its tooltip from
 * this, the breadcrumbs draw their parents from this, and renaming a place is
 * one edit that reaches every trail that passes through it.
 *
 * Only places that can be a PARENT need to be here. A leaf says its own name,
 * because a leaf is usually the report or the person you are looking at, which
 * no table can know in advance.
 */

export const NAV_LABEL = {
  '/': 'Home',
  '/my-work': 'My Work',
  '/clocky-hours': 'North Time',
  '/requests': 'Requests',
  '/agenda': 'Agenda',
  '/agenda/settings': 'Settings',
  '/directory': 'Directory',
  '/organization': 'Organization',
  '/human-resources': 'Human Resources',
  '/history': 'History',
  '/admin': 'Admin',
  '/admin/settings': 'Company settings',
  '/settings': 'Settings',
  '/chat': 'Chat',
  '/emails': 'Emails',
  // The Tools panel's pages (22 September 2026). Tools has no landing page of
  // its own, so a trail passes through these and not through a "Tools" crumb.
  '/ops/publishing': 'Publishing Goals',
  '/ops/client-reports': 'Client Reports',
  '/ops/client-reports/i7': 'Client Report · i7',
  /** The parent of the donation records, and its own report beside the i7 one. */
  '/ops/client-reports/project-hours': 'Client Report · Project Hours & Others',
  /** The parent of AAAF and HFA. */
  '/seo/href-links': 'Href Links',
} as const

export type NavHref = keyof typeof NAV_LABEL

export function navLabel(href: NavHref): string {
  return NAV_LABEL[href]
}
