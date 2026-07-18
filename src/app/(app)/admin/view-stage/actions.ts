'use server'

// View Stage — sign a read-only impersonation token for a tier, so a column can
// render the portal AS that role. Only a real portal admin (profiles.role) may
// sign; the token is bound to that admin and expires in 30 min. The token only
// changes what the app RENDERS — writes always run under the real session.

import { createClient } from '@/lib/supabase/server'
import { signViewAs, type ViewAsRole } from '@/lib/auth/view-as'

const ROLES: ViewAsRole[] = ['admin', 'admin_assistant', 'team_leader', 'user']

export async function tokenViewAs(role: ViewAsRole): Promise<{ token?: string; name?: string; error?: string }> {
  if (!ROLES.includes(role)) return { error: 'Invalid role.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Admins only.' }

  // Pick a real, active person of that tier — the identity the column shows.
  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, role_type, status')
    .eq('role_type', role)
    .eq('status', 'active')
    .order('full_name')
  const person = (people ?? [])[0]
  if (!person) return { error: `No active "${role.replace('_', ' ')}" to view as.` }

  const token = signViewAs({ sadmin: user.id, pid: person.id, role, exp: Date.now() + 30 * 60_000 })
  return { token, name: person.full_name }
}
