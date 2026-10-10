// The stale-board rule, applied (My Work sources, Company settings). Its own
// plain module, not the actions file: an export of a "use server" file is an
// action anyone signed in can call, and this one takes no access check of its
// own. Its callers check: the settings action (cs-my-work) and the cron sync
// (the cron secret).

import type { createAdminClient } from '@/lib/supabase/admin'
import { staleSweep } from './stale'

/** One pass of the rule. Also called from the sync, so the two cannot drift. */
export async function applyStaleRule(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ hidden: number; shown: number }> {
  const { data, error } = await supabase
    .from('monday_boards').select('id, included, included_pinned, last_activity_at')
  if (error) throw new Error(`Could not read the boards: ${error.message}`)

  const boards = ((data ?? []) as {
    id: number; included: boolean; included_pinned: boolean; last_activity_at: string | null
  }[]).map(b => ({
    id: b.id,
    included: b.included,
    includedPinned: b.included_pinned,
    lastActivityAt: b.last_activity_at,
  }))

  const { hide, show } = staleSweep(boards, new Date())
  // Said, not swallowed: a count of boards hidden that were not is a lie on
  // the settings page (audit, 10 October 2026).
  for (const [ids, included] of [[hide, false], [show, true]] as const) {
    if (!ids.length) continue
    const { error: e } = await supabase.from('monday_boards').update({ included }).in('id', [...ids])
    if (e) throw new Error(`Could not ${included ? 'show' : 'hide'} the boards: ${e.message}`)
  }

  return { hidden: hide.length, shown: show.length }
}
