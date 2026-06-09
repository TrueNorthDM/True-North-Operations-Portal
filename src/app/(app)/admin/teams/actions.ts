'use server'

/**
 * Teams + membership + access-grant mutations (admin-only). Writes go through
 * the signed-in admin's session (RLS permits is_admin). Membership changes also
 * revalidate the home org chart (team chips). The directory/grants tables
 * aren't in the generated types, so the client is cast for writes.
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'

export type GrantRole = 'admin' | 'member' | 'viewer'

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db(): Promise<any> {
  return await createClient()
}

// ── Teams ─────────────────────────────────────────────────────────────────
export async function createTeam(name: string) {
  await requireAdmin()
  const n = name.trim()
  if (!n) throw new Error('Team name is required')
  const { error } = await (await db()).from('teams').insert({ name: n })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
}

export async function updateTeam(id: string, input: { name?: string; leader_person_id?: string | null }) {
  await requireAdmin()
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (!n) throw new Error('Team name is required')
    patch.name = n
  }
  if (input.leader_person_id !== undefined) patch.leader_person_id = input.leader_person_id || null
  const { error } = await (await db()).from('teams').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
  revalidatePath(`/admin/teams/${id}`)
}

export async function deleteTeam(id: string) {
  await requireAdmin()
  const { error } = await (await db()).from('teams').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/teams')
  revalidatePath('/') // org chart team chips
}

// ── Membership ──────────────────────────────────────────────────────────────
export async function addTeamMember(teamId: string, personId: string) {
  await requireAdmin()
  const { error } = await (await db()).from('team_members').insert({ team_id: teamId, person_id: personId })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/teams/${teamId}`)
  revalidatePath('/')
}

export async function removeTeamMember(teamId: string, personId: string) {
  await requireAdmin()
  const { error } = await (await db()).from('team_members').delete().eq('team_id', teamId).eq('person_id', personId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/teams/${teamId}`)
  revalidatePath('/')
}

// ── Access grants (subject = team) ──────────────────────────────────────────
export async function setTeamGrant(teamId: string, projectId: string, role: GrantRole) {
  await requireAdmin()
  const { error } = await (await db())
    .from('grants')
    .upsert(
      { subject_type: 'team', subject_id: teamId, project_id: projectId, role },
      { onConflict: 'subject_type,subject_id,project_id' },
    )
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/teams/${teamId}`)
}

export async function removeTeamGrant(teamId: string, projectId: string) {
  await requireAdmin()
  const { error } = await (await db())
    .from('grants')
    .delete()
    .eq('subject_type', 'team')
    .eq('subject_id', teamId)
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/teams/${teamId}`)
}
