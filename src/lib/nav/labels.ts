/**
 * What each place in the portal is called, in one table.
 *
 * Every page used to spell its own trail out by hand, and they drifted the way
 * hand-copied things do: the rail said "Tools & Dashboards" (now Work Tools) while two reports
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
  '/work-tools': 'Work Tools',
  '/my-work': 'My Work',
  '/hours': 'My Hours',
  '/clocky-hours': 'Clocky',
  '/directory': 'People, Teams and Permissions',
  '/human-resources': 'Human Resources',
  '/admin': 'Admin',
  '/settings': 'Settings',
  /** Not on the rail: reached from Work Tools, and the parent of AAAF and HFA. */
  '/projects': 'Href Link Management',
  /** The i7 report, which is the parent of its own guide. */
  '/work-tools/time-report': 'Client Report · i7',
  /** Sits under the i7 report's path but is its own report, and the parent of
   *  the donation records. The trail says so rather than implying it is a page
   *  of the i7 one. */
  '/work-tools/time-report/grant-pass': 'Client Report · Project Hours & Others',
} as const

export type NavHref = keyof typeof NAV_LABEL

export function navLabel(href: NavHref): string {
  return NAV_LABEL[href]
}
