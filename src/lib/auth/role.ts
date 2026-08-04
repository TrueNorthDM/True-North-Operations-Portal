/**
 * role.ts: who the signed-in user is, server-side.
 *
 * The portal answers "is this person an admin?" from two different columns, and
 * the two questions are not the same one:
 *
 *   isSecurityAdmin()          reads profiles.role. This is the SECURITY ROLE:
 *                              the same column RLS checks (is_admin()), so it
 *                              decides whether a write actually lands. Use it
 *                              to gate mutations and the /admin area.
 *
 *   getCurrentTier()           reads people.role_type. This is the ACCESS
 *                              LEVEL, the thing an admin sets on Admin →
 *                              Access levels and the thing the screens are
 *                              built from. Use it to decide what to RENDER.
 *
 * They are kept in step (setPersonRoleType writes both; the sign-up trigger
 * applies the level at first login; the Access levels board flags any drift as
 * "Out of sync"). Naming them apart is what keeps a caller from reaching for
 * the rendering answer when it needs the writing one.
 */

import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { tierOf, type Tier } from '@/lib/auth/tier'
import { getViewAs } from '@/lib/auth/view-as-server'

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data ?? null
}

/**
 * The security role: does the database consider this user an admin? Gate writes
 * and the /admin area on this, not on the rendered access level.
 */
export async function isSecurityAdmin(): Promise<boolean> {
  // The database decides first, always. This used to read the previewed role
  // before asking, which meant a signed token could GRANT what profiles.role
  // withheld, and previewing as Admin Assistant kept every admin write gate
  // open. A token may now only take powers away, never hand them out.
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') return false

  // Previewing a lower tier drops admin-ness, so the preview stays honest.
  const vs = await getViewAs()
  return vs ? vs.role === 'admin' : true
}

/**
 * The access level, from people.role_type, which is what the screens render
 * from. Safety net: a real security admin is always privileged, even if their
 * account is not linked to a directory person yet, so nobody holding the hard
 * gate is locked into the restricted UI by a missing link.
 */
export async function getCurrentTier(): Promise<Tier> {
  // View Stage: while impersonating, the tier IS the impersonated role.
  const vs = await getViewAs()
  if (vs) return tierOf(vs.role)
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
