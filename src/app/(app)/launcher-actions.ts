'use server'

// The people the Cmd+K launcher can find (navigation redesign, 22 September
// 2026). Read-only, and only for whoever may open the Directory, since each
// result opens a Directory card; how much of the card opens still follows the
// person's directory level there. Loaded when the launcher first opens, not on
// every page, so the top bar never waits for it.

import { loadAccess, verifiedSession } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { activePeople } from '@/lib/report/directory'

export async function launcherPeople(): Promise<{ id: string; name: string }[]> {
  // A list of people is a read that only a verified session gets, called
  // directly or not (lib/access/resolve.ts).
  if (!(await verifiedSession())) return []
  const access = await loadAccess()
  if (!access.can('directory')) return []
  const supabase = await createClient()
  // The whole company is "See the whole company" (d-company); without it, the
  // people of their own teams, as the Directory itself shows them.
  if (access.can('d-company')) return (await activePeople(supabase, {})).map(p => ({ id: p.id, name: p.full_name }))
  if (!access.personId) return []
  const { data } = await supabase.from('team_members').select('team_id').eq('person_id', access.personId)
  const teamIds = ((data ?? []) as { team_id: string }[]).map(m => m.team_id)
  const people = await activePeople(supabase, { teamIds })
  const own = people.some(p => p.id === access.personId) ? [] : await activePeople(supabase, { personIds: [access.personId] })
  return [...people, ...own].map(p => ({ id: p.id, name: p.full_name }))
}
