'use server'

/**
 * People directory mutations (admin-only). Writes go through the signed-in
 * admin's session — RLS (people_admin_write) permits is_admin(auth.uid()), so
 * no service role is needed. Every change revalidates the People page AND the
 * home org chart, which reads the same directory.
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

function revalidate() {
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
}

/** Friendlier message for the one-account-per-person unique index. */
function mapError(message: string): string {
  if (/people_profile_id_unique/.test(message)) return 'That portal account is already linked to another person.'
  return message
}

export async function createPerson(input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  const supabase = await createClient()
  const { error } = await supabase.from('people').insert({
    full_name: name,
    title: input.title?.trim() || null,
    manager_id: input.manager_id || null,
    status: input.status || 'active',
    profile_id: input.profile_id || null,
  })
  if (error) throw new Error(mapError(error.message))
  revalidate()
}

export async function updatePerson(id: string, input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  if (input.manager_id === id) throw new Error('A person cannot report to themselves')
  const supabase = await createClient()
  const patch: { full_name: string; title: string | null; manager_id: string | null; status: 'active' | 'inactive'; profile_id?: string | null } = {
    full_name: name,
    title: input.title?.trim() || null,
    manager_id: input.manager_id || null,
    status: input.status || 'active',
  }
  // Only touch the account link when the caller passed it.
  if (input.profile_id !== undefined) patch.profile_id = input.profile_id || null
  const { error } = await supabase.from('people').update(patch).eq('id', id)
  if (error) throw new Error(mapError(error.message))
  revalidate()
}

export async function deletePerson(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
