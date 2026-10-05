/**
 * The two addresses a request handler may need, on Vercel and on the portal's
 * own server alike (migration plan, 5 October 2026).
 *
 * On its own server the portal sits behind the server's proxy, and a request
 * reaches it as https://localhost:3000: the scheme of the public address with
 * the host of the container. Vercel sets neither variable below, so there both
 * answers are the request's own origin, exactly as before.
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

export function internalOrigin(requestUrl: string): string {
  const internal = process.env.INTERNAL_ORIGIN
  return internal ? new URL(internal).origin : new URL(requestUrl).origin
}
