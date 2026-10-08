'use server'

/**
 * The signed-in person's own photo, from the cover of their own page. Uses the
 * service role but ONLY ever the current user's own person (resolved from the
 * session, never from a client-supplied id). The rest of their own details are
 * saved by the page's Personal tab (directory/[id]/actions.ts). Photos live in
 * the public `avatars` bucket (migration 036).
 */

import { verifiedSession } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { revalidatePath } from 'next/cache'

const BUCKET = 'avatars'

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * The person really signed in, or why not. Never during a View Stage preview:
 * a preview saves nothing (decided 8 October 2026), and a photo saved from one
 * would land on the Super Admin's own record.
 */
async function myPersonId(): Promise<{ id: string } | { error: string }> {
  if (await getViewAs()) return { error: 'View Stage is only a preview. Close it to change your photo.' }
  // Verified, two-step given, still active and invited (lib/access/resolve.ts).
  const session = await verifiedSession()
  if (!session) return { error: 'Sign in again to change your photo.' }
  const { supabase, user } = session
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return { error: 'Your account isn’t linked to a directory record.' }
  return { id: me.id }
}

function revalidate() {
  revalidatePath('/directory', 'layout') // their own page and every list

  revalidatePath('/') // home org chart avatars
}

/**
 * Store the cropped photo (a square JPEG blob) as the user's avatar. Errors are
 * returned, not thrown: production hides a thrown message from the browser.
 */
export async function uploadMyAvatar(formData: FormData): Promise<Result<{ url: string }>> {
  const who = await myPersonId()
  if ('error' in who) return { ok: false, error: who.error }
  const personId = who.id
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No image was received. Try again.' }
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: 'Image is larger than 6 MB.' }

  const admin = createAdminClient()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `${personId}.jpg`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
  if (upErr) { console.error('[avatar] upload:', upErr.message); return { ok: false, error: 'The photo could not be saved. Try again.' } }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}` // cache-bust, path is stable, so bump the query
  const { error: updErr } = await admin.from('people').update({ avatar_url: url }).eq('id', personId)
  if (updErr) { console.error('[avatar] save:', updErr.message); return { ok: false, error: 'The photo could not be saved. Try again.' } }

  revalidate()
  return { ok: true, url }
}

export async function removeMyAvatar(): Promise<Result> {
  const who = await myPersonId()
  if ('error' in who) return { ok: false, error: who.error }
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove([`${who.id}.jpg`])
  const { error } = await admin.from('people').update({ avatar_url: null }).eq('id', who.id)
  if (error) { console.error('[avatar] remove:', error.message); return { ok: false, error: 'The photo could not be removed. Try again.' } }
  revalidate()
  return { ok: true }
}
