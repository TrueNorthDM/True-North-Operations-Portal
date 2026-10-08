/**
 * role.ts: the signed-in user's security profile (profiles.role, the column the
 * database's row-level policies check through is_admin()).
 *
 * Since 7 October 2026 nothing in the app decides access from it: the access
 * rule does (lib/access/resolve.ts: loadAccess, allowedTo, requireSurface).
 * profiles.role only follows the given levels (Super Admin and Admin are
 * 'admin') so the database's policies stay in step.
 */

import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/types/database.types'

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  // Two-step sign-in (p4-2fa): an account with an authenticator app set up is
  // not trusted for writes until this session has given the app's code. The
  // page gate already sends such a session to /auth/two-step; this closes the
  // same door for server actions called directly.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  // role is 'admin' or 'viewer' by the column's CHECK constraint.
  return (data as ProfileRow | null) ?? null
}
