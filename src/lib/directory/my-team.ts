/**
 * my-team.ts: the Level 1 directory view for the signed-in person, whatever
 * their access level.
 *
 * /directory shows whatever their level allows (up to the full admin tabs);
 * this is the personal view, always Level 1: the people on the teams they
 * belong to, with only their own card openable. An admin gets the same thing
 * their team gets, which is the point of having it in the user menu.
 *
 * Loads only those teams' members rather than the whole company, so it stays
 * cheap even as the directory grows.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { teamKeyFromName } from '@/components/admin/people-types'
import { asRoleType } from '@/lib/auth/tier'
import type { RestrictedPerson } from '@/components/admin/RestrictedDirectory'

type Client = SupabaseClient<Database>

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export interface MyTeamView {
  people: RestrictedPerson[]
  teamNames: string[]
}

export async function loadMyTeam(supabase: Client, user: User | null): Promise<MyTeamView> {
  const me = await loadCurrentPerson(supabase, user)
  if (!me) return { people: [], teamNames: [] }

  const { data: myMemberships } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('person_id', me.id)
  const teamIds = (myMemberships ?? []).map(m => m.team_id)

  // Everyone on those teams (the viewer is always included, even with no team).
  const personIds = new Set<string>([me.id])
  let teamNames: string[] = []
  if (teamIds.length) {
    const [{ data: peers }, { data: teams }] = await Promise.all([
      supabase.from('team_members').select('person_id').in('team_id', teamIds),
      supabase.from('teams').select('name').in('id', teamIds),
    ])
    for (const p of peers ?? []) personIds.add(p.person_id)
    teamNames = (teams ?? []).map(t => t.name).sort((a, b) => a.localeCompare(b))
  }

  const { data: rows } = await supabase
    .from('people')
    .select('id, full_name, title, avatar_url, role_type, status, manager_id, email_true_north, email_goodnews, email_coe, phone, location, hire_date, employment_type')
    .in('id', [...personIds])

  const nameById = new Map((rows ?? []).map(r => [r.id, r.full_name]))
  // The primary team drives the avatar colour; one lookup for the whole set.
  const { data: primary } = await supabase
    .from('team_members')
    .select('person_id, team_id, teams(name)')
    .in('person_id', [...personIds])
  const teamNameByPerson = new Map<string, string>()
  for (const m of (primary ?? []) as unknown as { person_id: string; teams: { name: string } | null }[]) {
    if (m.teams?.name && !teamNameByPerson.has(m.person_id)) teamNameByPerson.set(m.person_id, m.teams.name)
  }

  const people: RestrictedPerson[] = (rows ?? [])
    .filter(p => p.status !== 'inactive')
    .map((p): RestrictedPerson => {
      const teamName = teamNameByPerson.get(p.id) ?? null
      const mgrId = str(p.manager_id)
      const isSelf = p.id === me.id
      return {
        id: p.id,
        name: p.full_name,
        title: str(p.title),
        teamName,
        teamKey: teamKeyFromName(teamName ?? undefined),
        avatarUrl: p.avatar_url ?? null,
        roleType: asRoleType(p.role_type),
        status: 'active',
        // Level 1: only your own card carries detail.
        detail: isSelf
          ? {
              managerName: mgrId ? nameById.get(mgrId) ?? null : null,
              workEmail: str(p.email_true_north) ?? str(p.email_goodnews) ?? str(p.email_coe),
              phone: str(p.phone),
              location: str(p.location),
              hireDate: str(p.hire_date),
              employmentType: str(p.employment_type),
            }
          : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return { people, teamNames }
}
