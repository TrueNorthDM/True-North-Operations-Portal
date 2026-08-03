'use server'

/**
 * Access levels matrix mutations (admin-only).
 *
 * Writes go through the signed-in admin's session; RLS
 * (access_level_pages_admin_write) permits is_admin(auth.uid()), so no service
 * role is involved. Every change revalidates the surfaces that read it: the
 * layout builds the sidebar from this, so it has to be the whole app.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { SURFACE_BY_KEY, CONFIGURABLE_ROLES } from '@/lib/access/surfaces'

export async function setSurfaceAllowed(roleType: string, surfaceKey: string, allowed: boolean) {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')

  if (!CONFIGURABLE_ROLES.includes(roleType as never)) throw new Error('Unknown access level')
  const surface = SURFACE_BY_KEY.get(surfaceKey)
  if (!surface) throw new Error('Unknown page')
  // Locked surfaces are structural, not policy: Home keeps the portal usable
  // and the Managing rows are what let an admin undo a mistake here.
  if (surface.locked) throw new Error('That row cannot be changed.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('access_level_pages')
    .upsert({ role_type: roleType, surface_key: surfaceKey, allowed }, { onConflict: 'role_type,surface_key' })
  if (error) throw new Error(error.message)

  // The sidebar is built in the root (app) layout, so every page's nav depends
  // on this. Revalidating the layout segment is the only correct scope.
  revalidatePath('/', 'layout')
}
