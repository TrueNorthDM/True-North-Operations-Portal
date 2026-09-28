'use server'

/**
 * People directory mutations (admin-only). Writes go through the signed-in
 * admin's session, RLS (people_admin_write) permits is_admin(auth.uid()), so
 * no service role is needed. Every change revalidates the Directory AND the
 * home org chart, which reads the same directory.
 */

import { createClient } from '@/lib/supabase/server'
import { loadOwnContact } from '@/lib/hr/contact'
import { isSecurityAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { notifyLevelChange } from '@/lib/notifications/run'
import { endSessions } from '@/lib/auth/portal-access'
import type { PersonRow } from '@/lib/types/database.types'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'

type PersonCols = Partial<Omit<PersonRow, 'id' | 'created_at' | 'updated_at'>>

async function requireAdmin() {
  if (!(await isSecurityAdmin())) throw new Error('Not authorized')
}

/**
 * Tells admins and the person that a level changed (notification S4), after
 * the answer is sent: a save must not wait on, or fail because of, it.
 */
function levelChanged(personId: string, name: string, from: string | null | undefined, to: string, actorProfileId: string | null) {
  const was = from || 'user'
  if (was === to) return
  after(() => notifyLevelChange({ personId, name, from: was, to, actorProfileId }))
}

function revalidate() {
  revalidatePath('/directory')
  revalidatePath('/admin/people')
  revalidatePath('/admin/access-levels') // the access-levels board lists role_type
  revalidatePath('/') // home org chart reads the same directory
}

// Mirrors the CHECK constraint in migration 035.
const ROLE_TYPES: readonly string[] = ['user', 'admin', 'admin_assistant', 'team_leader']
const PRIVILEGED_TYPES: readonly string[] = ['admin', 'admin_assistant']

/** What setPersonRoleType actually managed to apply. */
export interface RoleTypeResult {
  /** 'live' = the security role was synced too; 'pending' = no account yet. */
  applied: 'live' | 'pending'
}

/**
 * Set a person's contact type (people.role_type), the portal access level.
 *
 * The portal keeps TWO role fields: people.role_type drives what the interface
 * shows, and profiles.role is the hard gate (RLS + isSecurityAdmin). Nothing
 * in the database syncs them (migration 038 was a one-time backfill, explicitly
 * not a login-time sync), so writing role_type alone produced levels that only
 * half worked: a promotion granted the admin VIEW but no admin POWER, and a
 * demotion did nothing at all, because getCurrentTier floors anyone whose
 * profiles.role is 'admin' back up to admin. This writes BOTH, so the level a
 * person is given is the level they get.
 *
 * profiles rows only exist after a first sign-in, so for someone who has never
 * logged in we save role_type and report 'pending'. Nothing else is needed: the
 * sign-up trigger (migration 050) reads the level and creates the profile with
 * the matching role, so the level applies by itself at first login.
 *
 * A focused counterpart to updatePerson, which needs the whole PersonInput and
 * would reset any field the caller omits.
 */
export async function setPersonRoleType(id: string, roleType: string): Promise<RoleTypeResult> {
  await requireAdmin()
  if (!ROLE_TYPES.includes(roleType)) throw new Error('Unknown access level')
  const privileged = PRIVILEGED_TYPES.includes(roleType)
  const supabase = await createClient()

  const { data: person } = await supabase
    .from('people')
    .select('id, full_name, role_type, profile_id, email_true_north, email_goodnews, email_coe')
    .eq('id', id)
    .maybeSingle()
  if (!person) throw new Error('Person not found')

  // Find their auth account: the explicit link if set, else a mailbox that
  // matches a profile. profile_id is only filled in by hand, so most people who
  // sign in daily are matched by email here.
  let profileId = person.profile_id as string | null
  if (!profileId) {
    // Personal mailbox via the privileged reader (migration 056); dropping it
    // from the match would leave anyone who signs in with their personal
    // address looking accountless.
    const personal = (await loadOwnContact(id)).emailPersonal
    const emails = [person.email_true_north, person.email_goodnews, person.email_coe, personal]
      .map(e => (e ?? '').trim().toLowerCase())
      .filter(Boolean)
    if (emails.length) {
      const { data: profileRows } = await supabase.from('profiles').select('id, email')
      profileId = (profileRows ?? []).find(p => emails.includes((p.email ?? '').trim().toLowerCase()))?.id ?? null
    }
  }

  // Never let an admin strip their own access, that would lock them out of the
  // very screen they'd need to undo it.
  const { data: { user } } = await supabase.auth.getUser()
  if (user && profileId === user.id && !privileged) {
    throw new Error('You cannot remove your own admin access. Ask another admin to do it.')
  }

  const patch: PersonCols = { role_type: roleType }
  // Repair the link while we're here, so the account shows as connected.
  if (!person.profile_id && profileId) patch.profile_id = profileId

  const { error } = await supabase.from('people').update(patch).eq('id', id)
  if (error) throw new Error(error.message)

  if (profileId) {
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: privileged ? 'admin' : 'viewer' })
      .eq('id', profileId)
    if (roleError) throw new Error(`Level saved, but the security role could not be updated: ${roleError.message}`)
  }

  levelChanged(id, person.full_name, person.role_type, roleType, user?.id ?? null)
  revalidate()
  return { applied: profileId ? 'live' : 'pending' }
}

