'use server'

/**
 * Resolving Monday accounts to people.
 *
 * Three verbs, because there are three true answers: this account is a person,
 * this account is somebody outside, and I was wrong about one of those.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSecurityAdmin } from '@/lib/auth/role'

async function guard(): Promise<string | null> {
  return (await isSecurityAdmin()) ? null : 'Admins only.'
}

/**
 * Some ids are named on work and have no account record at all: the account
 * was deleted from Monday and no query will resolve it. The link table points
 * at monday_users, so without a row there is nothing to attach a decision to
 * and the buttons on those rows would fail on a foreign key.
 *
 * A placeholder says exactly what is known and makes the account answerable,
 * which is the whole point of listing it.
 */
async function ensureAccount(supabase: ReturnType<typeof createAdminClient>, id: number) {
  const { data } = await supabase.from('monday_users').select('id').eq('id', id).maybeSingle()
  if (data) return
  await supabase.from('monday_users').insert({
    id, name: `Removed account ${id}`, email: null, enabled: false, is_guest: false,
  })
}

export async function linkAccount(mondayUserId: number, personId: string): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  await ensureAccount(supabase, mondayUserId)
  const { error } = await supabase.from('monday_user_links')
    .upsert({ monday_user_id: mondayUserId, person_id: personId, linked_by: 'manual' }, { onConflict: 'monday_user_id' })
  if (error) return { ok: false, error: error.message }
  // Linking is also un-marking: an account cannot be both somebody and nobody.
  await supabase.from('monday_users').update({ is_external: false }).eq('id', mondayUserId)
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}

export async function markExternal(mondayUserId: number): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  await ensureAccount(supabase, mondayUserId)
  const { error } = await supabase.from('monday_users').update({ is_external: true }).eq('id', mondayUserId)
  if (error) return { ok: false, error: error.message }
  await supabase.from('monday_user_links').delete().eq('monday_user_id', mondayUserId)
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}

export async function clearAccount(mondayUserId: number): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  await supabase.from('monday_user_links').delete().eq('monday_user_id', mondayUserId)
  const { error } = await supabase.from('monday_users').update({ is_external: false }).eq('id', mondayUserId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}
