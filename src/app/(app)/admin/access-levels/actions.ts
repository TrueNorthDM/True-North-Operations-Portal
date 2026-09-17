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
import { isSecurityAdmin } from '@/lib/auth/role'
import { SURFACE_BY_KEY, CONFIGURABLE_ROLES } from '@/lib/access/surfaces'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { isGrantScope } from '@/lib/monday/worklist/team-priority'

export interface SurfaceChange {
  roleType: string
  surfaceKey: string
  allowed: boolean
}

function validate(change: SurfaceChange) {
  if (!CONFIGURABLE_ROLES.includes(change.roleType as never)) throw new Error('Unknown access level')
  const surface = SURFACE_BY_KEY.get(change.surfaceKey)
  if (!surface) throw new Error('Unknown page')
  // Locked surfaces are structural, not policy: Home keeps the portal usable
  // and the admin-only rows are what let an admin undo a mistake here.
  if (surface.locked) throw new Error('That row cannot be changed.')
}

/**
 * Save a whole edit session at once. The matrix is edited as a draft and
 * committed with Save, so a half-applied set of rules never goes live and the
 * nav is revalidated once instead of on every tick.
 */
export async function saveSurfaceChanges(changes: SurfaceChange[]) {
  if (!(await isSecurityAdmin())) throw new Error('Not authorized')
  if (changes.length === 0) return

  for (const c of changes) validate(c)

  const supabase = await createClient()
  const { error } = await supabase
    .from('access_level_pages')
    .upsert(
      changes.map(c => ({ role_type: c.roleType, surface_key: c.surfaceKey, allowed: c.allowed })),
      { onConflict: 'role_type,surface_key' },
    )
  if (error) throw new Error(error.message)

  // The sidebar is built in the root (app) layout, so every page's nav depends
  // on this. Revalidating the layout segment is the only correct scope.
  revalidatePath('/', 'layout')
}

// ── Team priority, given by name ────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Give a person the right to set team priorities on My Work, change how far it
 * reaches, or (scope null) take it away. Admin-only, through the admin's own
 * session like the matrix: RLS (monday_priority_grants_admin_write, migration
 * 085) permits is_admin(auth.uid()).
 */
export async function setPriorityGrant(personId: string, scope: string | null) {
  if (!(await isSecurityAdmin())) throw new Error('Not authorized')
  if (typeof personId !== 'string' || !UUID.test(personId)) throw new Error('Unknown person')
  if (scope !== null && !isGrantScope(scope)) throw new Error('Unknown scope')

  const supabase = await createClient()
  if (scope === null) {
    const { error } = await supabase.from('monday_priority_grants').delete().eq('person_id', personId)
    if (error) throw new Error(error.message)
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    const me = user ? await loadCurrentPerson(supabase, user, { real: true }) : null
    const { error } = await supabase.from('monday_priority_grants').upsert(
      { person_id: personId, scope, granted_by: me?.id ?? null, granted_at: new Date().toISOString() },
      { onConflict: 'person_id' },
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/access-levels')
}
