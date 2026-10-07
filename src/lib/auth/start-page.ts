/**
 * Where someone lands after signing in when no page was asked for: Home, or
 * the page they chose in Settings, Home and start (7 October 2026). A page
 * that was asked for (a link they followed before signing in) always wins.
 * Any failure falls back to the address it was given: signing in must never
 * break because a setting could not be read.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson, type SignedInIdentity } from '@/lib/directory/current-person'
import { startPageFor } from '@/lib/settings/person'

export async function withStartPage(next: string, user: SignedInIdentity | null | undefined): Promise<string> {
  if (next !== '/' || !user) return next
  try {
    const db = createAdminClient()
    const me = await loadCurrentPerson(db, user, { real: true })
    return me ? await startPageFor(db, me.id) : next
  } catch {
    return next
  }
}