export interface PersonInput {
  full_name: string
  title?: string | null
  manager_id?: string | null
  status?: 'active' | 'inactive'
  /** Portal account (profiles.id) to link, or null to unlink. Omit to leave as-is. */
  profile_id?: string | null

  // Directory fields (migration 029)
  employment_type?: string | null
  schedule?: string | null
  weekly_hours?: number | null
  internal_rate?: number | null
  reports_to_manager?: string | null
  also_reports_to_id?: string | null
  email_true_north?: string | null
  email_goodnews?: string | null
  email_coe?: string | null
  email_personal?: string | null
  phone?: string | null
  location?: string | null
  address?: PersonAddress | null
  onboarding_status?: string | null
  offboarding_status?: string | null
  date_of_birth?: string | null
  hire_date?: string | null
  left_on?: string | null
  employment_history?: string | null

  // HR fields brought over from the True North Team board (migration 033/034)
  last_name?: string | null
  manager_name_text?: string | null
  whatsapp_same_number?: string | null
  monday_docs?: string | null
  milestones?: PersonMilestone[] | null
  role_type?: string

  /**
   * The person's team memberships + POSITION in each (Team Leader / Collaborator,
   * migration 040). When passed, memberships are reconciled to exactly this list
   * (a person can belong to several teams with a different position in each).
   * Omit to leave as-is.
   */
  teams?: { teamId: string; position: string; primary?: boolean }[]
  /** When false, unlink any TSheets user. Omit / true leaves the link as-is. */
  tsheets?: boolean
}

/** Friendlier message for the one-account-per-person unique index. */
function mapError(message: string): string {
  if (/people_profile_id_unique/.test(message)) return 'That portal account is already linked to another person.'
  return message
}

const trimOrNull = (v: string | null | undefined) => (v == null ? null : v.trim() || null)

/** Build the `people` column patch from an input (excludes team membership). */
function personColumns(input: PersonInput): PersonCols {
  const cols: PersonCols = {
    title: trimOrNull(input.title),
    manager_id: input.manager_id || null,
    status: input.status || 'active',
    employment_type: input.employment_type || null,
    schedule: input.schedule || null,
    weekly_hours: input.weekly_hours ?? null,
    internal_rate: input.internal_rate ?? null,
    reports_to_manager: input.reports_to_manager || null,
    also_reports_to_id: input.also_reports_to_id || null,
    email_true_north: trimOrNull(input.email_true_north),
    email_goodnews: trimOrNull(input.email_goodnews),
    email_coe: trimOrNull(input.email_coe),
    email_personal: trimOrNull(input.email_personal),
    phone: trimOrNull(input.phone),
    location: trimOrNull(input.location),
    address: input.address ?? null,
    onboarding_status: input.onboarding_status || null,
    offboarding_status: input.offboarding_status || null,
    date_of_birth: input.date_of_birth || null,
    hire_date: input.hire_date || null,
    left_on: input.left_on || null,
    employment_history: trimOrNull(input.employment_history),
    last_name: trimOrNull(input.last_name),
    manager_name_text: trimOrNull(input.manager_name_text),
    whatsapp_same_number: input.whatsapp_same_number || null,
    monday_docs: trimOrNull(input.monday_docs),
    milestones: input.milestones ?? null,
    role_type: input.role_type || 'user',
  }
  return cols
}

/** Reconcile the person's memberships to exactly the given teams + positions,
 *  with exactly one marked as the primary department. */
async function setPersonTeams(supabase: Awaited<ReturnType<typeof createClient>>, personId: string, teams: { teamId: string; position: string; primary?: boolean }[]) {
  const { error: delErr } = await supabase.from('team_members').delete().eq('person_id', personId)
  if (delErr) throw new Error(delErr.message)
  // Dedupe by team (last wins) and normalise the position value.
  const norm = (pos: string) => (pos === 'founder' ? 'founder' : pos === 'manager' ? 'manager' : pos === 'team_leader' ? 'team_leader' : 'collaborator')
  const byTeam = new Map<string, { position: string; primary: boolean }>()
  for (const t of teams) if (t.teamId) byTeam.set(t.teamId, { position: norm(t.position), primary: !!t.primary })
  const entries = [...byTeam]
  // Guarantee exactly one primary: default to the first team if none chosen,
  // and keep only the first if somehow several were flagged.
  if (entries.length && !entries.some(([, v]) => v.primary)) entries[0][1].primary = true
  let primarySeen = false
  for (const [, v] of entries) {
    if (!v.primary) continue
    if (primarySeen) v.primary = false
    else primarySeen = true
  }
  const rows = entries.map(([team_id, v]) => ({ team_id, person_id: personId, position: v.position, is_primary: v.primary }))
  if (rows.length) {
    // is_primary is a late-added column (migration 048). Try with it; if the DB
    // doesn't have it yet, fall back to inserting without it.
    let insErr = (await supabase.from('team_members').insert(rows as never)).error
    if (insErr && /is_primary|column/i.test(insErr.message)) {
      const bare = rows.map(r => ({ team_id: r.team_id, person_id: r.person_id, position: r.position }))
      insErr = (await supabase.from('team_members').insert(bare)).error
    }
    if (insErr) throw new Error(insErr.message)
  }
}

