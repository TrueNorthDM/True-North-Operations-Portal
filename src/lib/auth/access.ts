/**
 * access.ts — resolves which projects (sites) the signed-in user can reach,
 * via the accessible_site_ids() SECURITY DEFINER function (migration 016).
 *
 * Safe rule: admins → all; a site with no grants → everyone; otherwise only
 * via a team or direct person grant. So with zero grants nothing is hidden.
 */

import { createClient } from '@/lib/supabase/server'

export async function getAccessibleSiteIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('accessible_site_ids', { uid: user.id })
  return new Set(((data ?? []) as { site_id: string }[]).map(r => r.site_id))
}

export async function canAccessSite(siteId: string): Promise<boolean> {
  return (await getAccessibleSiteIds()).has(siteId)
}
