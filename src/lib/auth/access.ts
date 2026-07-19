/**
 * access.ts: resolves which projects (sites) the signed-in user can reach,
 * via the accessible_site_ids() SECURITY DEFINER function (migration 016).
 *
 * Safe rule: admins → all; a site with no grants → everyone; otherwise only
 * via a team or direct person grant. So with zero grants nothing is hidden.
 *
 * Fail OPEN on errors: if the RPC is missing (migration 016 not applied yet)
 * or fails transiently, return null = "couldn't evaluate" and callers skip
 * filtering. That matches the design rule, nothing is hidden until access is
 * deliberately granted, and avoids silently blanking the portal.
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
  return ids === null ? true : ids.has(siteId)
}
