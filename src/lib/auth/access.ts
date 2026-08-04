/**
 * access.ts: resolves which projects (sites) the signed-in user can reach,
 * via the accessible_site_ids() SECURITY DEFINER function (migration 016).
 *
 * Safe rule: admins → all; a site with no grants → everyone; otherwise only
 * via a team or direct person grant. So with zero grants nothing is hidden.
 *
 * Fails CLOSED on errors. If the RPC is missing or fails transiently we cannot
 * say what this user may reach, and answering "everything" turns a database
 * blip into an access grant. Callers get null = "couldn't evaluate" and treat
 * it as no access.
 *
 * The trade-off is visible on purpose: a broken RPC empties the Projects list
 * rather than quietly widening it, which is the failure you want to notice.
 */

import { createClient } from '@/lib/supabase/server'

/** Set of reachable site ids, or null when access couldn't be evaluated. */
export async function getAccessibleSiteIds(): Promise<Set<string> | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data, error } = await supabase.rpc('accessible_site_ids', { uid: user.id })
  if (error) {
    console.error('[access] accessible_site_ids failed (migration 016 applied?):', error.message)
    return null
  }
  return new Set((data ?? []).map(r => r.site_id))
}

export async function canAccessSite(siteId: string): Promise<boolean> {
  const ids = await getAccessibleSiteIds()
  return ids === null ? false : ids.has(siteId)
}
