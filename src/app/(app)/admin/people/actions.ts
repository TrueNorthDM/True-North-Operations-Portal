'use server'

/**
 * People directory mutations (admin-only). Writes go through the signed-in
 * admin's session — RLS (people_admin_write) permits is_admin(auth.uid()), so
 * no service role is needed. Every change revalidates the Directory AND the
 * home org chart, which reads the same directory.
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'
import type { PersonRow } from '@/lib/types/database.types'

type PersonCols = Partial<Omit<PersonRow, 'id' | 'created_at' | 'updated_at'>>

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

function revalidate() {
  revalidatePath('/directory')
  revalidatePath('/admin/people')
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
  company_email?: string | null
  uses_system?: string | null
  date_of_birth?: string | null
  hire_date?: string | null
  left_on?: string | null
  employment_history?: string | null

  // HR fields brought over from the True North Team board (migration 033/034)
  last_name?: string | null
  team_meeting?: boolean
  manager_name_text?: string | null
  whatsapp_same_number?: string | null
  monday_docs?: string | null
  role_type?: string

  /**
   * The person's team memberships + POSITION in each (Team Leader / Collaborator,
   * migration 040). When passed, memberships are reconciled to exactly this list
   * (a person can belong to several teams with a different position in each).
   * Omit to leave as-is.
   */
  teams?: { teamId: string; position: string }[]
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
    company_email: input.company_email || null,
    uses_system: input.uses_system || null,
    date_of_birth: input.date_of_birth || null,
    hire_date: input.hire_date || null,
    left_on: input.left_on || null,
    employment_history: trimOrNull(input.employment_history),
    last_name: trimOrNull(input.last_name),
    team_meeting: input.team_meeting ?? false,
    manager_name_text: trimOrNull(input.manager_name_text),
    whatsapp_same_number: input.whatsapp_same_number || null,
    monday_docs: trimOrNull(input.monday_docs),
    role_type: input.role_type || 'user',
  }
  return cols
}

/** Reconcile the person's memberships to exactly the given teams + positions. */
async function setPersonTeams(supabase: Awaited<ReturnType<typeof createClient>>, personId: string, teams: { teamId: string; position: string }[]) {
  const { error: delErr } = await supabase.from('team_members').delete().eq('person_id', personId)
  if (delErr) throw new Error(delErr.message)
  // Dedupe by team (last wins) and normalise the position value.
  const norm = (pos: string) => (pos === 'founder' ? 'founder' : pos === 'team_leader' ? 'team_leader' : 'collaborator')
  const byTeam = new Map<string, string>()
  for (const t of teams) if (t.teamId) byTeam.set(t.teamId, norm(t.position))
  const rows = [...byTeam].map(([team_id, position]) => ({ team_id, person_id: personId, position }))
  if (rows.length) {
    const { error: insErr } = await supabase.from('team_members').insert(rows)
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

export async function updatePerson(id: string, input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  if (input.manager_id === id) throw new Error('A person cannot report to themselves')
  const supabase = await createClient()

  const patch: PersonCols & { full_name: string } = { full_name: name, ...personColumns(input) }
  // Only touch the account link when the caller passed it.
  if (input.profile_id !== undefined) patch.profile_id = input.profile_id || null
  if (input.tsheets === false) patch.tsheets_user_id = null

  const { error } = await supabase.from('people').update(patch).eq('id', id)
  if (error) throw new Error(mapError(error.message))
  if (input.teams !== undefined) await setPersonTeams(supabase, id, input.teams)
  revalidate()
}

export async function deletePerson(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
