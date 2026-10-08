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
import { revalidatePath } from 'next/cache'
import { endSessions } from '@/lib/auth/portal-access'
import { requestOrigin } from '@/lib/auth/origin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { mapPersonError, setPersonTeams } from '@/lib/directory/person-writes'
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

export async function createPerson(input: PersonInput): Promise<{ id: string }> {
  await requireAllowed('d-edit')
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  // Privileged after the check above: "Add people" decides, not the database role.
  const supabase = createAdminClient()

  const row: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  // The rate is Rates & Costs (d-rates): without it, a new person starts with none.
  if (!(await allowedTo('d-rates'))) row.internal_rate = null
  if (input.profile_id !== undefined) row.profile_id = input.profile_id || null
  if (input.tsheets === false) row.tsheets_user_id = null

  const { data, error } = await supabase.from('people').insert(row).select('id').single()
  if (error) throw new Error(mapPersonError(error.message))
  if (input.teams !== undefined && data?.id) await setPersonTeams(supabase, data.id, input.teams)
  revalidate()
  return { id: (data as { id: string }).id }
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
    if (error) throw new Error(mapPersonError(error.message))
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
  if (error) throw new Error(mapPersonError(error.message))
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
