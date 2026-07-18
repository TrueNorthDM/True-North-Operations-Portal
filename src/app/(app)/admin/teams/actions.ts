'use server'

/**
 * Teams + membership + access-grant mutations (admin-only). Writes go through
 * the signed-in admin's session (RLS permits is_admin). Membership changes also
 * revalidate the home org chart (team chips).
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'

export type GrantRole = 'manager' | 'publisher' | 'editor' | 'viewer'

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

// ── Teams ─────────────────────────────────────────────────────────────────
export async function createTeam(name: string) {
  await requireAdmin()
  const n = name.trim()
  if (!n) throw new Error('Team name is required')
  const supabase = await createClient()
  const { error } = await supabase.from('teams').insert({ name: n })
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}

export async function updateTeam(id: string, input: { name?: string; leader_person_id?: string | null }) {
  await requireAdmin()
  const patch: { name?: string; leader_person_id?: string | null } = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (!n) throw new Error('Team name is required')
    patch.name = n
  }
  if (input.leader_person_id !== undefined) patch.leader_person_id = input.leader_person_id || null
  const supabase = await createClient()
  const { error } = await supabase.from('teams').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}

export async function deleteTeam(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
  revalidatePath('/') // org chart team chips
}

// ── Membership ──────────────────────────────────────────────────────────────
export async function addTeamMember(teamId: string, personId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('team_members').insert({ team_id: teamId, person_id: personId })
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
  revalidatePath('/')
}

export async function removeTeamMember(teamId: string, personId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('person_id', personId)
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
  revalidatePath('/')
}

// ── Access grants (subject = team) ──────────────────────────────────────────
export async function setTeamGrant(teamId: string, projectId: string, role: GrantRole) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('grants')
    .upsert(
      { subject_type: 'team', subject_id: teamId, project_id: projectId, role },
      { onConflict: 'subject_type,subject_id,project_id' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}

export async function removeTeamGrant(teamId: string, projectId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('grants')
    .delete()
    .eq('subject_type', 'team')
    .eq('subject_id', teamId)
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}
