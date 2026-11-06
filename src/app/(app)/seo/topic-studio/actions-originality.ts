'use server'

/**
 * Hand edits on the Originality tab (phase 4, 6 November 2026): the SEO changes
 * the lists Claude drafted, or writes their own. SEO research only. The lists
 * are cleaned on the server (cleanOriginalityEdit) whatever the browser sent.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { topicStudioTopic } from '@/lib/nav/routes'
import { cleanOriginalityEdit } from '@/lib/topic-studio/originality'
import { loadBundle, patchTopic } from '@/lib/topic-studio/store'

export type OriginalityDone = { ok: true } | { ok: false; error: string }

export async function saveOriginality(id: string, edit: unknown): Promise<OriginalityDone> {
  try {
    const access = await writerAccess()
    if (!access) return { ok: false, error: 'Sign in again to save. A View Stage preview cannot save.' }
    if (!access.canTool('topic-studio-seo')) return { ok: false, error: 'Working on topics is open to the SEO team.' }
    if (!access.personId) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }
    const patch = cleanOriginalityEdit(edit)
    if (!Object.keys(patch).length) return { ok: false, error: 'There was nothing to save.' }
    const db = createAdminClient()
    if (!(await loadBundle(db, id, 'seo'))) return { ok: false, error: 'That topic no longer exists.' }
    await patchTopic(db, id, patch, {}, access.personId)
    revalidatePath(topicStudioTopic(id))
    return { ok: true }
  } catch (e) {
    console.error('[topic-studio] saveOriginality', e)
    return { ok: false, error: 'That did not save. Try again in a moment.' }
  }
}
