/**
 * Every team with the first names of its members, plus which of them the viewer
 * belongs to.
 *
 * One loader for two questions that mean the same thing: the team filter beside
 * the period, and the restricted view's "only your own teammates". Splitting
 * them would have meant two ways to decide who counts as a teammate.
 *
 * Shared by both client reports, so "Team" cannot come to mean one thing on the
 * i7 report and another on Project Hours & Others.
 *
 * First names because that is what the reports' columns are: the hours loaders
 * key people by the first word of full_name. Two Amys would both show, the same
 * collision the reports already live with and not worth solving twice.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentPerson } from '@/lib/auth/session'

/** A team as a report's filter needs it: a name, and who is in it. */
export interface TeamRoster { id: string; name: string; members: string[] }

export async function loadTeamRoster(): Promise<{ teams: TeamRoster[]; myTeamIds: Set<string> }> {
  const supabase = await createClient()

  // The person is shared with the layout and loadAccess, and read alongside the
  // roster rather than before it.
  const [me, { data: teamRows }, { data: memberRows }, { data: peopleRows }] = await Promise.all([
    getCurrentPerson(),
    supabase.from('teams').select('id, name').order('name'),
    supabase.from('team_members').select('team_id, person_id'),
    supabase.from('people').select('id, full_name'),
  ])

  const firstNameById = new Map((peopleRows ?? []).map(p => [p.id, (p.full_name || '').split(' ')[0]]))
  const byTeam = new Map<string, string[]>()
  const myTeamIds = new Set<string>()
  for (const m of memberRows ?? []) {
    const first = firstNameById.get(m.person_id)
    if (first) {
      const list = byTeam.get(m.team_id) ?? []
      if (!list.includes(first)) list.push(first)
      byTeam.set(m.team_id, list)
    }
    if (me && m.person_id === me.id) myTeamIds.add(m.team_id)
  }

  const teams: TeamRoster[] = (teamRows ?? []).map(t => ({
    id: t.id,
    name: t.name,
    members: (byTeam.get(t.id) ?? []).sort((a, b) => a.localeCompare(b)),
  }))
  return { teams, myTeamIds }
}
