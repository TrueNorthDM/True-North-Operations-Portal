'use server'

/**
 * Self-service actions for the signed-in user's own profile: the avatar photo
 * and the "your details" personal fields. All use the service role but ONLY ever
 * the current user's own person (resolved from the session, never from a
 * client-supplied id) and only a fixed whitelist of columns — so they can't be
 * used to touch anyone else's record or any HR-managed field. Photos live in the
 * public `avatars` bucket (migration 036).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { revalidatePath } from 'next/cache'

const BUCKET = 'avatars'

async function myPersonId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const me = await loadCurrentPerson(supabase, user)
  if (!me) throw new Error('Your account isn’t linked to a directory record.')
  return me.id
}

function revalidate() {
  revalidatePath('/profile')
  revalidatePath('/directory')
  revalidatePath('/') // home org chart avatars
}

/** Store the cropped photo (a square JPEG blob) as the user's avatar. */
export async function uploadMyAvatar(formData: FormData): Promise<string> {
  const personId = await myPersonId()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('No image provided')
  if (file.size > 6 * 1024 * 1024) throw new Error('Image is larger than 6 MB')

  const admin = createAdminClient()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `${personId}.jpg`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
  if (upErr) throw new Error(upErr.message)

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}` // cache-bust — path is stable, so bump the query
  const { error: updErr } = await admin.from('people').update({ avatar_url: url }).eq('id', personId)
  if (updErr) throw new Error(updErr.message)

  revalidate()
  return url
}

export async function removeMyAvatar(): Promise<void> {
  const personId = await myPersonId()
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove([`${personId}.jpg`])
  const { error } = await admin.from('people').update({ avatar_url: null }).eq('id', personId)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── "Your details" — the fields the person can edit about themselves ─────────
export interface MyProfileInput {
  last_name: string | null
  email_personal: string | null
  phone: string | null
  whatsapp_same_number: string | null
  location: string | null
  date_of_birth: string | null
}

const trimOrNull = (v: string | null) => (v == null ? null : v.trim() || null)

/** Update only the whitelisted personal fields on the signed-in user's record. */
export async function updateMyProfile(input: MyProfileInput): Promise<void> {
  const personId = await myPersonId()
  const admin = createAdminClient()
  const patch = {
    last_name: trimOrNull(input.last_name),
    email_personal: trimOrNull(input.email_personal),
    phone: trimOrNull(input.phone),
    whatsapp_same_number: input.whatsapp_same_number || null,
    location: trimOrNull(input.location),
    date_of_birth: input.date_of_birth || null,
  }
  const { error } = await admin.from('people').update(patch).eq('id', personId)
  if (error) throw new Error(error.message)
  revalidate()
}