export async function createPerson(input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  const supabase = await createClient()

  const row: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  if (input.profile_id !== undefined) row.profile_id = input.profile_id || null
  if (input.tsheets === false) row.tsheets_user_id = null

  const { data, error } = await supabase.from('people').insert(row).select('id').single()
  if (error) throw new Error(mapError(error.message))
  if (input.teams !== undefined && data?.id) await setPersonTeams(supabase, data.id, input.teams)
  revalidate()
}

// Would setting `id`'s primary manager to `newManagerId` create a reporting
// loop? Walk up from the proposed manager following existing manager links; if
// we come back to `id`, it's a cycle. The `seen` set also stops us looping on a
// pre-existing cycle elsewhere in the data. Guards the org chart's tree.
async function wouldCreateCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  newManagerId: string,
): Promise<boolean> {
  if (newManagerId === id) return true
  const { data } = await supabase.from('people').select('id, manager_id')
  const mgr = new Map((data ?? []).map((p: { id: string; manager_id: string | null }) => [p.id, p.manager_id]))
  const seen = new Set<string>([id])
  let cur: string | null = newManagerId
  while (cur) {
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = mgr.get(cur) ?? null
  }
  return false
}

export async function updatePerson(id: string, input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  if (input.manager_id === id) throw new Error('A person cannot report to themselves')
  const supabase = await createClient()
  if (input.manager_id && await wouldCreateCycle(supabase, id, input.manager_id)) {
    throw new Error('That reporting line would create a loop, the chosen manager already reports up to this person.')
  }

  const patch: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  // Only touch the account link when the caller passed it.
  if (input.profile_id !== undefined) patch.profile_id = input.profile_id || null
  if (input.tsheets === false) patch.tsheets_user_id = null

  const { data: before } = await supabase.from('people').select('role_type, status, profile_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('people').update(patch).eq('id', id)
  if (error) throw new Error(mapError(error.message))
  if (input.teams !== undefined) await setPersonTeams(supabase, id, input.teams)
  const { data: { user } } = await supabase.auth.getUser()
  const was = before as { role_type?: string | null; status?: string | null; profile_id?: string | null } | null
  levelChanged(id, name, was?.role_type, patch.role_type ?? 'user', user?.id ?? null)
  // Made inactive: their sessions end now, not when the token runs out. The
  // page gate (lib/auth/portal-access.ts) already refuses them on the next load.
  if (patch.status === 'inactive' && was?.status !== 'inactive') await endSessions(was?.profile_id)
  revalidate()
}

/** What inviting someone did, for the Directory to say. */
export interface InviteResult {
  /** The address they sign in with. */
  loginEmail: string
}

/**
 * Invite a person to the portal (migration 089): from now on they can sign in
 * with their GoodNews address. Only active people with a GoodNews address can be
 * invited; the address is the one they will use, one per person.
 *
 * Nothing is emailed yet. The Directory shows the address and the admin tells the
 * person; the invitation email arrives with the email service (plan step p4-code).
 */
export async function invitePerson(id: string): Promise<InviteResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: person, error: readErr } = await supabase
    .from('people').select('full_name, status, email_goodnews').eq('id', id).maybeSingle()
  if (readErr) throw new Error(readErr.message)
  const p = person as { full_name: string; status: string | null; email_goodnews: string | null } | null
  if (!p) throw new Error('Person not found')
  if (p.status === 'inactive') throw new Error(`${p.full_name} is inactive. Make them active before inviting them.`)
  const loginEmail = p.email_goodnews?.trim().toLowerCase() ?? ''
  if (!loginEmail.endsWith('@goodnewsadvocates.org')) {
    throw new Error(`${p.full_name} has no @goodnewsadvocates.org address in the Directory. Add it first: it is the address they sign in with.`)
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('people')
    .update({ portal_invited_at: new Date().toISOString(), portal_invited_by: user?.id ?? null } as PersonCols)
    .eq('id', id)
  if (error) throw new Error(mapError(error.message))
  revalidate()
  return { loginEmail }
}

/** Withdraw a person's invitation: they cannot sign in, and their sessions end now. */
export async function revokeInvite(id: string): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: before } = await supabase.from('people').select('profile_id').eq('id', id).maybeSingle()
  const { error } = await supabase
    .from('people')
    .update({ portal_invited_at: null, portal_invited_by: null } as PersonCols)
    .eq('id', id)
  if (error) throw new Error(mapError(error.message))
  await endSessions((before as { profile_id?: string | null } | null)?.profile_id)
  revalidate()
}

export async function deletePerson(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data: before } = await supabase.from('people').select('profile_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  // Removed from the Directory: no person, no access.
  await endSessions((before as { profile_id?: string | null } | null)?.profile_id)
  revalidate()
}
