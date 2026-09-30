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
import { NextResponse, type NextRequest } from 'next/server'
import { skipsSession } from '@/lib/auth/no-session-paths'
import { switchOverAction } from '@/lib/switch-over'

// Paths that bypass the user-session auth gate.
//   /login + /auth, sign-in flow itself
//   /api/monday: webhooks from Monday; authentication is HMAC of the
//                        payload (see src/lib/monday/verify.ts), not a user
//                        cookie. Without this exception, Monday's POSTs get
//                        a 307 → /login and the webhook test fails.
const PUBLIC_PATHS = ['/login', '/auth', '/api/monday', '/api/cron']


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
  // Switch-over day (lib/switch-over.ts, deploy/SWITCH-OVER.md): the old
  // portal's maintenance page and its redirect to the new address. Both are off
  // unless their environment variable is set, and they come before everything
  // else, machine routes included.
  const move = switchOverAction({
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    env: { MAINTENANCE_MODE: process.env.MAINTENANCE_MODE, LEGACY_REDIRECT_TO: process.env.LEGACY_REDIRECT_TO },
  })
  if (move?.kind === 'redirect') return NextResponse.redirect(move.location, 308)
  if (move?.kind === 'maintenance-page') return NextResponse.rewrite(new URL('/maintenance', request.url))
  if (move?.kind === 'unavailable') {
    return NextResponse.json(
      { error: move.status === 410 ? 'This portal has moved.' : 'The portal is paused while it moves.' },
      { status: move.status, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // View Stage: relay the iframe's ?_vs=<token> into the x-vs request header (and
  // strip any forged incoming x-vs). getViewAs re-verifies the token server-side.
  const requestHeaders = new Headers(request.headers)
  const vs = request.nextUrl.searchParams.get('_vs')
  if (vs) requestHeaders.set('x-vs', vs)
  else requestHeaders.delete('x-vs')

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
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
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
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims ?? null

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
