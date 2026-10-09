/**
 * The person a notification or settings write acts for: the one actually
 * signed in (real: true), never the one a View Stage preview shows. A preview
 * changes what is rendered, not who is acting, so writes are refused while one
 * is open. A plain module, not "use server": its callers are the actions.
 */

import { loadCurrentPerson } from '@/lib/directory/current-person'
import { verifiedSession } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'

export type Me = { personId: string; name: string; email: string | null }

export async function signedInPerson(what = 'change notifications'): Promise<Me | { error: string }> {
  if (await getViewAs()) return { error: `View Stage is only a preview. Close it to ${what}.` }
  // Verified, two-step given, still active and invited (lib/access/resolve.ts).
  const session = await verifiedSession()
  if (!session) return { error: 'Sign in again to save.' }
  const { supabase, user } = session
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return { error: 'Your login is not linked to anyone in the Directory.' }
  return { personId: me.id, name: me.full_name ?? '', email: user.email ?? null }
}

/** What a person sees when a save fails for a reason of the server's: the detail goes to the log. */
export const NOT_SAVED = 'Not saved. Try again in a moment.'
