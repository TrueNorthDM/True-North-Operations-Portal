'use server'

/**
 * People directory mutations (admin-only). Writes go through the signed-in
 * admin's session — RLS (people_admin_write) permits is_admin(auth.uid()), so
 * no service role is needed. Every change revalidates the People page AND the
 * home org chart, which reads the same directory.
 *
 * The `people` table isn't in the generated Supabase types yet, so the client
 * is cast for the writes (same pattern as the directory reads).
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
}

export async function createPerson(input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('people').insert({
    full_name: name,
    title: input.title?.trim() || null,
    manager_id: input.manager_id || null,
    status: input.status || 'active',
  })
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updatePerson(id: string, input: PersonInput) {
  await requireAdmin()
  const name = input.full_name.trim()
  if (!name) throw new Error('Name is required')
  if (input.manager_id === id) throw new Error('A person cannot report to themselves')
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('people')
    .update({
      full_name: name,
      title: input.title?.trim() || null,
      manager_id: input.manager_id || null,
      status: input.status || 'active',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function deletePerson(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
