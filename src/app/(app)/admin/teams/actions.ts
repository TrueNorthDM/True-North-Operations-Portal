'use server'

/**
 * Teams and membership (the access item "Add and edit people, teams and
 * positions"). Writes go through the signed-in person's session (RLS permits
 * is_admin). Membership changes also revalidate the home org chart.
 *
 * Positions are Lead or Member (7 October 2026). Being Lead of any team makes
 * someone a Team Leader, so a change here can move a level: noteLevelShifts
 * logs it in the access change log and tells the person. Which teams may use a
 * tool is no longer set per team: it is on the tool, on Admin > Access levels.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedTo } from '@/lib/access/resolve'
import { levelsOf, noteLevelShifts } from '@/lib/access/log'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { revalidatePath } from 'next/cache'

export type GrantRole = 'manager' | 'publisher' | 'editor' | 'viewer'
export type TeamPosition = 'lead' | 'member'
const TEAM_POSITIONS: TeamPosition[] = ['lead', 'member']

/** After a membership change: log and notify any level it moved. */
async function afterMembership(before: Awaited<ReturnType<typeof levelsOf>>, what: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const actor = user ? await loadCurrentPerson(supabase, user, { real: true }) : null
  await noteLevelShifts(createAdminClient(), before, { personId: actor?.id ?? null, profileId: user?.id ?? null }, what)
}
const teamName = async (teamId: string) =>
  ((await createAdminClient().from('teams').select('name').eq('id', teamId).maybeSingle()).data as { name: string } | null)?.name ?? 'a team'

async function requireAdmin() {
  if (!(await allowedTo('d-edit'))) throw new Error('Not authorized')
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
  const { data: members } = await supabase.from('team_members').select('person_id').eq('team_id', id)
  const before = await levelsOf(createAdminClient(), ((members ?? []) as { person_id: string }[]).map(m => m.person_id))
  const name = await teamName(id)
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await afterMembership(before, `The team ${name} was deleted.`)
  revalidatePath('/directory')
  revalidatePath('/') // org chart team chips
}

// ── Membership ──────────────────────────────────────────────────────────────
export async function addTeamMember(teamId: string, personId: string, position: TeamPosition = 'member') {
  await requireAdmin()
  if (!TEAM_POSITIONS.includes(position)) throw new Error('Invalid position')
  const supabase = await createClient()
  const before = await levelsOf(createAdminClient(), [personId])
  const { error } = await supabase
    .from('team_members')
    .upsert({ team_id: teamId, person_id: personId, position }, { onConflict: 'team_id,person_id' })
  if (error) throw new Error(error.message)
  await afterMembership(before, `Added to ${await teamName(teamId)} as ${position === 'lead' ? 'Lead' : 'Member'} on the Directory's Teams tab.`)
  revalidatePath('/directory')
  revalidatePath('/')
}

// Set a member's POSITION within a team (Lead or Member).
export async function setTeamMemberPosition(teamId: string, personId: string, position: TeamPosition) {
  await requireAdmin()
  if (!TEAM_POSITIONS.includes(position)) throw new Error('Invalid position')
  const supabase = await createClient()
  const before = await levelsOf(createAdminClient(), [personId])
  const { error } = await supabase
    .from('team_members')
    .update({ position })
    .eq('team_id', teamId)
    .eq('person_id', personId)
  if (error) throw new Error(error.message)
  await afterMembership(before, `Made ${position === 'lead' ? 'Lead' : 'Member'} of ${await teamName(teamId)} on the Directory's Teams tab.`)
  revalidatePath('/directory')
  revalidatePath('/')
}

export async function removeTeamMember(teamId: string, personId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const before = await levelsOf(createAdminClient(), [personId])
  const name = await teamName(teamId)
  const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('person_id', personId)
  if (error) throw new Error(error.message)
  await afterMembership(before, `Removed from ${name} on the Directory's Teams tab.`)
  revalidatePath('/directory')
  revalidatePath('/')
}
