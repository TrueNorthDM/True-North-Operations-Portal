/**
 * role.ts — read the signed-in user's profile/role, server-side.
 *
 * The profiles table + admin/viewer role came in with the merge (migration
 * 007). Used to gate the publishing-targets editor: admins edit, viewers read.
 */

import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/types/database.types'

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
