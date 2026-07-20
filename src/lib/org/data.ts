/**
 * org/data.ts: reads the People & Teams directory and builds the org chart
 * tree (by manager_id). Read-only; the chart redraws whenever the directory
 * changes. RLS lets any signed-in user read people/teams, so this works for
 * everyone (the chart is public to logged-in users).
 */

import { createClient } from '@/lib/supabase/server'

export interface OrgPerson {
  id: string
  name: string
  title: string | null
  /** Signature color for the card/threads: the team they lead, else their first team. */
  color: string | null
  teams: { name: string; color: string | null }[]
  /** Teams this person leads, rendered as a box of members under them. */
  ledTeams: OrgTeamGroup[]
  children: OrgPerson[]
}

export interface OrgTeamGroup {
  name: string
  color: string | null
  members: { id: string; name: string }[]
}

interface PersonRow {
  id: string
  full_name: string
  title: string | null
  manager_id: string | null
  status: string
  sort_order: number
}
interface TeamRow {
  id: string
  name: string
  color: string | null
}
interface MemberRow {
  team_id: string
  person_id: string
  position: string // 'team_leader' | 'collaborator' (migration 040)
}

export async function getOrgChart(): Promise<{ roots: OrgPerson[]; total: number }> {
  const supabase = await createClient()

  const [{ data: pData }, { data: tData }] = await Promise.all([
    supabase.from('people').select('id, full_name, title, manager_id, status, sort_order'),
    supabase.from('teams').select('id, name, color'),
  ])
  // team_members + per-team position (040); graceful pre-migration.
  let tmRes = await supabase.from('team_members').select('team_id, person_id, position')
  if (tmRes.error) tmRes = (await supabase.from('team_members').select('team_id, person_id')) as typeof tmRes

  // Inactive people are hidden everywhere outside the People tab, the org chart
  // (and its "N people" count) shows actives only.
  const people: PersonRow[] = (pData ?? []).filter(p => p.status !== 'inactive')
  const teams: TeamRow[] = tData ?? []
  const members: MemberRow[] = (tmRes.data ?? []).map((m: { team_id: string; person_id: string; position?: string }) => ({
    team_id: m.team_id,
    person_id: m.person_id,
    position: m.position === 'founder' ? 'founder' : m.position === 'manager' ? 'manager' : m.position === 'team_leader' ? 'team_leader' : 'collaborator',
  }))

  if (people.length === 0) return { roots: [], total: 0 }

  const teamById = new Map(teams.map(t => [t.id, t]))
  // person → their teams
  const teamsByPerson = new Map<string, { name: string; color: string | null }[]>()
  for (const m of members) {
    const t = teamById.get(m.team_id)
    if (!t) continue
    const arr = teamsByPerson.get(m.person_id) ?? []
    arr.push({ name: t.name, color: t.color })
    teamsByPerson.set(m.person_id, arr)
  }

  // Signature color: the team a person LEADS wins (so leaders carry their team's
  // color even when they aren't listed as a member), else their first team.
  const leaderColor = new Map<string, string | null>()
  for (const m of members) {
    if (m.position !== 'team_leader' && m.position !== 'founder') continue
    const t = teamById.get(m.team_id)
    if (t?.color) leaderColor.set(m.person_id, t.color)
  }

  // Members per team (for the team box rendered under the leader).
  const nameById = new Map(people.map(p => [p.id, p.full_name]))
  const membersByTeam = new Map<string, { id: string; name: string }[]>()
  for (const m of members) {
    if (!teamById.has(m.team_id)) continue
    if (!nameById.has(m.person_id)) continue // skip inactive members (filtered out of people)
    const arr = membersByTeam.get(m.team_id) ?? []
    arr.push({ id: m.person_id, name: nameById.get(m.person_id) ?? '?' })
    membersByTeam.set(m.team_id, arr)
  }
  for (const arr of membersByTeam.values()) arr.sort((a, b) => a.name.localeCompare(b.name))

  // Teams each person leads, with their members.
  const ledTeamsByLeader = new Map<string, OrgTeamGroup[]>()
  for (const m of members) {
    if (m.position !== 'team_leader' && m.position !== 'founder') continue
    const t = teamById.get(m.team_id)
    if (!t) continue
    const arr = ledTeamsByLeader.get(m.person_id) ?? []
    arr.push({ name: t.name, color: t.color, members: membersByTeam.get(t.id) ?? [] })
    ledTeamsByLeader.set(m.person_id, arr)
  }

  // Build nodes, then wire children by manager_id.
  const nodeById = new Map<string, OrgPerson>()
  for (const p of people) {
    const myTeams = teamsByPerson.get(p.id) ?? []
    nodeById.set(p.id, {
      id: p.id,
      name: p.full_name,
      title: p.title,
      color: leaderColor.get(p.id) ?? myTeams[0]?.color ?? null,
      teams: myTeams,
      ledTeams: ledTeamsByLeader.get(p.id) ?? [],
      children: [],
    })
  }

  const sortOf = new Map(people.map(p => [p.id, p.sort_order]))
  const roots: OrgPerson[] = []
  for (const p of people) {
    const node = nodeById.get(p.id)!
    const parent = p.manager_id ? nodeById.get(p.manager_id) : null
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }

  // Stable ordering: sort_order then name, at every level.
  const sortNodes = (arr: OrgPerson[]) => {
    arr.sort((a, b) => (sortOf.get(a.id)! - sortOf.get(b.id)!) || a.name.localeCompare(b.name))
    arr.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)

  return { roots, total: people.length }
}
