/**
 * Which tools a person's teams open for them. Pure, and the one reading of the
 * rule: loadAccess applies it to the signed-in person, and the notifications
 * apply it to everyone at once to find who may hear about a tool. Two copies
 * would be two answers the first time one of them changed.
 *
 * A grant with audience 'lead' counts only for someone who leads that team. A
 * key no longer in the catalogue grants nothing.
 */

import { teamPositionLeads } from '@/lib/directory/people-types'
import { TOOL_KEYS } from '@/lib/access/tools'

export interface Membership { team_id: string; position?: string | null }
export interface ToolGrant { team_id: string; tool_key: string; audience?: string | null }

export function grantedTools(memberships: readonly Membership[], grants: readonly ToolGrant[]): Set<string> {
  const leads = new Map(memberships.map(m => [m.team_id, teamPositionLeads(m.position ?? 'collaborator')]))
  const out = new Set<string>()
  for (const g of grants) {
    if (!leads.has(g.team_id)) continue
    if (!TOOL_KEYS.has(g.tool_key)) continue
    if (g.audience === 'lead' && !leads.get(g.team_id)) continue
    out.add(g.tool_key)
  }
  return out
}
