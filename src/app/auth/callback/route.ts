/**
 * GET /auth/callback
 *
 * The user clicks the magic link in their email → Supabase verifies the token
 * → redirects here with `?code=…`. We exchange that code for a session and
 * land them on the dashboard.
 */

import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safe-next'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // Sanitize `next` to prevent open-redirect attacks (see safeNext).
  const next = safeNext(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Surface the error in the login page
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
    return NextResponse.redirect(new URL(next, request.url))
  }

  return NextResponse.redirect(new URL('/login?error=Missing+code', request.url))
}
