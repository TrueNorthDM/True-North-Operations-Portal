'use server'

// The people the Cmd+K launcher can find (navigation redesign, 22 September
// 2026). Read-only, and only for whoever may open the Directory, since each
// result opens a Directory card; how much of the card opens still follows the
// person's directory level there. Loaded when the launcher first opens, not on
// every page, so the top bar never waits for it.

import { loadAccess } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { activePeople } from '@/lib/report/directory'

export async function launcherPeople(): Promise<{ id: string; name: string }[]> {
  const access = await loadAccess()
  if (!access.can('directory')) return []
  const people = await activePeople(await createClient(), {})
  return people.map(p => ({ id: p.id, name: p.full_name }))
}
