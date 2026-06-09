/**
 * org/data.ts — reads the People & Teams directory and builds the org chart
 * tree (by manager_id). Read-only; the chart redraws whenever the directory
 * changes. RLS lets any signed-in user read people/teams, so this works for
 * everyone (the chart is public to logged-in users).
 *
 * The directory tables (people/teams/team_members) aren't in the generated
 * Supabase types yet, so rows are typed + cast explicitly.
 */

import { createClient } from '@/lib/supabase/server'

export interface OrgPerson {
  id: string
  name: string
  title: string | null
  /** Signature color for the card/threads: the team they lead, else their first team. */
  color: string | null
  teams: { name: string; color: string | null }[]
  children: OrgPerson[]
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
  leader_person_id: string | null
}
interface MemberRow {
  team_id: string
  person_id: string
}

export async function getOrgChart(): Promise<{ roots: OrgPerson[]; total: number }> {
  const supabase = await createClient()

  const [{ data: pData }, { data: tData }, { data: mData }] = await Promise.all([
    supabase.from('people').select('id, full_name, title, manager_id, status, sort_order'),
    supabase.from('teams').select('id, name, color, leader_person_id'),
    supabase.from('team_members').select('team_id, person_id'),
  ])

  const people = (pData ?? []) as unknown as PersonRow[]
  const teams = (tData ?? []) as unknown as TeamRow[]
  const members = (mData ?? []) as unknown as MemberRow[]

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
  for (const t of teams) if (t.leader_person_id && t.color) leaderColor.set(t.leader_person_id, t.color)

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
