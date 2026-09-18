/**
 * GET /api/monday/item-history?board=<id>&item=<id>
 *
 * One item's trip through its workflow, fetched from Monday when somebody asks
 * for it. Nothing here is stored: the survey established that activity_logs
 * accepts item_ids, which is what lets a whole ingest not exist.
 *
 * Since 18 September 2026 it also says whose step each change belongs to, and
 * which steps are the reader's (lib/monday/worklist/history-data.ts).
 *
 * Signed-in users, not admins. This is the same information the boards
 * dashboards already show, and a person needs to see the history of work that
 * is on their own list.
 */

import { createClient } from '@/lib/supabase/server'
import { getMondayToken } from '@/lib/monday/snapshot'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { loadItemHistory } from '@/lib/monday/worklist/history-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return new Response('Sign in.', { status: 401 })

  const url = new URL(request.url)
  const board = url.searchParams.get('board')
  const item = url.searchParams.get('item')
  if (!board || !item) return Response.json({ error: 'board and item are required' }, { status: 400 })

  const token = await getMondayToken()
  if (!token) return Response.json({ error: 'No Monday token configured.' }, { status: 400 })

  try {
    // The reader as View Stage shows them, so a preview highlights the
    // previewed person's steps. Nothing is written here.
    const me = await loadCurrentPerson(supabase, auth.user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Response.json(await loadItemHistory(supabase as any, token, board, item, me))
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
