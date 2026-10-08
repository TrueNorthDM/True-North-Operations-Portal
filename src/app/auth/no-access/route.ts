/**
 * GET /auth/no-access
 *
 * Where the app layout sends a session that may no longer use the portal: the
 * person was deactivated, their invitation revoked, or they were never invited
 * (lib/auth/portal-access.ts). A layout cannot clear cookies while it renders,
 * so the sign-out happens here, in a route handler, and the person lands on the
 * sign-in page with the reason.
 *
 * It asks the same question again before signing anyone out: a GET can be
 * linked from anywhere, and a link must not be able to sign out somebody who
 * may use the portal (audit, 8 October 2026). Only this device is signed out;
 * the person's other sessions meet the same check on their next page.
 */

import { createClient } from '@/lib/supabase/server'
import { checkPortalAccess } from '@/lib/auth/portal-access'
import { publicOrigin } from '@/lib/auth/public-origin'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request.url)
  if ((await checkPortalAccess()) === 'ok') return NextResponse.redirect(new URL('/', origin))
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  // A code: the login page shows its own wording for it (components/LoginForm.tsx).
  return NextResponse.redirect(new URL('/login?error=not-invited', origin))
}
