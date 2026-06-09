// Admin → Access — the bird's-eye matrix of which teams can reach which
// projects, and the fast place to edit grants. Gated.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { AccessMatrix, type AccessCell } from '@/components/admin/AccessMatrix'

export default async function AccessPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const supabase = await createClient()

  const [{ data: tData }, { data: sData }, { data: gData }] = await Promise.all([
    supabase.from('teams').select('id, name'),
    supabase.from('sites').select('id, name, code'),
    supabase.from('grants').select('subject_type, subject_id, project_id, role'),
  ])

  const teams = ((tData ?? []) as unknown as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name))
  const projects = ((sData ?? []) as unknown as { id: string; name: string; code: string }[]).sort((a, b) => a.name.localeCompare(b.name))
  const grants = (gData ?? []) as unknown as { subject_type: string; subject_id: string; project_id: string; role: string }[]

  // (teamId|projectId) → role, team grants only
  const cells: AccessCell[] = grants
    .filter(g => g.subject_type === 'team')
    .map(g => ({ teamId: g.subject_id, projectId: g.project_id, role: g.role as AccessCell['role'] }))

  return (
    <AccessMatrix
      teams={teams}
      projects={projects.map(p => ({ id: p.id, name: p.name }))}
      cells={cells}
    />
  )
}
