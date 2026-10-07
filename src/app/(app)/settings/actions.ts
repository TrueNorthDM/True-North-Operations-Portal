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
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { getViewAs } from '@/lib/auth/view-as-server'
import { loadAccess } from '@/lib/access/resolve'
import { buildRail } from '@/lib/access/nav'
import { directoryLevel } from '@/lib/access/surfaces'
import { pinnable } from '@/lib/settings/pages'
import { cleanSettings, type SettingsPatch } from '@/lib/settings/person'

type Result = { ok: boolean; error?: string }

export async function saveSettings(patch: SettingsPatch): Promise<Result> {
  if (await getViewAs()) return { ok: false, error: 'View Stage is only a preview. Close it to change your settings.' }
  const clean = cleanSettings(patch)
  if (!clean) return { ok: false, error: 'That choice could not be read. Reload the page and try again.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You are signed out. Sign in again to save.' }
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }

  if (Array.isArray(clean.favourites)) {
    const access = await loadAccess()
    const rail = buildRail({ can: access.can, canTool: access.canTool, level: directoryLevel(access.can) })
    const allowed = new Set(pinnable(rail).flatMap(g => g.rows.map(r => r.key)))
    clean.favourites = (clean.favourites as string[]).filter(k => allowed.has(k))
  }

  const { error } = await createAdminClient().from('person_settings').upsert(
    { person_id: me.id, ...clean, updated_at: new Date().toISOString() },
    { onConflict: 'person_id' },
  )
  if (error) return { ok: false, error: error.message }
  if ('favourites' in clean || 'show_birthday' in clean || 'show_anniversary' in clean) revalidatePath('/')
  return { ok: true }
}
