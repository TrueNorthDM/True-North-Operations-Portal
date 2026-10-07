'use server'

/**
 * People directory mutations. Each is allowed by its own access item (Add and
 * edit people, Invite, Reset two-step), decided by the access rule. Writes go
 * through the signed-in person's session; RLS (people_admin_write) permits
 * is_admin(auth.uid()), which Super Admins and Admins hold. Every change
 * revalidates the Directory AND the home org chart, which reads the same
 * directory.
 *
 * A person's level is not set here (since 7 October 2026): Super Admin and
 * Admin are given on Admin > Access levels; Team Leader follows team
 * positions, so a change of teams here can move it, and that is logged.
 */

import { createClient } from '@/lib/supabase/server'
import { allowedTo } from '@/lib/access/resolve'
import { levelsOf, noteLevelShifts } from '@/lib/access/log'
import { revalidatePath } from 'next/cache'
import { endSessions } from '@/lib/auth/portal-access'
import { requestOrigin } from '@/lib/auth/origin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { normalPosition } from '@/lib/directory/people-types'
import { renderInvite } from '@/lib/email/invite'
import { sendEmail } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PersonRow } from '@/lib/types/database.types'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'

type PersonCols = Partial<Omit<PersonRow, 'id' | 'created_at' | 'updated_at'>>

async function requireAllowed(key: string) {
  if (!(await allowedTo(key))) throw new Error('Not authorized')
}

function revalidate() {
  revalidatePath('/directory')
  revalidatePath('/admin/people')
  revalidatePath('/admin/access-levels') // the access-levels board lists role_type
  revalidatePath('/') // home org chart reads the same directory
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
  }
  return cols
}

/** Reconcile the person's memberships to exactly the given teams + positions,
 *  with exactly one marked as the primary department. */
async function setPersonTeams(supabase: Awaited<ReturnType<typeof createClient>>, personId: string, teams: { teamId: string; position: string; primary?: boolean }[]) {
  const { error: delErr } = await supabase.from('team_members').delete().eq('person_id', personId)
  if (delErr) throw new Error(delErr.message)
  // Dedupe by team (last wins) and normalise the position value.
  const norm = (pos: string) => normalPosition(pos)
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
  await requireAllowed('d-edit')
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  const supabase = await createClient()

  const row: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  // The rate is Rates & Costs (d-rates): without it, a new person starts with none.
  if (!(await allowedTo('d-rates'))) row.internal_rate = null
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
  await requireAllowed('d-edit')
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  if (input.manager_id === id) throw new Error('A person cannot report to themselves')
  const supabase = await createClient()
  if (input.manager_id && await wouldCreateCycle(supabase, id, input.manager_id)) {
    throw new Error('That reporting line would create a loop, the chosen manager already reports up to this person.')
  }

  const patch: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  // The rate is Rates & Costs (d-rates). Without it the card never showed the
  // rate, so the save leaves it as it is instead of clearing it.
  if (input.internal_rate === undefined || !(await allowedTo('d-rates'))) delete patch.internal_rate
  // Only touch the account link when the caller passed it.
  if (input.profile_id !== undefined) patch.profile_id = input.profile_id || null
  if (input.tsheets === false) patch.tsheets_user_id = null

  const { data: before } = await supabase.from('people').select('status, profile_id').eq('id', id).maybeSingle()
  const levelsBefore = await levelsOf(createAdminClient(), [id])
  const { error } = await supabase.from('people').update(patch).eq('id', id)
  if (error) throw new Error(mapError(error.message))
  if (input.teams !== undefined) await setPersonTeams(supabase, id, input.teams)
  const { data: { user } } = await supabase.auth.getUser()
  const was = before as { status?: string | null; profile_id?: string | null } | null
  // Lead of a team or not decides Team Leader: a change of teams can move the level.
  const actor = user ? await loadCurrentPerson(supabase, user, { real: true }) : null
  await noteLevelShifts(createAdminClient(), levelsBefore, { personId: actor?.id ?? null, profileId: user?.id ?? null }, `Teams changed on ${name}'s card in the Directory.`)
  // Made inactive: their sessions end now, not when the token runs out. The
  // page gate (lib/auth/portal-access.ts) already refuses them on the next load.
  if (patch.status === 'inactive' && was?.status !== 'inactive') await endSessions(was?.profile_id)
  revalidate()
}

