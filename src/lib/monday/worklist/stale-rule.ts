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
  const { data } = await supabase
    .from('monday_boards').select('id, included, included_pinned, last_activity_at')

  const boards = ((data ?? []) as {
    id: number; included: boolean; included_pinned: boolean; last_activity_at: string | null
  }[]).map(b => ({
    id: b.id,
    included: b.included,
    includedPinned: b.included_pinned,
    lastActivityAt: b.last_activity_at,
  }))

  const { hide, show } = staleSweep(boards, new Date())
  if (hide.length) await supabase.from('monday_boards').update({ included: false }).in('id', hide)
  if (show.length) await supabase.from('monday_boards').update({ included: true }).in('id', show)

  return { hidden: hide.length, shown: show.length }
}
