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
  /** Signature color for the card/threads: the team they lead, else their primary team. */
  color: string | null
  teams: { name: string; color: string | null }[]
  /** Teams this person leads, rendered as a box of members under them. */
  ledTeams: OrgTeamGroup[]
  /** Secondary manager (also_reports_to_id), drawn as a dotted line, not the tree. */
  secondaryManagerId: string | null
  /** Name of the person's primary team, used to group stacked collaborators by team. */
  primaryTeamName: string | null
  /** People who are on a team this person leads but whose home is elsewhere,
   *  shown as lighter "also on this team" cards under this leader. */
  ghosts: OrgGhost[]
  children: OrgPerson[]
}

/** A borrowed team member: same person as a solid card elsewhere, shown lighter. */
export interface OrgGhost {
  id: string
  name: string
  title: string | null
  color: string | null
  onTeamName: string
  onTeamColor: string | null
  primaryTeamName: string | null
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
  also_reports_to_id: string | null
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
  position: string // 'founder' | 'manager' | 'team_leader' | 'collaborator'
  is_primary: boolean // migration 048: the person's main department
}

export async function getOrgChart(): Promise<{ roots: OrgPerson[]; total: number }> {
  const supabase = await createClient()

  // also_reports_to_id is a late-added column; select it in an isolated query so
  // a pre-migration DB still returns the base people list.
  let pData: PersonRow[] | null = null
  {
    const full = await supabase.from('people').select('id, full_name, title, manager_id, also_reports_to_id, status, sort_order')
    if (full.error) {
      const base = await supabase.from('people').select('id, full_name, title, manager_id, status, sort_order')
      pData = (base.data ?? []).map(p => ({ ...(p as Omit<PersonRow, 'also_reports_to_id'>), also_reports_to_id: null }))
    } else {
      pData = full.data as unknown as PersonRow[]
    }
  }
  const { data: tData } = await supabase.from('teams').select('id, name, color')
  // team_members + per-team position (040) + is_primary (048); graceful pre-migration.
  // Cast through a loose type because is_primary isn't in the generated DB types.
  type TmRow = { team_id: string; person_id: string; position?: string; is_primary?: boolean }
  let tmData: TmRow[] = []
  {
    const withPrimary = await supabase.from('team_members').select('team_id, person_id, position, is_primary')
    if (!withPrimary.error) tmData = withPrimary.data as unknown as TmRow[]
    else {
      const withPos = await supabase.from('team_members').select('team_id, person_id, position')
      if (!withPos.error) tmData = withPos.data as unknown as TmRow[]
      else tmData = ((await supabase.from('team_members').select('team_id, person_id')).data ?? []) as unknown as TmRow[]
    }
  }

  // Inactive people are hidden everywhere outside the People tab, the org chart
  // (and its "N people" count) shows actives only.
  const people: PersonRow[] = (pData ?? []).filter(p => p.status !== 'inactive')
  const teams: TeamRow[] = tData ?? []
  const members: MemberRow[] = tmData.map((m) => ({
    team_id: m.team_id,
    person_id: m.person_id,
    position: m.position === 'founder' ? 'founder' : m.position === 'manager' ? 'manager' : m.position === 'team_leader' ? 'team_leader' : 'collaborator',
    is_primary: m.is_primary === true,
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
    if (m.position !== 'team_leader' && m.position !== 'founder' && m.position !== 'manager') continue
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
    if (m.position !== 'team_leader' && m.position !== 'founder' && m.position !== 'manager') continue
    const t = teamById.get(m.team_id)
    if (!t) continue
    const arr = ledTeamsByLeader.get(m.person_id) ?? []
    arr.push({ name: t.name, color: t.color, members: membersByTeam.get(t.id) ?? [] })
    ledTeamsByLeader.set(m.person_id, arr)
  }

  // Signature color prefers the team they lead, then their PRIMARY team
  // (migration 048), then any team. Falls back to alphabetical-first while the
  // is_primary column/backfill isn't in place yet.
  const primaryColorByPerson = new Map<string, string | null>()
  const primaryNameByPerson = new Map<string, string>()
  for (const m of members) {
    if (!m.is_primary) continue
    const t = teamById.get(m.team_id)
    if (t) { primaryColorByPerson.set(m.person_id, t.color); primaryNameByPerson.set(m.person_id, t.name) }
  }

  // Build nodes, then wire children by the PRIMARY manager (manager_id).
  const nodeById = new Map<string, OrgPerson>()
  for (const p of people) {
    const myTeams = teamsByPerson.get(p.id) ?? []
    nodeById.set(p.id, {
      id: p.id,
      name: p.full_name,
      title: p.title,
      color: leaderColor.get(p.id) ?? primaryColorByPerson.get(p.id) ?? myTeams[0]?.color ?? null,
      teams: myTeams,
      ledTeams: ledTeamsByLeader.get(p.id) ?? [],
      secondaryManagerId: p.also_reports_to_id ?? null,
      primaryTeamName: primaryNameByPerson.get(p.id) ?? myTeams[0]?.name ?? null,
      ghosts: [],
      children: [],
    })
  }

  // Team membership overlay: for each team, find its leader (highest-ranked
  // "leads" position) and attach every OTHER member whose home team is elsewhere
  // as a ghost, so a person on several teams appears (lighter) under each team.
  const membersByTeamId = new Map<string, typeof members>()
  for (const m of members) {
    const arr = membersByTeamId.get(m.team_id) ?? []
    arr.push(m)
    membersByTeamId.set(m.team_id, arr)
  }
  const posRank = (pos: string) => (pos === 'founder' ? 0 : pos === 'manager' ? 1 : pos === 'team_leader' ? 2 : 3)
  for (const [teamId, mem] of membersByTeamId) {
    const t = teamById.get(teamId)
    if (!t) continue
    const leaders = mem.filter(m => m.position === 'founder' || m.position === 'manager' || m.position === 'team_leader').sort((a, b) => posRank(a.position) - posRank(b.position))
    const leaderId = leaders[0]?.person_id
    if (!leaderId) continue
    const leaderNode = nodeById.get(leaderId)
    if (!leaderNode) continue
    for (const m of mem) {
      if (m.person_id === leaderId) continue
      const mn = nodeById.get(m.person_id)
      if (!mn) continue                      // inactive, skip
      if (mn.primaryTeamName === t.name) continue // home member, already solid in their own spot
      leaderNode.ghosts.push({ id: mn.id, name: mn.name, title: mn.title, color: mn.color, onTeamName: t.name, onTeamColor: t.color, primaryTeamName: mn.primaryTeamName })
    }
  }

  // Effective manager = the primary manager, but only if it exists among active
  // people. Then BREAK CYCLES: if following manager links loops (A → B → A, or
  // longer), sever the link at the first repeat so that person becomes a root
  // instead of the whole loop (and everyone under it) vanishing from the chart.
  const effManager = new Map<string, string | null>()
  for (const p of people) effManager.set(p.id, p.manager_id && nodeById.has(p.manager_id) ? p.manager_id : null)
  for (const p of people) {
    const seen = new Set<string>()
    let cur: string | null = p.id
    while (cur) {
      if (seen.has(cur)) { effManager.set(cur, null); break }
      seen.add(cur)
      cur = effManager.get(cur) ?? null
    }
  }

  const sortOf = new Map(people.map(p => [p.id, p.sort_order]))
  const roots: OrgPerson[] = []
  for (const p of people) {
    const node = nodeById.get(p.id)!
    const mgr = effManager.get(p.id)
    const parent = mgr ? nodeById.get(mgr) : null
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
