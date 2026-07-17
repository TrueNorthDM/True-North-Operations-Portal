import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

export interface CurrentPerson { id: string; full_name: string; avatar_url: string | null }

type Client = SupabaseClient<Database>

/**
 * The signed-in user's directory person: by explicit account link (profile_id),
 * else by matching a mailbox to the login email (a user only ever matches their
 * own email). `avatar_url` degrades to null if migration 036 isn't applied yet.
 */
export async function loadCurrentPerson(supabase: Client, user: User | null): Promise<CurrentPerson | null> {
  if (!user) return null

  let a = await supabase.from('people').select('id, full_name, avatar_url').eq('profile_id', user.id).limit(1)
  if (a.error) a = await supabase.from('people').select('id, full_name').eq('profile_id', user.id).limit(1) as typeof a
  let row = a.data?.[0] as CurrentPerson | undefined

  if (!row && user.email) {
    const em = user.email
    const orEmail = `email_personal.eq.${em},email_true_north.eq.${em},email_goodnews.eq.${em},email_coe.eq.${em}`
    let b = await supabase.from('people').select('id, full_name, avatar_url').or(orEmail).limit(1)
    if (b.error) b = await supabase.from('people').select('id, full_name').or(orEmail).limit(1) as typeof b
    row = b.data?.[0] as CurrentPerson | undefined
  }

  return row ? { id: row.id, full_name: row.full_name, avatar_url: row.avatar_url ?? null } : null
}
