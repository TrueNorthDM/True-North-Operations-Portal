/**
 * Routes the proxy lets through without reading a session.
 *
 * Called by machines and authenticated inside the route by a shared secret or a
 * signature, never by a cookie. The proxy used to read the session for these
 * anyway, a network round trip to Supabase Auth on every Monday webhook and every
 * cron firing: in two days of logs in September 2026 it ran 285 times against 115
 * page renders, and 40 of those were webhook calls answered 404 after paying for
 * the session read.
 *
 * Deliberately narrower than the proxy's public paths. /api/monday/item-history is
 * public to the proxy but is called by a signed-in person and reads their session
 * cookie, so it must still go through the session read.
 *
 * Kept out of proxy.ts so it can be tested: a prefix rule decides who skips
 * authentication, and a prefix rule is exactly the kind that matches one path too
 * many without anybody noticing.
 */

export const NO_SESSION_PATHS = ['/api/cron', '/api/monday/webhook'] as const

/** Whether a request to this path is handled without reading the session. */
export function skipsSession(pathname: string): boolean {
  return NO_SESSION_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}
