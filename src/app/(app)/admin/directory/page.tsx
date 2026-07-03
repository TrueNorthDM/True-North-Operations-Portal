// Admin → Directory. The single surface for People · Teams · Access, all
// controlled from one page (with a TSheets-link indicator on People). Gated.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import type { PersonView } from '@/components/admin/PeopleManager'
import type { TeamManagerTeam } from '@/components/admin/TeamsManager'
import type { AccessCell } from '@/components/admin/AccessMatrix'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'

export default async function DirectoryPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const supabase = await createClient()

  const [
    { data: pData },
    { data: tData },
    { data: mData },
    { data: gData },
    { data: sData },
    { data: prData },
  ] = await Promise.all([
    supabase.from('people').select('id, full_name, title, manager_id, status, profile_id, tsheets_user_id'),
    supabase.from('teams').select('id, name, leader_person_id'),
    supabase.from('team_members').select('team_id, person_id'),
    supabase.from('grants').select('subject_type, subject_id, project_id, role'),
    supabase.from('sites').select('id, name, code'),
    supabase.from('profiles').select('id, email'),
  ])

  // grants isn't in the generated types → cast (same pattern as the old pages).
  const grants = (gData ?? []) as unknown as { subject_type: string; subject_id: string; project_id: string; role: string }[]

  const people = pData ?? []
  const teams = tData ?? []
  const members = mData ?? []
  const sites = sData ?? []
  const profiles = prData ?? []

  const nameById = new Map(people.map(p => [p.id, p.full_name]))
  const siteById = new Map(sites.map(s => [s.id, s.name]))
  const teamNameById = new Map(teams.map(t => [t.id, t.name]))

  // ── Accounts (for the People tab's account picker) ──
  const emailByProfile = new Map(profiles.map(pr => [pr.id, pr.email ?? '(no email)']))
  const linkedProfileIds = new Set(people.map(p => p.profile_id).filter((x): x is string => !!x))
  const availableAccounts = profiles
    .filter(pr => !linkedProfileIds.has(pr.id))
    .map(pr => ({ id: pr.id, email: pr.email ?? '(no email)' }))
    .sort((a, b) => a.email.localeCompare(b.email))

  // ── People view (with team chips + TSheets indicator) ──
  const teamsByPerson = new Map<string, string[]>()
  for (const m of members) {
    const tn = teamNameById.get(m.team_id)
    if (!tn) continue
    const arr = teamsByPerson.get(m.person_id) ?? []
    arr.push(tn)
    teamsByPerson.set(m.person_id, arr)
  }
  const peopleView: PersonView[] = people
    .map(p => ({
      id: p.id,
      full_name: p.full_name,
      title: p.title,
      manager_id: p.manager_id,
      managerName: p.manager_id ? nameById.get(p.manager_id) ?? null : null,
      status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      teams: teamsByPerson.get(p.id) ?? [],
      accountId: p.profile_id,
      accountEmail: p.profile_id ? emailByProfile.get(p.profile_id) ?? null : null,
      hasTsheets: p.tsheets_user_id != null,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // ── Teams view (full detail per team, for inline management) ──
  const membersByTeam = new Map<string, { id: string; name: string }[]>()
  for (const m of members) {
    const nm = nameById.get(m.person_id)
    if (!nm) continue
    const arr = membersByTeam.get(m.team_id) ?? []
    arr.push({ id: m.person_id, name: nm })
    membersByTeam.set(m.team_id, arr)
  }
  const grantsByTeam = new Map<string, { projectId: string; name: string; role: GrantRole }[]>()
  for (const g of grants) {
    if (g.subject_type !== 'team') continue
    const arr = grantsByTeam.get(g.subject_id) ?? []
    arr.push({ projectId: g.project_id, name: siteById.get(g.project_id) ?? '—', role: g.role as GrantRole })
    grantsByTeam.set(g.subject_id, arr)
  }
  const allPeopleNamed = people.map(p => ({ id: p.id, name: p.full_name })).sort((a, b) => a.name.localeCompare(b.name))

  const teamsView: TeamManagerTeam[] = teams
    .map(t => {
      const teamMembers = (membersByTeam.get(t.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const memberIds = new Set(teamMembers.map(m => m.id))
      const granted = grantsByTeam.get(t.id) ?? []
      const grantedIds = new Set(granted.map(g => g.projectId))
      return {
        id: t.id,
        name: t.name,
        leaderName: t.leader_person_id ? nameById.get(t.leader_person_id) ?? null : null,
        members: teamMembers,
        addablePeople: allPeopleNamed.filter(p => !memberIds.has(p.id)),
        grantedProjects: granted,
        availableProjects: sites.filter(s => !grantedIds.has(s.id)).map(s => ({ id: s.id, name: s.name })),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Access matrix ──
  const accessTeams = teams.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))
  const accessProjects = sites.map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
  const accessCells: AccessCell[] = grants
    .filter(g => g.subject_type === 'team')
    .map(g => ({ teamId: g.subject_id, projectId: g.project_id, role: g.role as GrantRole }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <span>Directory</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Directory</h1>
        <p className="mt-1 text-sm text-slate-500">
          People, teams, and who can access what — all in one place. Edits drive the org chart and access control.
        </p>
      </div>

      <DirectoryTabs
        people={peopleView}
        availableAccounts={availableAccounts}
        teams={teamsView}
        accessTeams={accessTeams}
        accessProjects={accessProjects}
        accessCells={accessCells}
      />
    </div>
  )
}
