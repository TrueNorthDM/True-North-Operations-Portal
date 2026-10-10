'use server'

/**
 * Resolving Monday accounts to people.
 *
 * Three verbs, because there are three true answers: this account is a person,
 * this account is somebody outside, and I was wrong about one of those.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedTo } from '@/lib/access/resolve'

async function guard(): Promise<string | null> {
  return (await allowedTo('monday-accounts')) ? null : 'Admins only.'
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
  const { data, error } = await supabase.from('monday_users').select('id').eq('id', id).maybeSingle()
  if (error) throw new Error(`reading the account: ${error.message}`)
  if (data) return
  const { error: insErr } = await supabase.from('monday_users').insert({
    id, name: `Removed account ${id}`, email: null, enabled: false, is_guest: false,
  })
  if (insErr) throw new Error(`adding the account: ${insErr.message}`)
}

/** The detail goes to the server log; the person gets a sentence (audit, 10 October 2026). */
function notSaved(error: { message: string }): { ok: false; error: string } {
  console.error('[monday links]', error.message)
  return { ok: false, error: 'Not saved. Try again in a moment.' }
}

export async function linkAccount(mondayUserId: number, personId: string): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  try { await ensureAccount(supabase, mondayUserId) } catch (e) { return notSaved(e as Error) }
  const { error } = await supabase.from('monday_user_links')
    .upsert({ monday_user_id: mondayUserId, person_id: personId, linked_by: 'manual' }, { onConflict: 'monday_user_id' })
  if (error) return notSaved(error)
  // Linking is also un-marking: an account cannot be both somebody and nobody.
  // And a link made by hand lets the sync link it by email again later.
  const { error: markErr } = await supabase.from('monday_users')
    .update({ is_external: false, auto_link: true }).eq('id', mondayUserId)
  if (markErr) return notSaved(markErr)
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}

export async function markExternal(mondayUserId: number): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  try { await ensureAccount(supabase, mondayUserId) } catch (e) { return notSaved(e as Error) }
  const { error } = await supabase.from('monday_users').update({ is_external: true }).eq('id', mondayUserId)
  if (error) return notSaved(error)
  const { error: unlinkErr } = await supabase.from('monday_user_links').delete().eq('monday_user_id', mondayUserId)
  if (unlinkErr) return notSaved(unlinkErr)
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}

export async function clearAccount(mondayUserId: number): Promise<{ ok: boolean; error?: string }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  const { error: unlinkErr } = await supabase.from('monday_user_links').delete().eq('monday_user_id', mondayUserId)
  if (unlinkErr) return notSaved(unlinkErr)
  // Cleared sticks: the sync does not link it by email again until someone
  // links it by hand (migration 104, decided 10 October 2026). It used to be
  // back on the same person's list within four hours.
  const { error } = await supabase.from('monday_users')
    .update({ is_external: false, auto_link: false }).eq('id', mondayUserId)
  if (error) return notSaved(error)
  revalidatePath('/admin/monday-links')
  revalidatePath('/my-work')
  return { ok: true }
}
