'use server'

/**
 * The signed-in person's own photo, from the cover of their own page. Uses the
 * service role but ONLY ever the current user's own person (resolved from the
 * session, never from a client-supplied id). The rest of their own details are
 * saved by the page's Personal tab (directory/[id]/actions.ts). Photos live in
 * the public `avatars` bucket (migration 036).
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
  // The person really signed in, never a View Stage preview: these write.
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) throw new Error('Your account isn’t linked to a directory record.')
  return me.id
}

function revalidate() {
  revalidatePath('/directory', 'layout') // their own page and every list

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
  const url = `${pub.publicUrl}?v=${Date.now()}` // cache-bust, path is stable, so bump the query
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
