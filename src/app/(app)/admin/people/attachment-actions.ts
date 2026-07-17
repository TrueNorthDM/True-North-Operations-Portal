'use server'

/**
 * Person "History" documents — upload / delete / signed-download for the files
 * kept in the private `person-files` Storage bucket (migration 033). Admin-only,
 * through the signed-in admin's session (Storage RLS `person_files_admin_all` +
 * `person_attachments` admin write). The one-off Monday importer uses the
 * service role instead and bypasses these.
 */

import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { revalidatePath } from 'next/cache'
import type { PersonAttachment } from '@/components/admin/people-types'

const BUCKET = 'person-files'

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error('Not authorized')
}

/** Upload one document for a person; returns the created record for the UI. */
export async function uploadPersonAttachment(personId: string, formData: FormData): Promise<PersonAttachment> {
  await requireAdmin()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('No file provided')
  if (file.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB')
  const supabase = await createClient()

  const safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
  const path = `${personId}/${Date.now()}-${safe}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) throw new Error(upErr.message)

  const { data, error: insErr } = await supabase
    .from('person_attachments')
    .insert({ person_id: personId, file_name: file.name, storage_path: path, mime: file.type || null, size_bytes: file.size })
    .select('id, file_name, storage_path, mime, size_bytes, uploaded_at')
    .single()
  if (insErr || !data) {
    await supabase.storage.from(BUCKET).remove([path]) // don't leave an orphan object
    throw new Error(insErr?.message ?? 'Could not save the document')
  }
  revalidatePath('/directory')
  return { id: data.id, fileName: data.file_name, storagePath: data.storage_path, mime: data.mime, sizeBytes: data.size_bytes, uploadedAt: data.uploaded_at }
}

export async function deletePersonAttachment(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('person_attachments').select('storage_path').eq('id', id).single()
  if (error || !data) throw new Error(error?.message ?? 'Document not found')
  await supabase.storage.from(BUCKET).remove([data.storage_path])
  const { error: delErr } = await supabase.from('person_attachments').delete().eq('id', id)
  if (delErr) throw new Error(delErr.message)
  revalidatePath('/directory')
}

/** Short-lived signed URL to view/download a private document. */
export async function signedAttachmentUrl(storagePath: string): Promise<string> {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5)
  if (error || !data) throw new Error(error?.message ?? 'Could not create the link')
  return data.signedUrl
}
