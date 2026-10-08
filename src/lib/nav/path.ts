/**
 * Matching an address against the current page, for the rail in the browser.
 *
 * Its own module on purpose (audit, 8 October 2026): lib/access/nav.ts holds
 * the whole rail, every page and tool name and address, and must never reach
 * the browser, where each person gets only their own rows (built on the
 * server). The rail needs just these two functions, so they live here.
 * A test (lib/access/view-as-links.test.ts) refuses a browser import of nav.ts
 * that is not type-only.
 */

/** The address without its query or section, for matching the current page. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0]
}

/** Is `pathname` this address or somewhere under it? */
export function onPath(pathname: string, prefix: string): boolean {
  return prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/')
}
