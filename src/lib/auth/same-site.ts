/**
 * A request another website started (audit, 10 October 2026).
 *
 * The session cookie is SameSite=Lax, so a link on another site, clicked by
 * an admin, arrives with their session. The admin routes that write by GET
 * (the Monday sync, discovery and backfill, run by typing their address)
 * refuse those. The browser says where a request came from in
 * Sec-Fetch-Site: "none" for an address typed or bookmarked, "same-origin"
 * for the portal's own pages. A server calling the route (the sync's own
 * hops) sends no such header and is not affected.
 */
export function fromAnotherSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  return site === 'cross-site' || site === 'same-site'
}

export const ANOTHER_SITE = 'Open this address yourself, not from a link on another site.'
