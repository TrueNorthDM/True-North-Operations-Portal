// view-as-server.ts: resolve the active View Stage impersonation for THIS
// request. The middleware relays the iframe's ?_vs=<token> into the x-vs request
// header; here we verify it, confirm the current (real) user is the admin who
// signed it, and confirm they still hold that role.
//
// The last check is not decoration. isSecurityAdmin() reads the previewed role,
// and it is what gates the /admin area, the API tokens, the webhook secret and
// every budget, rate and salary write. A token lives 30 minutes, so without a
// live check, demoting someone left them holding admin write powers until it
// expired. Verified against the database on every request instead.

import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { verifyViewAs, VS_HEADER, type ViewAsRole } from '@/lib/auth/view-as'

export interface ViewAs {
  /** The level being previewed. The person shown is resolved live from it. */
  role: ViewAsRole
}

// Memoised per request: the tier and the security check both ask for it, and
// each answer now costs a profiles lookup.
export const getViewAs = cache(async function getViewAs(): Promise<ViewAs | null> {
  const h = await headers()
  const payload = verifyViewAs(h.get(VS_HEADER))
  if (!payload) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== payload.sadmin) return null // only the signing admin

  // Queried directly rather than through isSecurityAdmin(), which calls this.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return null            // and only while they still are one

  return { role: payload.role }
})
