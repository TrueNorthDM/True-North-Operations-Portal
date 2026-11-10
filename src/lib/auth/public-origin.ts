/**
 * The two addresses a request handler may need (migration plan, 5 October 2026).
 *
 * On its own server the portal sits behind the server's proxy, and a request
 * reaches it as https://localhost:3000: the scheme of the public address with
 * the host of the container. In development neither variable below is set, so
 * both answers are the request's own origin.
 *
 *   publicOrigin    where people are: links in emails, redirects in the
 *                   browser. APP_URL on the portal's own server.
 *   internalOrigin  where the server reaches itself: the headless Chromium of
 *                   the PDF exports, the manual Monday sync. INTERNAL_ORIGIN,
 *                   set in the portal's Dockerfile to the container's own port.
 */

export function publicOrigin(requestUrl: string): string {
  const app = process.env.APP_URL
  return app ? new URL(app).origin : new URL(requestUrl).origin
}

/**
 * In production the address always comes from INTERNAL_ORIGIN, never from the
 * request: the request's host is whatever the caller wrote, and these calls carry
 * the session cookie or the cron secret (security audit, 10 November 2026; the
 * image sets it, so this only refuses a server started without it).
 */
export function internalOrigin(requestUrl: string): string {
  const internal = process.env.INTERNAL_ORIGIN
  if (internal) return new URL(internal).origin
  if (process.env.NODE_ENV === 'production') throw new Error('INTERNAL_ORIGIN is not set: the portal will not call itself at an address taken from the request.')
  return new URL(requestUrl).origin
}
