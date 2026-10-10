/**
 * GET /api/monday/item-history?board=<id>&item=<id>  (board is ignored: the item's own is used)
 *
 * One item's trip through its workflow, fetched from Monday when somebody asks
 * for it. Nothing here is stored: the survey established that activity_logs
 * accepts item_ids, which is what lets a whole ingest not exist.
 *
 * Since 18 September 2026 it also says whose step each change belongs to, and
 * which steps are the reader's (lib/monday/worklist/history-data.ts).
 *
 * For whoever may open My Work, and only for an item that is on My Work: on
 * their own list, or on anyone's with "See everyone's list" (mw-everyone). The
 * route fetches with the portal's own Monday token, so without this any board
 * and item id would be read on the caller's behalf.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadAccess, verifiedSession } from '@/lib/access/resolve'
import { getMondayToken } from '@/lib/monday/snapshot'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { loadItemHistory } from '@/lib/monday/worklist/history-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verified, two-step given, still active and invited (lib/access/resolve.ts).
  const session = await verifiedSession()
  if (!session) return Response.json({ error: 'Sign in again.' }, { status: 401 })
  const { supabase, user } = session

  const access = await loadAccess()
  if (!access.can('my-work')) return Response.json({ error: 'My Work is not open to your access.' }, { status: 403 })

  const url = new URL(request.url)
  const board = url.searchParams.get('board')
  const item = url.searchParams.get('item')
  if (!board || !item) return Response.json({ error: 'board and item are required' }, { status: 400 })
  if (!/^\d{1,20}$/.test(board) || !/^\d{1,20}$/.test(item)) return Response.json({ error: 'board and item are numbers' }, { status: 400 })

  // The item has to be on My Work (a step of it, or of one of its subitems),
  // and on the reader's own list unless they may see everyone's.
  const db = createAdminClient()
  let onList = db.from('monday_assignments').select('item_id, board_id, parent_item_id, parent_board_id')
    .or(`item_id.eq.${item},parent_item_id.eq.${item}`).limit(1)
  if (!access.can('mw-everyone')) {
    const { data: links } = access.personId
      ? await db.from('monday_user_links').select('monday_user_id').eq('person_id', access.personId)
      : { data: [] }
    const accounts = ((links ?? []) as { monday_user_id: number }[]).map(l => l.monday_user_id)
    if (!accounts.length) return Response.json({ error: 'Not on your list.' }, { status: 403 })
    onList = onList.in('monday_user_id', accounts)
  }
  const { data: found, error: foundErr } = await onList
  if (foundErr) return Response.json({ error: 'Your list could not be read. Try again in a moment.' }, { status: 500 })
  if (!found?.length) return Response.json({ error: 'Not on your list.' }, { status: 403 })

  // The board is the item's own, taken from the row found above, never from
  // the address: any board id passed there was read with the portal's token,
  // its steps and all (audit, 10 October 2026).
  const hit = found[0] as { item_id: number; board_id: number; parent_item_id: number | null; parent_board_id: number | null }
  const itemBoard = String(hit.item_id === Number(item) ? hit.board_id : hit.parent_board_id ?? '')
  if (!itemBoard) return Response.json({ error: 'Not on your list.' }, { status: 403 })

  const token = await getMondayToken()
  if (!token) return Response.json({ error: 'No Monday token configured.' }, { status: 400 })

  try {
    // The reader as View Stage shows them, so a preview highlights the
    // previewed person's steps. Nothing is written here.
    const me = await loadCurrentPerson(supabase, user)
    // The server's own reads: the Monday tables are closed to sessions
    // (migration 104), and what this reader may see was decided above.
    return Response.json(await loadItemHistory(db, token, itemBoard, item, me))
  } catch (e) {
    // The detail goes to the log; the reader gets a sentence.
    console.error('[item-history]', (e as Error).message)
    return Response.json({ error: 'Monday could not be reached. Try again in a moment.' }, { status: 502 })
  }
}
