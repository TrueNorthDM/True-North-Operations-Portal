/**
 * GET /auth/callback
 *
 * The user clicks the magic link in their email → Supabase verifies the token
 * → redirects here with `?code=…`. We exchange that code for a session and
 * land them on the dashboard.
 */

import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safe-next'
import { withStartPage } from '@/lib/auth/start-page'
import { publicOrigin } from '@/lib/auth/public-origin'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  // Redirects go to the address the person is on (APP_URL on the own server).
  const base = publicOrigin(request.url)
  const code = url.searchParams.get('code')
  // Sanitize `next` to prevent open-redirect attacks (see safeNext).
  // Where they were going: ?next= from older links, else the cookie
  // sendMagicLink set when the sign-in started (see app/auth/actions.ts).
  const next = safeNext(url.searchParams.get('next') ?? request.cookies.get('tn_next')?.value)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Surface the error in the login page
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, base))
    }
    // No page asked for: the start page they chose in Settings (Home by default).
    return NextResponse.redirect(new URL(await withStartPage(next, data.user), base))
  }

  return NextResponse.redirect(new URL('/login?error=Missing+code', base))
}
