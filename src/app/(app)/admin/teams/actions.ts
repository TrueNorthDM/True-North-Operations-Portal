'use server'

/**
 * Teams and membership (the access item "Teams and positions", Super Admin
 * only). Written with the privileged client after that check, and every action
 * returns its result: a thrown message never reaches the screen in production
 * (audit, 8 October 2026). Membership changes also revalidate the home org chart.
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

export type TeamResult = { ok: true } | { ok: false; error: string }
const fail = (error: string): TeamResult => ({ ok: false, error })
const OK: TeamResult = { ok: true }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Teams and positions are Super Admin only (d-positions): leading a team opens its tools. */
async function mayChangeTeams() { return allowedTo('d-positions') }
const NOT_ALLOWED = 'Only a Super Admin changes teams and positions.'

// ── Teams ─────────────────────────────────────────────────────────────────
export async function createTeam(name: string, color?: string | null): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  const n = typeof name === 'string' ? name.trim() : ''
  if (!n) return fail('The team needs a name.')
  const { error } = await createAdminClient().from('teams').insert({ name: n, color: color || null })
  if (error) return fail(/duplicate|unique/i.test(error.message) ? `There is already a team called ${n}.` : 'The team could not be created. Try again.')
  revalidatePath('/directory', 'layout')
  return OK
}

export async function updateTeam(id: string, input: { name?: string; color?: string | null }): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That team no longer exists.')
  const patch: { name?: string; color?: string | null } = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (!n) return fail('The team needs a name.')
    patch.name = n
  }
  if (input.color !== undefined) patch.color = input.color || null
  const { error, count } = await createAdminClient().from('teams').update(patch, { count: 'exact' }).eq('id', id)
  if (error) return fail(/duplicate|unique/i.test(error.message) ? 'There is already a team with that name.' : 'The team could not be saved. Try again.')
  if (!count) return fail('That team no longer exists.')
  revalidatePath('/directory', 'layout')
  revalidatePath('/') // org chart team chips and colours
  return OK
}

export async function deleteTeam(id: string): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That team no longer exists.')
  const db = createAdminClient()
  const { data: members } = await db.from('team_members').select('person_id').eq('team_id', id)
  const before = await levelsOf(db, ((members ?? []) as { person_id: string }[]).map(m => m.person_id))
  const name = await teamName(id)
  const { error, count } = await db.from('teams').delete({ count: 'exact' }).eq('id', id)
  if (error) return fail('The team could not be deleted. Try again.')
  if (!count) return fail('That team no longer exists.')
  await afterMembership(before, `The team ${name} was deleted.`)
  revalidatePath('/directory', 'layout')
  revalidatePath('/') // org chart team chips
  return OK
}

// ── Membership ──────────────────────────────────────────────────────────────
export async function addTeamMember(teamId: string, personId: string, position: TeamPosition = 'member'): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  if (!TEAM_POSITIONS.includes(position)) return fail('Choose Lead or Member.')
  if (!UUID.test(teamId) || !UUID.test(personId)) return fail('That team or person no longer exists.')
  const db = createAdminClient()
  const before = await levelsOf(db, [personId])
  const { error } = await db
    .from('team_members')
    .upsert({ team_id: teamId, person_id: personId, position }, { onConflict: 'team_id,person_id' })
  if (error) return fail('They could not be added to the team. Try again.')
  await afterMembership(before, `Added to ${await teamName(teamId)} as ${position === 'lead' ? 'Lead' : 'Member'} on the Directory's Teams tab.`)
  revalidatePath('/directory', 'layout')
  revalidatePath('/')
  return OK
}

// Set a member's POSITION within a team (Lead or Member).
export async function setTeamMemberPosition(teamId: string, personId: string, position: TeamPosition): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  if (!TEAM_POSITIONS.includes(position)) return fail('Choose Lead or Member.')
  const db = createAdminClient()
  const before = await levelsOf(db, [personId])
  const { error, count } = await db
    .from('team_members')
    .update({ position }, { count: 'exact' })
    .eq('team_id', teamId)
    .eq('person_id', personId)
  if (error) return fail('The position could not be changed. Try again.')
  if (!count) return fail('They are no longer on that team.')
  await afterMembership(before, `Made ${position === 'lead' ? 'Lead' : 'Member'} of ${await teamName(teamId)} on the Directory's Teams tab.`)
  revalidatePath('/directory', 'layout')
  revalidatePath('/')
  return OK
}

export async function removeTeamMember(teamId: string, personId: string): Promise<TeamResult> {
  if (!(await mayChangeTeams())) return fail(NOT_ALLOWED)
  const db = createAdminClient()
  const before = await levelsOf(db, [personId])
  const name = await teamName(teamId)
  const { error } = await db.from('team_members').delete().eq('team_id', teamId).eq('person_id', personId)
  if (error) return fail('They could not be removed from the team. Try again.')
  await afterMembership(before, `Removed from ${name} on the Directory's Teams tab.`)
  revalidatePath('/directory', 'layout')
  revalidatePath('/')
  return OK
}
