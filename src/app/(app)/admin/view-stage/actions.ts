'use server'

// View Stage: sign a read-only impersonation token for a level, so a column can
// render the portal AS that level. Super Admins only; the token is bound to the
// Super Admin who signed it and expires in 30 minutes. It only changes what the
// app RENDERS; writes always run under the real session, and a preview can only
// take powers away (access/resolve.ts, allowedTo).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signViewAs, type ViewAsRole } from '@/lib/auth/view-as'
import { isSuperAdmin } from '@/lib/access/resolve'
import { loadSubjects } from '@/lib/access/store'
import { LEVEL_LABEL } from '@/lib/access/catalogue'

const ROLES: ViewAsRole[] = ['admin', 'team_leader', 'user']

export async function tokenViewAs(role: ViewAsRole): Promise<{ token?: string; name?: string; error?: string }> {
  if (!ROLES.includes(role)) return { error: 'Invalid level.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  if (!(await isSuperAdmin())) return { error: 'Super Admins only.' }

  // The first active person of that level, the identity the column shows (the
  // same choice current-person.ts makes for every request of the preview).
  const person = (await loadSubjects(createAdminClient())).find(p => p.level === role)
  if (!person) return { error: `Nobody is a ${LEVEL_LABEL[role]} right now.` }

  const token = signViewAs({ sadmin: user.id, role, exp: Date.now() + 30 * 60_000 })
  return { token, name: person.name }
}
