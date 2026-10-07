import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mailboxFilter } from '@/lib/auth/mailbox-filter'

export interface CurrentPerson {
  id: string
  full_name: string
  avatar_url: string | null
  /** The level given to them (Super Admin, Admin), or null: Team Leader or User follows their teams. */
  accessLevel: 'super_admin' | 'admin' | null
  /** Their work mailbox, so the top bar shows THEIR address, not the session's. */
  email: string | null
}

type Client = SupabaseClient<Database>

type PersonRow = {
  id: string
  full_name: string
  avatar_url?: string | null
  access_level?: string | null
  email_true_north?: string | null
  email_goodnews?: string | null
  email_coe?: string | null
  email_personal?: string | null
}

const FULL_SEL = 'id, full_name, avatar_url, access_level, email_true_north, email_goodnews, email_coe, email_personal'

const shape = (row: PersonRow): CurrentPerson => ({
  id: row.id,
  full_name: row.full_name,
  avatar_url: row.avatar_url ?? null,
  accessLevel: row.access_level === 'super_admin' || row.access_level === 'admin' ? row.access_level : null,
  email: row.email_true_north || row.email_goodnews || row.email_coe || row.email_personal || null,
})

/**
 * The signed-in user's directory person: by explicit account link (profile_id),
 * else by matching a mailbox to the login email (a user only ever matches their
 * own email). `avatar_url` (036) / `role_type` (035) degrade gracefully if the
 * migration isn't applied yet.
 */
/**
 * The part of a signed-in user this reads: the id, and the email as a fallback
 * match. Structural, so a full Supabase `User` and the claims-based identity from
 * auth/session.ts both fit, without this module importing that one back.
 */
export type SignedInIdentity = Pick<User, 'id'> & { email?: string | null }

export async function loadCurrentPerson(
  _supabase: Client,
  user: SignedInIdentity | null,
  opts: {
    /**
     * The person actually signed in, even while View Stage previews someone
     * else. For deciding whether a WRITE is allowed: a preview changes what is
     * rendered, never who is acting.
     */
    real?: boolean
  } = {},
): Promise<CurrentPerson | null> {
  // Resolved with the service-role client, not the caller's.
  //
  // Two reasons. email_personal is one of the mailboxes a login is matched
  // against, and it is no longer readable by the signed-in role (migration
  // 056), so the caller's client would silently stop matching anyone whose
  // only address is personal. And "who am I" should not be an RLS question in
  // the first place: it is the answer every other permission check is built
  // on. The caller still passes its client; the parameter is kept so every
  // call site reads the same, and ignored.
  const supabase = createAdminClient()
  // View Stage: while impersonating, resolve the impersonated person directly.
  const vs = opts.real ? null : await getViewAs()
  if (vs) {
    // Resolved on every request, not frozen into the token: change someone's
    // level and the preview follows on the next load, both in who it shows and
    // in what they can reach.
    // The first active person of that level, alphabetically (a Team Leader is
    // whoever leads a team, so the level is worked out, not read).
    const { loadSubjects } = await import('@/lib/access/store')
    const who = (await loadSubjects(supabase)).find(p => p.level === vs.role)
    if (!who) return null
    const { data } = await supabase.from('people').select(FULL_SEL).eq('id', who.id).maybeSingle()
    return data ? shape(data as PersonRow) : null
  }
  if (!user) return null

  let a = await supabase.from('people').select(FULL_SEL).eq('profile_id', user.id).limit(1)
  if (a.error) a = await supabase.from('people').select('id, full_name').eq('profile_id', user.id).limit(1) as typeof a
  let row = a.data?.[0] as PersonRow | undefined

  const orEmail = row ? null : mailboxFilter(user.email)
  if (orEmail) {
    let b = await supabase.from('people').select(FULL_SEL).or(orEmail).limit(1)
    if (b.error) b = await supabase.from('people').select('id, full_name').or(orEmail).limit(1) as typeof b
    row = b.data?.[0] as PersonRow | undefined
  }

  return row ? shape(row) : null
}
