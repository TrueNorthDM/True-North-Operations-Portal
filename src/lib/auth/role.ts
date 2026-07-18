/**
 * role.ts — read the signed-in user's profile/role, server-side.
 *
 * The profiles table + admin/viewer role came in with the merge (migration
 * 007). Used to gate the publishing-targets editor: admins edit, viewers read.
 */

import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { tierOf, type Tier } from '@/lib/auth/tier'

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data ?? null
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile()
  return profile?.role === 'admin'
}

/**
 * The signed-in user's access tier (Part 4), from people.role_type. Safety net:
 * a real portal admin (profiles.role = 'admin') is always privileged, even if
 * their account isn't linked to a directory person yet — so nobody with the
 * hard admin gate is ever locked into the restricted UI by a missing link.
 */
export async function getCurrentTier(): Promise<Tier> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [me, { data: profile }] = await Promise.all([
    loadCurrentPerson(supabase, user),
    user ? supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  let roleType = me?.roleType ?? 'user'
  if (profile?.role === 'admin' && roleType !== 'admin' && roleType !== 'admin_assistant') roleType = 'admin'
  return tierOf(roleType)
}
