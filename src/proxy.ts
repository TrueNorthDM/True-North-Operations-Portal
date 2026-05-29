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

const PUBLIC_PATHS = ['/login', '/auth']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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
    '/((?!_next/static|_next/image|favicon.ico|logos/|.*\\.svg|.*\\.png|.*\\.jpg).*)',
  ],
}
