'use server'

/**
 * Saving a person's own settings (the Settings page, 7 October 2026). Like the
 * notification actions: the login is verified, the person actually signed in
 * is resolved (never a View Stage preview's), and the row is written with the
 * privileged client, narrowed to that person.
 *
 * Favourites are checked against the person's own navigation: a page they
 * cannot open is dropped, whatever the browser sent.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAccess } from '@/lib/access/resolve'
import { NOT_SAVED, signedInPerson } from '@/lib/notifications/signed-in'
import { buildRail } from '@/lib/access/nav'
import { pinnable } from '@/lib/settings/pages'
import { cleanSettings, type SettingsPatch } from '@/lib/settings/person'

type Result = { ok: boolean; error?: string }

export async function saveSettings(patch: SettingsPatch): Promise<Result> {
  try {
    return await save(patch)
  } catch (e) {
    console.error('[settings] save:', (e as Error).message)
    return { ok: false, error: NOT_SAVED }
  }
}

async function save(patch: SettingsPatch): Promise<Result> {
  const clean = cleanSettings(patch)
  if (!clean) return { ok: false, error: 'That choice could not be read. Reload the page and try again.' }
  // The person actually signed in, never a View Stage preview's (refused).
  const signed = await signedInPerson('change your settings')
  if ('error' in signed) return { ok: false, error: signed.error }
  const me = { id: signed.personId }

  if (Array.isArray(clean.favourites)) {
    const access = await loadAccess()
    const rail = buildRail({ can: access.can, canTool: access.canTool })
    const allowed = new Set(pinnable(rail).flatMap(g => g.rows.map(r => r.key)))
    clean.favourites = (clean.favourites as string[]).filter(k => allowed.has(k))
  }

  const { error } = await createAdminClient().from('person_settings').upsert(
    { person_id: me.id, ...clean, updated_at: new Date().toISOString() },
    { onConflict: 'person_id' },
  )
  if (error) {
    console.error('[settings] save:', error.message)
    return { ok: false, error: NOT_SAVED }
  }
  if ('favourites' in clean || 'show_birthday' in clean || 'show_anniversary' in clean) revalidatePath('/')
  return { ok: true }
}
