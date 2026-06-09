// Admin → Teams (list). Gated. Shows each team with its leader, member count
// and granted projects; opens the detail to manage members + access.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { TeamsList, type TeamView } from '@/components/admin/TeamsList'

export default async function TeamsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const supabase = await createClient()

  const [{ data: tData }, { data: pData }, { data: mData }, { data: gData }, { data: sData }] = await Promise.all([
    supabase.from('teams').select('id, name, leader_person_id, sort_order'),
    supabase.from('people').select('id, full_name'),
    supabase.from('team_members').select('team_id'),
    supabase.from('grants').select('subject_type, subject_id, project_id, role'),
    supabase.from('sites').select('id, name, code'),
  ])

  const teams = (tData ?? []) as unknown as { id: string; name: string; leader_person_id: string | null; sort_order: number }[]
  const people = (pData ?? []) as unknown as { id: string; full_name: string }[]
  const members = (mData ?? []) as unknown as { team_id: string }[]
  const grants = (gData ?? []) as unknown as { subject_type: string; subject_id: string; project_id: string; role: string }[]
  const sites = (sData ?? []) as unknown as { id: string; name: string; code: string }[]

  const nameById = new Map(people.map(p => [p.id, p.full_name]))
  const siteById = new Map(sites.map(s => [s.id, s.name]))
  const memberCount = new Map<string, number>()
  for (const m of members) memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1)
  const projectsByTeam = new Map<string, { name: string; role: string }[]>()
  for (const g of grants) {
    if (g.subject_type !== 'team') continue
    const arr = projectsByTeam.get(g.subject_id) ?? []
    arr.push({ name: siteById.get(g.project_id) ?? '—', role: g.role })
    projectsByTeam.set(g.subject_id, arr)
  }

  const rows: TeamView[] = teams
    .map(t => ({
      id: t.id,
      name: t.name,
      leaderName: t.leader_person_id ? nameById.get(t.leader_person_id) ?? null : null,
      memberCount: memberCount.get(t.id) ?? 0,
      projects: projectsByTeam.get(t.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return <TeamsList teams={rows} />
}
