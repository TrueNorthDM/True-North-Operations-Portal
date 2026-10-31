/**
 * proxy.ts: auth gate for every route.
 *
 * Next.js 16+ renamed `middleware` → `proxy`. Same behavior, new file name.
 *
 * If the request has no Supabase session cookie, redirect to /login.
 * Public exceptions: /login itself, /auth/* (callback), static assets.
 *
 * Also refreshes the session cookie on every request, so it doesn't expire
 * mid-session.
 */

import { createServerClient } from '@supabase/ssr'
import { gateHeaders } from '@/lib/supabase/gate'
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'
import { NextResponse, type NextRequest } from 'next/server'
import { skipsSession } from '@/lib/auth/no-session-paths'
import { switchOverAction } from '@/lib/switch-over'

// Paths that bypass the user-session auth gate.
//   /login + /auth, sign-in flow itself
//   /api/monday: the Monday webhook, authenticated by the secret in its own
//                URL (src/lib/monday/webhook-secret.ts), not a user cookie;
//                without this exception Monday's POSTs get a 307 to /login.
//                Every route under it checks its own caller (item-history:
//                verifiedSession), and coverage.test.ts fails a route that
//                does not.
//   /meet: the public booking page (Agenda booking links), for people with
//          no portal login; its actions check the link and the limits
//          themselves (app/meet/actions.ts).
//   /legal: the privacy policy and terms, static pages Google's review of the
//           portal's Google sign-in reads without a login.
const PUBLIC_PATHS = ['/login', '/auth', '/api/monday', '/api/cron', '/meet', '/legal']


// Design checks run without a login, and only ever in development: the page
// itself refuses to render in a production build, and this refuses to let the
// request through, so both halves have to fail for real work to be exposed.
// /__design serves a handoff's own HTML beside the rebuilt screen, so the two
// can be compared in one browser instead of by eye across two windows. The
// folder is gitignored and never exists in a deployed build.
const DEV_ONLY_PUBLIC = ['/design-check', '/__design']

function isPublic(pathname: string): boolean {
  const paths = process.env.NODE_ENV === 'production'
    ? PUBLIC_PATHS
    : [...PUBLIC_PATHS, ...DEV_ONLY_PUBLIC]
  return paths.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  // The maintenance pause (lib/switch-over.ts): off unless MAINTENANCE_MODE is
  // set, and it comes before everything else, machine routes included.
  const move = switchOverAction({
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    env: { MAINTENANCE_MODE: process.env.MAINTENANCE_MODE },
  })
  if (move?.kind === 'maintenance-page') return NextResponse.rewrite(new URL('/maintenance', request.url))
  if (move?.kind === 'unavailable') {
    return NextResponse.json(
      { error: 'The portal is paused for maintenance.' },
      { status: move.status, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // View Stage: relay the iframe's ?_vs=<token> into the x-vs request header (and
  // strip any forged incoming x-vs). getViewAs re-verifies the token server-side.
  const requestHeaders = new Headers(request.headers)
  const vs = request.nextUrl.searchParams.get('_vs')
  if (vs) requestHeaders.set('x-vs', vs)
  else requestHeaders.delete('x-vs')
  // Measuring navigation speed (lib/supabase/timed-fetch.ts): the page each database call belongs to.
  if (process.env.PERF_DB === '1') requestHeaders.set('x-perf-path', `${request.nextUrl.pathname}${request.headers.get('rsc') ? ' (nav)' : ''}`)

  // Before any session work, and after the header is cleaned: skipping the
  // session must never also skip stripping a forged x-vs.
  const { pathname } = request.nextUrl
  // Machine routes: see lib/auth/no-session-paths.ts for which, and why.
  if (skipsSession(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: gateHeaders() },
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          // The library's no-store headers ride with a refreshed session, so no
          // cache between here and the browser keeps one person's new cookie
          // and hands it to the next (audit, 8 October 2026).
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // getClaims(), not getUser(). It refreshes an expired session exactly as
  // getUser() did, because it goes through getSession() first, and then verifies
  // the token's signature locally against the project's public key (ES256), where
  // getUser() asked the Auth server over the network on every single request,
  // prefetches included. Never getSession() on its own: that reads the cookie
  // without verifying anything.
  //
  // What this gives up: a verified, unexpired token is trusted without asking
  // whether its session was revoked, so a signed-out user can pass here for up to
  // the token's hour. Pages then read roles live from the database, and writes
  // verify with getUser() themselves. See lib/auth/session.ts.
  const claimsAt = performance.now()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims ?? null
  if (process.env.PERF_DB === '1') console.log(`[perf] proxy ${pathname}${request.headers.get('rsc') ? ' (nav)' : ''}${request.headers.get('next-router-prefetch') ? ' (prefetch)' : ''} getClaims=${Math.round(performance.now() - claimsAt)}ms`)

  // Public routes, always allowed
  if (isPublic(pathname)) {
    // If already logged in, kick away from /login
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protected routes, require a session
  if (!user) {
    // A server action whose session has ended: the redirect below would hand
    // it the sign-in page's HTML, which it cannot read ("An unexpected response
    // was received from the server"). Next's action client follows an
    // x-action-redirect header with no page data as a full navigation, so the
    // person lands on sign-in and comes back to this page afterwards.
    // An API call gets a 401 it can act on. (Audit, 8 October 2026.)
    const back = pathname + request.nextUrl.search
    if (request.headers.has('next-action')) {
      return new NextResponse(null, {
        status: 303,
        headers: { 'x-action-redirect': `/login?next=${encodeURIComponent(back)};replace`, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      })
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Your session has ended. Sign in again.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    const loginUrl = new URL('/login', request.url)
    // Path AND query. The Report keeps its tab, scope and period in the query
    // string precisely so a link can be pasted to somebody else, and dropping
    // it here sent every shared link to the default view after signing in.
    // safeNext still refuses anything that is not a same-origin relative path.
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

// Match all routes except Next.js internals and static files.
export const config = {
  matcher: [
    // Exclude Next internals + static public assets.
    //
    // manifest.webmanifest belongs here for a reason that is easy to miss: the
    // browser fetches it with no session in order to offer installing the app,
    // so gating it sends the browser a login redirect instead of the manifest
    // and the install never appears. It names the app and its icons and holds
    // nothing private. The icon files are already covered by the .svg/.png/.ico
    // rules, which is why only this one had to be named.
    //
    // email-templates/ holds the sign-in email templates. The self-hosted
    // sign-in service (migration plan, step p3-mail) fetches them by URL with no
    // session; they hold placeholders only, nothing private.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|logos/|email-templates/|.*\\.svg|.*\\.png|.*\\.jpg).*)',
  ],
}
