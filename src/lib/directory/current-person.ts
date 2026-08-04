import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { asRoleType, type RoleType } from '@/lib/auth/tier'
import { getViewAs } from '@/lib/auth/view-as-server'

export interface CurrentPerson {
  id: string
  full_name: string
  avatar_url: string | null
  roleType: RoleType
  /** Their work mailbox, so the top bar shows THEIR address, not the session's. */
  email: string | null
}

type Client = SupabaseClient<Database>

type PersonRow = {
  id: string
  full_name: string
  avatar_url?: string | null
  role_type?: string | null
  email_true_north?: string | null
  email_goodnews?: string | null
  email_coe?: string | null
  email_personal?: string | null
}

const FULL_SEL = 'id, full_name, avatar_url, role_type, email_true_north, email_goodnews, email_coe, email_personal'

const shape = (row: PersonRow): CurrentPerson => ({
  id: row.id,
  full_name: row.full_name,
  avatar_url: row.avatar_url ?? null,
  roleType: asRoleType(row.role_type),
  email: row.email_true_north || row.email_goodnews || row.email_coe || row.email_personal || null,
})

/**
 * The signed-in user's directory person: by explicit account link (profile_id),
 * else by matching a mailbox to the login email (a user only ever matches their
 * own email). `avatar_url` (036) / `role_type` (035) degrade gracefully if the
 * migration isn't applied yet.
 */
export async function loadCurrentPerson(supabase: Client, user: User | null): Promise<CurrentPerson | null> {
  // View Stage: while impersonating, resolve the impersonated person directly.
  const vs = await getViewAs()
  if (vs) {
    // Resolved on every request, not frozen into the token: change someone's
    // level and the preview follows on the next load, both in who it shows and
    // in what they can reach.
    const pick = (sel: string) => supabase.from('people').select(sel)
      .eq('role_type', vs.role).eq('status', 'active').order('full_name').limit(1)
    let r = await pick(FULL_SEL) as unknown as { data: PersonRow[] | null; error: unknown }
    if (r.error) r = await pick('id, full_name') as unknown as typeof r
    const row = r.data?.[0] as PersonRow | undefined
    return row ? shape(row) : null
  }
  if (!user) return null

  let a = await supabase.from('people').select(FULL_SEL).eq('profile_id', user.id).limit(1)
  if (a.error) a = await supabase.from('people').select('id, full_name').eq('profile_id', user.id).limit(1) as typeof a
  let row = a.data?.[0] as PersonRow | undefined

  if (!row && user.email) {
    const em = user.email
    const orEmail = `email_personal.eq.${em},email_true_north.eq.${em},email_goodnews.eq.${em},email_coe.eq.${em}`
    let b = await supabase.from('people').select(FULL_SEL).or(orEmail).limit(1)
    if (b.error) b = await supabase.from('people').select('id, full_name').or(orEmail).limit(1) as typeof b
    row = b.data?.[0] as PersonRow | undefined
  }

  return row ? shape(row) : null
}
