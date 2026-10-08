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
import { isFounding } from '@/lib/auth/portal-rule'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyViewAs, VS_HEADER, type ViewAsRole } from '@/lib/auth/view-as'
import { mailboxFilter } from '@/lib/auth/mailbox-filter'

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
  if (!isFounding(user.email)) {
    const { data: byLink } = await supabase.from('people').select('access_level').eq('profile_id', user.id).limit(1)
    let level = (byLink?.[0] as { access_level: string | null } | undefined)?.access_level ?? null
    const mailbox = level ? null : mailboxFilter(user.email)
    if (mailbox) {
      const { data: byMail } = await createAdminClient().from('people').select('access_level').or(mailbox).limit(1)
      level = (byMail?.[0] as { access_level: string | null } | undefined)?.access_level ?? null
    }
    if (level !== 'super_admin') return null          // and only while they still are one
  }

  return { role: payload.role }
})

/**
 * A redirect's destination, keeping a View Stage preview (?_vs) when the
 * request carries one: a page that sends a previewed level elsewhere (no
 * access, an old address) must land on the preview of the next page, not on
 * the Super Admin's own (audit, 8 October 2026). Only the token is passed
 * along; the page it lands on verifies it again.
 *
 * Use as redirect(await previewHref('/')). It returns a promise on purpose:
 * redirect() takes a string, so forgetting the await is a type error, never a
 * guard that silently does not redirect.
 */
export async function previewHref(href: string): Promise<string> {
  const token = (await headers()).get(VS_HEADER)
  if (!token) return href
  const [path, hash = ''] = href.split('#')
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}_vs=${encodeURIComponent(token)}${hash ? `#${hash}` : ''}`
}
