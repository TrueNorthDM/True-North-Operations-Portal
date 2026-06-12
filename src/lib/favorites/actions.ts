'use server'

/**
 * Favourites mutations. Writes go through the signed-in user's session — RLS
 * (favorites_owner) scopes everything to their own rows, so any logged-in user
 * can manage their favourites without admin rights or a service role.
 *
 * The hrefs are validated against the catalog (labels come from the catalog
 * too, never from the client) and capped at MAX_FAVORITES. Saving replaces the
 * whole set — simplest correct semantics for a small ordered list.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FAVORITE_TARGETS, MAX_FAVORITES } from '@/lib/favorites/catalog'

export async function saveFavorites(hrefs: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // Validate against the catalog and keep the caller's order, capped.
  const byHref = new Map(FAVORITE_TARGETS.map(t => [t.href, t]))
  const valid = [...new Set(hrefs)].filter(h => byHref.has(h)).slice(0, MAX_FAVORITES)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error: delErr } = await db.from('favorites').delete().eq('profile_id', user.id)
  if (delErr) throw new Error(delErr.message)

  if (valid.length > 0) {
    const rows = valid.map((href, position) => ({
      profile_id: user.id,
      href,
      label: byHref.get(href)!.label,
      position,
    }))
    const { error: insErr } = await db.from('favorites').insert(rows)
    if (insErr) throw new Error(insErr.message)
  }

  revalidatePath('/')
}
