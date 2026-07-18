/**
 * proxy.ts — auth gate for every route.
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

// Paths that bypass the user-session auth gate.
//   /login + /auth     — sign-in flow itself
//   /api/monday        — webhooks from Monday; authentication is HMAC of the
//                        payload (see src/lib/monday/verify.ts), not a user
//                        cookie. Without this exception, Monday's POSTs get
//                        a 307 → /login and the webhook test fails.
const PUBLIC_PATHS = ['/login', '/auth', '/api/monday', '/api/cron']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  // View Stage: relay the iframe's ?_vs=<token> into the x-vs request header (and
  // strip any forged incoming x-vs). getViewAs re-verifies the token server-side.
  const requestHeaders = new Headers(request.headers)
  const vs = request.nextUrl.searchParams.get('_vs')
  if (vs) requestHeaders.set('x-vs', vs)
  else requestHeaders.delete('x-vs')

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

  // IMPORTANT: getUser() will refresh the session if it's expired.
  // Don't use getSession() in middleware — it doesn't revalidate.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — always allowed
  if (isPublic(pathname)) {
    // If already logged in, kick away from /login
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protected routes — require a session
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

// Match all routes except Next.js internals and static files.
export const config = {
  matcher: [
    // Exclude Next internals + static public assets. theme-init.js MUST be here:
    // it's requested pre-auth on /login, and without the exclusion the gate
    // 307s it to /login, so the saved/system theme never applies on the login
    // screen.
    '/((?!_next/static|_next/image|favicon.ico|logos/|theme-init.js|.*\\.svg|.*\\.png|.*\\.jpg).*)',
  ],
}
