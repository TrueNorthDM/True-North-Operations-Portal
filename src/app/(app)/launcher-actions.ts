'use server'

// The people the Cmd+K launcher can find (navigation redesign, 22 September
// 2026). Read-only, and only for whoever may open the Directory, since each
// result opens a Directory card; how much of the card opens still follows the
// person's directory level there. Loaded when the launcher first opens, not on
// every page, so the top bar never waits for it.

import { loadAccess, verifiedSession } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLedMemberIds } from '@/lib/directory/person-page-data'
import { pageHrefs } from '@/lib/directory/page-rights'
import { createClient } from '@/lib/supabase/server'
import { activePeople } from '@/lib/report/directory'

/**
 * Each person with the address of their page when the viewer may open it, or
 * null: a name the viewer may see in the Directory but whose page does not
 * open to them is listed without a link (decided 8 October 2026), so the
 * search never leads to a page that refuses.
 */
export async function launcherPeople(): Promise<{ id: string; name: string; href: string | null }[]> {
  // A list of people is a read that only a verified session gets, called
  // directly or not (lib/access/resolve.ts).
  if (!(await verifiedSession())) return []
  const access = await loadAccess()
  if (!access.can('directory')) return []
  const supabase = await createClient()
  const hrefFor = pageHrefs(access.can, access.personId, await loadLedMemberIds(createAdminClient(), access.personId))
  const withHref = (list: { id: string; full_name: string }[]) => list.map(p => ({ id: p.id, name: p.full_name, href: hrefFor(p.id) }))
  // The whole company is "See the whole company" (d-company); without it, the
  // people of their own teams, as the Directory itself shows them.
  if (access.can('d-company')) return withHref(await activePeople({}))
  if (!access.personId) return []
  const { data } = await supabase.from('team_members').select('team_id').eq('person_id', access.personId)
  const teamIds = ((data ?? []) as { team_id: string }[]).map(m => m.team_id)
  const people = await activePeople({ teamIds })
  const own = people.some(p => p.id === access.personId) ? [] : await activePeople({ personIds: [access.personId] })
  return withHref([...people, ...own])
}
