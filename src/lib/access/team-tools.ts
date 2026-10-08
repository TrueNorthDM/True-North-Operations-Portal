/**
 * The tools each team is on, as Access levels sets them (each tool's team
 * list, access_tool_scope and access_tool_teams, read by loadRules). The
 * Directory and My Team show it on their team cards.
 *
 * Until the audit of 8 October 2026 those cards read team_tool_grants, a table
 * left from before the access model, so what they listed could differ from
 * what actually opened. Whether a person opens a tool still depends on their
 * level too (decide.ts); this answers only "is the team on the tool's list".
 */

import { TOOL_ITEMS } from './catalogue'
import type { Rules } from './decide'

export interface TeamTool { toolKey: string; audience: 'all' | 'lead' }

export function toolsByTeam(rules: Rules, teamIds: Iterable<string>): Map<string, TeamTool[]> {
  const out = new Map<string, TeamTool[]>([...teamIds].map(id => [id, []]))
  for (const tool of TOOL_ITEMS) {
    const scope = rules.tools.get(tool.key)
    if (!scope) continue // no team yet: closed to everyone but Super Admins
    for (const [teamId, list] of out) {
      // "Every team" puts the tool on every card, for the whole team.
      const audience = scope.every ? 'team' : scope.teams.get(teamId)
      if (audience) list.push({ toolKey: tool.key, audience: audience === 'lead' ? 'lead' : 'all' })
    }
  }
  return out
}
