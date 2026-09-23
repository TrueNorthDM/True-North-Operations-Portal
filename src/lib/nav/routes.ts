/**
 * Every address a page links to that has moved, in one place.
 *
 * The navigation redesign of 22 September 2026 (Design/Redesign Handoff) moved
 * the operations tools under /ops and the SEO tools under /seo. About sixty
 * hand-typed paths pointed into those routes, and a stale one does not fail
 * loudly: a revalidatePath on an old address just stops a page refreshing, and
 * a PDF route opening an old print address prints the login page. So a path
 * that moves is written here once and read everywhere.
 *
 * The old addresses redirect (next.config.ts), so a link already sent keeps
 * working; this module is for the links the portal writes itself.
 */

export const ROUTES = {
  home: '/',
  publishing: '/ops/publishing',
  boards: '/ops/boards',
  boardsTranslation: '/ops/boards/translation',
  boardsTargets: '/ops/boards/targets',
  clientReports: '/ops/client-reports',
  i7: '/ops/client-reports/i7',
  projectHours: '/ops/client-reports/project-hours',
  hrefLinks: '/seo/href-links',
  organization: '/organization',
  chat: '/chat',
  emails: '/emails',
} as const

/** The AAAF or HFA page list. Replaces every `/${siteCode}` in the Href Links pages. */
export const hrefLinksSite = (siteCode: string) => `${ROUTES.hrefLinks}/${siteCode}`

/** One page of a site's list. */
export const hrefLinksPage = (siteCode: string, id: string | number) => `${hrefLinksSite(siteCode)}/${id}`