/** What inviting someone did, for the Directory to say. */
export interface InviteResult {
  /** The address they sign in with. */
  loginEmail: string
  /** Whether the invitation email went out; if not, why, so the admin can tell them. */
  emailed: boolean
  reason?: string
}

/**
 * Invite a person to the portal (migration 089), or send the invitation again:
 * from now on they can sign in with their GoodNews address, the only address that
 * can, one per person. Only active people with a GoodNews address can be invited.
 *
 * The portal emails the invitation itself (lib/email/invite.ts). It carries no
 * sign-in token, so it never expires: its button opens the sign-in page with the
 * address filled in. If the email cannot go out, the access is still granted and
 * the Directory says so, so the admin can tell the person another way.
 */
export async function invitePerson(id: string): Promise<InviteResult> {
  await requireAllowed('d-invite')
  const supabase = await createClient()
  const { data: person, error: readErr } = await supabase
    .from('people').select('full_name, status, email_goodnews, portal_invited_at').eq('id', id).maybeSingle()
  if (readErr) throw new Error(readErr.message)
  const p = person as { full_name: string; status: string | null; email_goodnews: string | null; portal_invited_at: string | null } | null
  if (!p) throw new Error('Person not found')
  if (p.status === 'inactive') throw new Error(`${p.full_name} is inactive. Make them active before inviting them.`)
  const loginEmail = p.email_goodnews?.trim().toLowerCase() ?? ''
  if (!loginEmail.endsWith('@goodnewsadvocates.org')) {
    throw new Error(`${p.full_name} has no @goodnewsadvocates.org address in the Directory. Add it first: it is the address they sign in with.`)
  }
  const { data: { user } } = await supabase.auth.getUser()
  // Sending again keeps the date of the first invitation.
  if (!p.portal_invited_at) {
    const { error } = await supabase
      .from('people')
      .update({ portal_invited_at: new Date().toISOString(), portal_invited_by: user?.id ?? null })
      .eq('id', id)
    if (error) throw new Error(mapError(error.message))
  }
  revalidate()

  const inviter = user ? await loadCurrentPerson(supabase, user, { real: true }) : null
  const origin = await requestOrigin()
  const mail = renderInvite({
    firstName: p.full_name.trim().split(/\s+/)[0] || p.full_name,
    invitedBy: inviter?.full_name ?? 'An admin at True North',
    email: loginEmail,
    url: `${origin}/login?email=${encodeURIComponent(loginEmail)}`,
    origin,
  })
  const sent = await sendEmail({ to: loginEmail, ...mail })
  return sent.sent ? { loginEmail, emailed: true } : { loginEmail, emailed: false, reason: sent.reason }
}

/** Withdraw a person's invitation: they cannot sign in, and their sessions end now. */
export async function revokeInvite(id: string): Promise<void> {
  await requireAllowed('d-invite')
  const supabase = await createClient()
  const { data: before } = await supabase.from('people').select('profile_id').eq('id', id).maybeSingle()
  const { error } = await supabase
    .from('people')
    .update({ portal_invited_at: null, portal_invited_by: null })
    .eq('id', id)
  if (error) throw new Error(mapError(error.message))
  await endSessions((before as { profile_id?: string | null } | null)?.profile_id)
  revalidate()
}

export async function deletePerson(id: string) {
  await requireAllowed('d-edit')
  const supabase = await createClient()
  const { data: before } = await supabase.from('people').select('profile_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  // Removed from the Directory: no person, no access.
  await endSessions((before as { profile_id?: string | null } | null)?.profile_id)
  revalidate()
}

/**
 * Reset a person's two-step sign-in (plan step p4-2fa): for a lost or replaced
 * phone. Their authenticator app is removed and their sessions end; at their next
 * sign-in they set it up again with a new QR code.
 */
export async function resetTwoStep(id: string): Promise<void> {
  await requireAllowed('d-2fa')
  const supabase = await createClient()
  const { data: row } = await supabase.from('people').select('profile_id').eq('id', id).maybeSingle()
  const profileId = (row as { profile_id?: string | null } | null)?.profile_id
  if (!profileId) throw new Error('This person has no account yet.')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: profileId })
  if (error) throw new Error(error.message)
  for (const f of data?.factors ?? []) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: profileId })
    if (delErr) throw new Error(delErr.message)
  }
  await endSessions(profileId)
  revalidate()
}
