/**
 * access/resolve.ts: what the signed-in user may actually reach.
 *
 * Two layers, deliberately separate so each is edited where it makes sense:
 *   1. SURFACES, per access level, on Admin → Access levels. "Does this level
 *      get the Tools area, Settings, salaries…"
 *   2. TOOLS, per team, on the Directory's Teams tab. "Which tools does this
 *      team open."
 *
 * A tool needs BOTH: the level must allow the `tools` surface, and one of the
 * person's teams must grant that tool. A team grant with audience 'lead' only
 * counts for someone who leads that team.
 *
 * Absent grant = denied, and no team = no tools (the configured rollout rule).
 * Admin is exempt from every check, including team grants: an admin who happens
 * to belong to no team must not lose the screens they'd need to fix it.
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTier } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { teamPositionLeads } from '@/components/admin/people-types'
import { surfaceAllowed } from '@/lib/access/surfaces'
import { TOOL_KEYS } from '@/lib/access/tools'
import type { RoleType } from '@/lib/auth/tier'

export interface Access {
  roleType: RoleType
  isAdmin: boolean
  isPrivileged: boolean
  isLead: boolean
  /** Can this person reach a surface (see access/surfaces.ts for the keys)? */
  can: (surfaceKey: string) => boolean
  /** Can this person open a tool (see access/tools.ts for the keys)? */
  canTool: (toolKey: string) => boolean
  /** Tool keys they can open, for filtering menus. */
  toolKeys: ReadonlySet<string>
}

// Memoised per request: the layout resolves access to build the sidebar and
// each guarded page resolves it again, which would otherwise repeat the same
// three queries on every navigation.
export const loadAccess = cache(async function loadAccess(): Promise<Access> {
  const tier = await getCurrentTier()
  const isAdmin = tier.roleType === 'admin'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: pageRows }, me] = await Promise.all([
    supabase.from('access_level_pages').select('role_type, surface_key, allowed'),
    loadCurrentPerson(supabase, user),
  ])

  const configured = new Map<string, boolean>()
  for (const r of pageRows ?? []) configured.set(`${r.role_type}:${r.surface_key}`, r.allowed)

  const can = (key: string) => surfaceAllowed(tier.roleType, key, configured)

  // ── Tools, from the person's teams ────────────────────────────────────────
  let toolKeys = new Set<string>()
  if (isAdmin) {
    // Admin opens everything; the caller filters by the catalogue itself.
    toolKeys = new Set<string>(['*'])
  } else if (can('tools') && me) {
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id, position')
      .eq('person_id', me.id)

    const teamIds = (memberships ?? []).map(m => m.team_id)
    if (teamIds.length) {
      const leadsTeam = new Map(
        (memberships ?? []).map(m => [m.team_id, teamPositionLeads((m as { position?: string }).position ?? 'collaborator')]),
      )
      const { data: grants } = await supabase
        .from('team_tool_grants')
        .select('team_id, tool_key, audience')
        .in('team_id', teamIds)

      for (const g of grants ?? []) {
        // A grant for a key no longer in the catalogue grants nothing: removing
        // a tool from Tools & Dashboards has to close its route too, not just
        // hide its card. The stale rows stay in the table harmlessly.
        if (!TOOL_KEYS.has(g.tool_key)) continue
        if (g.audience === 'lead' && !leadsTeam.get(g.team_id)) continue
        toolKeys.add(g.tool_key)
      }
    }
  }

  return {
    roleType: tier.roleType,
    isAdmin,
    isPrivileged: tier.isPrivileged,
    isLead: tier.isLead,
    can,
    canTool: (key: string) => toolKeys.has('*') || toolKeys.has(key),
    toolKeys,
  }
})

/**
 * Page guard: send anyone without the surface back Home. Returns the resolved
 * access so the page can keep using it without loading it twice.
 */
export async function requireSurface(surfaceKey: string): Promise<Access> {
  const access = await loadAccess()
  if (!access.can(surfaceKey)) redirect('/')
  return access
}
