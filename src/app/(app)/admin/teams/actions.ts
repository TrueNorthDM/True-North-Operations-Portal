'use server'

/**
 * Teams + membership + access-grant mutations (admin-only). Writes go through
 * the signed-in admin's session (RLS permits is_admin). Membership changes also
 * revalidate the home org chart (team chips).
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'
import { TOOL_KEYS, type ToolAudience } from '@/lib/access/tools'

export type GrantRole = 'manager' | 'publisher' | 'editor' | 'viewer'
export type TeamPosition = 'founder' | 'manager' | 'team_leader' | 'collaborator'
const TEAM_POSITIONS: TeamPosition[] = ['founder', 'manager', 'team_leader', 'collaborator']

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

// ── Teams ─────────────────────────────────────────────────────────────────
export async function createTeam(name: string, color?: string | null) {
  await requireAdmin()
  const n = name.trim()
  if (!n) throw new Error('Team name is required')
  const supabase = await createClient()
  const { error } = await supabase.from('teams').insert({ name: n, color: color || null })
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}

export async function updateTeam(id: string, input: { name?: string; color?: string | null }) {
  await requireAdmin()
  const patch: { name?: string; color?: string | null } = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (!n) throw new Error('Team name is required')
    patch.name = n
  }
  if (input.color !== undefined) patch.color = input.color || null
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
export async function addTeamMember(teamId: string, personId: string, position: TeamPosition = 'collaborator') {
  await requireAdmin()
  if (!TEAM_POSITIONS.includes(position)) throw new Error('Invalid position')
  const supabase = await createClient()
  const { error } = await supabase
    .from('team_members')
    .upsert({ team_id: teamId, person_id: personId, position }, { onConflict: 'team_id,person_id' })
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
  revalidatePath('/')
}

// Set a member's POSITION within a team (Team Leader ↔ Collaborator). The team's
// lead is whoever holds the team_leader position, there is no separate "make
// lead" any more.
export async function setTeamMemberPosition(teamId: string, personId: string, position: TeamPosition) {
  await requireAdmin()
  if (!TEAM_POSITIONS.includes(position)) throw new Error('Invalid position')
  const supabase = await createClient()
  const { error } = await supabase
    .from('team_members')
    .update({ position })
    .eq('team_id', teamId)
    .eq('person_id', personId)
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

// ── Tool/dashboard access (team → tool, with audience) ──────────────────────
// Which app tools a team can reach and for whom: the lead only ('lead') or all
// members ('all'). tool_key is validated against the code catalogue, not the DB.
export async function setTeamTool(teamId: string, toolKey: string, audience: ToolAudience) {
  await requireAdmin()
  if (!TOOL_KEYS.has(toolKey)) throw new Error('Unknown tool')
  if (audience !== 'lead' && audience !== 'all') throw new Error('Invalid audience')
  const supabase = await createClient()
  const { error } = await supabase
    .from('team_tool_grants')
    .upsert({ team_id: teamId, tool_key: toolKey, audience }, { onConflict: 'team_id,tool_key' })
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}

export async function removeTeamTool(teamId: string, toolKey: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('team_tool_grants')
    .delete()
    .eq('team_id', teamId)
    .eq('tool_key', toolKey)
  if (error) throw new Error(error.message)
  revalidatePath('/directory')
}
