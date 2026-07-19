/**
 * Server-side helper: fetch recent Monday webhook events for one board
 * (i.e. one site), enriched with the affected page name.
 *
 * Filters out the dispatcher-level "skipped:column not Href Links" noise,
 * those events fire on every column change in the board, even ones we
 * don't care about, and would drown out the meaningful entries in the feed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityRow } from '@/components/ActivityLog'

interface MondayEventRow {
  id: string
  received_at: string
  monday_item_id: string | null
  result: string | null
}

interface PageUrlJoinRow {
  monday_item_id: string | null
  pages: { name: string } | null
}

export async function getRecentActivity(
  supabase: SupabaseClient,
  boardId: string | null,
  limit = 20,
): Promise<ActivityRow[]> {
  if (!boardId) return []

  const { data: events } = await supabase
    .from('monday_events')
    .select('id, received_at, monday_item_id, result')
    .eq('board_id', boardId)
    // Hide the dispatcher noise. PostgREST's `not.like` works for our
    // simple prefix string but isn't a regex, we use OR with multiple
    // patterns if more noise classes appear later.
    .not('result', 'like', 'skipped:column %')
    .order('received_at', { ascending: false })
    .limit(limit)

  const rows = (events ?? []) as MondayEventRow[]
  if (rows.length === 0) return []

  // Resolve item id → page name in one query. Items are stored on
  // page_urls (one per language item), so we join through that.
  const itemIds = Array.from(
    new Set(rows.map(r => r.monday_item_id).filter((x): x is string => !!x)),
  )

  const nameByItem = new Map<string, string>()
  if (itemIds.length > 0) {
    const { data: joins } = await supabase
      .from('page_urls')
      .select('monday_item_id, pages(name)')
      .in('monday_item_id', itemIds)
    // Supabase types a to-one embed without `!inner` as an array ({name}[]),
    // but page_urls→pages is a single FK, so at runtime it's one object. The
    // cast corrects that mis-inference to the real shape.
    for (const j of (joins ?? []) as unknown as PageUrlJoinRow[]) {
      if (j.monday_item_id && j.pages?.name) {
        nameByItem.set(j.monday_item_id, j.pages.name)
      }
    }
  }

  return rows.map(r => ({
    id: r.id,
    received_at: r.received_at,
    monday_item_id: r.monday_item_id,
    page_name: r.monday_item_id ? nameByItem.get(r.monday_item_id) ?? null : null,
    result: r.result,
  }))
}
