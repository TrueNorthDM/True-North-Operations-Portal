/**
 * GET /auth/no-access
 *
 * Where the app layout sends a session that may no longer use the portal: the
 * person was deactivated, their invitation revoked, or they were never invited
 * (lib/auth/portal-access.ts). A layout cannot clear cookies while it renders,
 * so the sign-out happens here, in a route handler, and the person lands on the
 * sign-in page with the reason.
 */

import { createClient } from '@/lib/supabase/server'
import { NOT_INVITED_MESSAGE } from '@/lib/auth-constants'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL('/login', request.url)
  url.searchParams.set('error', NOT_INVITED_MESSAGE)
  return NextResponse.redirect(url)
}
