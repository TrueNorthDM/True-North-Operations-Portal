// Admin → Team detail. Gated. Two panels: members (add/remove) and access
// (project grants with a role). The core "who can access what" screen.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { TeamDetail } from '@/components/admin/TeamDetail'

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tData }, { data: pData }, { data: mData }, { data: gData }, { data: sData }] = await Promise.all([
    supabase.from('teams').select('id, name, leader_person_id').eq('id', id).maybeSingle(),
    supabase.from('people').select('id, full_name, status'),
    supabase.from('team_members').select('person_id').eq('team_id', id),
    supabase.from('grants').select('project_id, role').eq('subject_type', 'team').eq('subject_id', id),
    supabase.from('sites').select('id, name, code'),
  ])

  const team = tData as unknown as { id: string; name: string; leader_person_id: string | null } | null
  if (!team) notFound()

  const people = (pData ?? []) as unknown as { id: string; full_name: string; status: string }[]
  const memberIds = new Set(((mData ?? []) as unknown as { person_id: string }[]).map(m => m.person_id))
  const grants = (gData ?? []) as unknown as { project_id: string; role: string }[]
  const sites = (sData ?? []) as unknown as { id: string; name: string; code: string }[]

  const nameById = new Map(people.map(p => [p.id, p.full_name]))
  const grantedIds = new Set(grants.map(g => g.project_id))

  return (
    <TeamDetail
      team={{ id: team.id, name: team.name }}
      leaderName={team.leader_person_id ? nameById.get(team.leader_person_id) ?? null : null}
      members={people.filter(p => memberIds.has(p.id)).map(p => ({ id: p.id, name: p.full_name })).sort((a, b) => a.name.localeCompare(b.name))}
      addablePeople={people.filter(p => !memberIds.has(p.id)).map(p => ({ id: p.id, name: p.full_name })).sort((a, b) => a.name.localeCompare(b.name))}
      grantedProjects={grants.map(g => ({ projectId: g.project_id, name: sites.find(s => s.id === g.project_id)?.name ?? '—', role: g.role as 'admin' | 'member' | 'viewer' }))}
      availableProjects={sites.filter(s => !grantedIds.has(s.id)).map(s => ({ id: s.id, name: s.name }))}
    />
  )
}
