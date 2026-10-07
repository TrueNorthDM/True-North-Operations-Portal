// view-as-server.ts: resolve the active View Stage impersonation for THIS
// request. The middleware relays the iframe's ?_vs=<token> into the x-vs request
// header; here we verify it, confirm the current (real) user is the admin who
// signed it, and confirm they still hold that role.
//
// The last check is not decoration: a token lives 30 minutes, so without a live
// check, someone who stopped being a Super Admin would keep previewing until it
// expired. Verified against the database on every request instead. View Stage
// is Super Admin only (access catalogue, 7 October 2026).

import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Queried directly rather than through the access resolver, which calls this.
  // The founding account is a Super Admin even before it is linked to a person.
  if (user.email?.toLowerCase() !== 'arnaldo.oliveira@me.com') {
    const { data: byLink } = await supabase.from('people').select('access_level').eq('profile_id', user.id).limit(1)
    let level = (byLink?.[0] as { access_level: string | null } | undefined)?.access_level ?? null
    if (!level && user.email) {
      const em = user.email
      const { data: byMail } = await createAdminClient().from('people').select('access_level')
        .or(`email_personal.eq.${em},email_true_north.eq.${em},email_goodnews.eq.${em},email_coe.eq.${em}`).limit(1)
      level = (byMail?.[0] as { access_level: string | null } | undefined)?.access_level ?? null
    }
    if (level !== 'super_admin') return null          // and only while they still are one
  }

  return { role: payload.role }
})
