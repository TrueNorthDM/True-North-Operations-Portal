/**
 * my-team.ts: My Team, the people on the teams the signed-in person belongs to,
 * whatever their access level. A name links to that person's page when the
 * viewer may open it (lib/directory/page-rights.ts): their own always, and the
 * others as Access levels says.
 *
 * Loads only those teams' members rather than the whole company, so it stays
 * cheap even as the directory grows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignedInIdentity } from './current-person'
import type { Database } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { teamKeyFromName } from '@/lib/directory/people-types'
import { asRoleType } from '@/lib/auth/tier'
import type { RestrictedPerson, RestrictedTeam } from '@/components/admin/RestrictedDirectory'
import { TEAM_POSITION_LABEL, normalPosition } from '@/lib/directory/people-types'
import { colourOf, teamColoursFrom } from '@/lib/directory/team-colour'
import { TOOLS } from '@/lib/access/tools'

type Client = SupabaseClient<Database>

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export interface MyTeamView {
  people: RestrictedPerson[]
  teamNames: string[]
  /**
   * The viewer's teams as cards. Tool access is filled from level 2 up and
   * null below, which is the one thing that separates the two levels: at
   * level 1 the tab shows who is on the team, at level 2 it also shows what
   * the team can reach.
   */
  teams: RestrictedTeam[]
  selfId: string | null
}

/**
 * @param opts.level 2 adds the Teams tab's tool access (access/surfaces.ts).
 * @param opts.hrefFor each person's page when the viewer may open it, else null.
 */
export async function loadMyTeam(
  supabase: Client,
  user: SignedInIdentity | null,
  opts: { level: 1 | 2; hrefFor: (personId: string) => string | null },
): Promise<MyTeamView> {
  const { level, hrefFor } = opts
  const me = await loadCurrentPerson(supabase, user)
  if (!me) return { people: [], teamNames: [], teams: [], selfId: null }

  // One read of the team palette for the whole view, so every avatar on the
  // page agrees with every other and with the directory.
  const { data: allTeams } = await supabase.from('teams').select('name, color')
  const colours = teamColoursFrom((allTeams ?? []) as { name: string; color: string | null }[])

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

  // Enough for the card list: name, avatar, team colour, and the manager
  // lookup. Nothing here is private to the person.
  // Spelled out rather than composed: the typed client can only infer the row
  // shape from a literal, so a concatenated string erases the types.
  const { data: rows } = await supabase
    .from('people')
    .select('id, full_name, title, avatar_url, role_type, status, manager_id')
    .in('id', [...personIds])

  const nameById = new Map((rows ?? []).map(r => [r.id, r.full_name]))
  // The primary team drives the avatar colour; one lookup for the whole set.
  const { data: primary } = await supabase
    .from('team_members')
    .select('person_id, team_id, teams(name)')
    .in('person_id', [...personIds])
  const teamNamesByPerson = new Map<string, string[]>()
  for (const m of (primary ?? []) as unknown as { person_id: string; teams: { name: string } | null }[]) {
    if (!m.teams?.name) continue
    const list = teamNamesByPerson.get(m.person_id) ?? []
    if (!list.includes(m.teams.name)) list.push(m.teams.name)
    teamNamesByPerson.set(m.person_id, list)
  }
  for (const list of teamNamesByPerson.values()) list.sort((a, b) => a.localeCompare(b))
  const teamNameByPerson = new Map([...teamNamesByPerson].map(([id, list]) => [id, list[0]]))

  const people: RestrictedPerson[] = (rows ?? [])
    .filter(p => p.status !== 'inactive')
    .map((p): RestrictedPerson => {
      const teamName = teamNameByPerson.get(p.id) ?? null
      return {
        id: p.id,
        name: p.full_name,
        title: str(p.title),
        teamName,
        teamKey: teamKeyFromName(teamName ?? undefined),
        color: colourOf(colours, teamName),
        avatarUrl: p.avatar_url ?? null,
        roleType: asRoleType(p.role_type),
        status: 'active',
        href: hrefFor(p.id),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── The Teams tab ────────────────────────────────────────────────────────
  const teamCards: RestrictedTeam[] = []
  if (teamIds.length) {
    const [{ data: teamRows }, { data: memberRows }, tools] = await Promise.all([
      supabase.from('teams').select('id, name').in('id', teamIds),
      supabase.from('team_members').select('team_id, person_id, position').in('team_id', teamIds),
      // Level 1 never sees tool access, so it is never even asked for.
      level >= 2
        ? supabase.from('team_tool_grants').select('team_id, tool_key, audience').in('team_id', teamIds)
        : Promise.resolve({ data: [] as { team_id: string; tool_key: string; audience: string }[] }),
    ])

    const titleById = new Map((rows ?? []).map(r => [r.id, str(r.title)]))
    const avatarById = new Map((rows ?? []).map(r => [r.id, r.avatar_url ?? null]))
    const toolLabel = new Map(TOOLS.map(t => [t.key, t.label]))

    const byTeam = new Map<string, { person_id: string; position?: string }[]>()
    for (const m of (memberRows ?? []) as { team_id: string; person_id: string; position?: string }[]) {
      byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m])
    }
    const toolsByTeam = new Map<string, { label: string; audience: 'lead' | 'all' }[]>()
    for (const t of (tools.data ?? []) as { team_id: string; tool_key: string; audience: string }[]) {
      // A grant for a tool that left the catalogue grants nothing, so it is not listed.
      if (!toolLabel.has(t.tool_key)) continue
      toolsByTeam.set(t.team_id, [...(toolsByTeam.get(t.team_id) ?? []), {
        label: toolLabel.get(t.tool_key) ?? t.tool_key,
        audience: t.audience === 'lead' ? 'lead' : 'all',
      }])
    }

    for (const t of (teamRows ?? []) as { id: string; name: string }[]) {
      teamCards.push({
        id: t.id,
        name: t.name,
        teamKey: teamKeyFromName(t.name),
        color: colourOf(colours, t.name),
        members: (byTeam.get(t.id) ?? [])
          .map(m => ({
            id: m.person_id,
            name: nameById.get(m.person_id) ?? 'Unknown',
            title: titleById.get(m.person_id) ?? null,
            avatarUrl: avatarById.get(m.person_id) ?? null,
            positionLabel: TEAM_POSITION_LABEL[normalPosition(m.position)],
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        tools: level >= 2 ? (toolsByTeam.get(t.id) ?? []) : null,
      })
    }
    teamCards.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { people, teamNames, teams: teamCards, selfId: me.id }
}
