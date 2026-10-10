/**
 * GET /api/admin/monday-backfill?run=yes
 *
 * Recovers hand-off dates for work that was already open when the change log
 * started, by reading Monday's own activity_logs item by item.
 *
 * WHY IT IS A ONE-OFF AND NOT A CRON. The gap it fills is bounded: everything
 * open on the day recording began. New work gets its assigned event from the
 * ordinary sync, so running this repeatedly would spend Monday's rate limit
 * re-deriving dates already known.
 *
 * It chains like the worklist cron because it cannot finish in one function:
 * one Monday query per item, and there are thousands of open items. Each pass
 * takes what fits in its budget and calls itself if any are left. Progress is
 * by construction, since an item that gets its event stops being selected.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { allowedTo } from '@/lib/access/resolve'
import { internalOrigin } from '@/lib/auth/public-origin'
import { ANOTHER_SITE, fromAnotherSite } from '@/lib/auth/same-site'
import { selectAllPages } from '@/lib/monday/worklist/resilience'
import {
  backfillEvents, fetchItemLogs, handoffsFrom, type OpenAssignment,
} from '@/lib/monday/worklist/backfill'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const BUDGET_MS = 210_000
const LINKS = 8
/** Items read per pass before the budget is checked again. */
const CHUNK = 25

export async function GET(request: Request) {
  const url = new URL(request.url)
  const hop = Number(url.searchParams.get('hop') ?? '0')

  // Hop 0 is a person clicking; later hops are this route calling itself and
  // carry the cron secret instead of a session.
  const chained = isCronRequest(request.headers.get('authorization'))
  if (!chained && !(await allowedTo('cs-my-work'))) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }
  if (!chained) {
    // It writes, so it says so and waits for ?run=yes, like the other sync
    // routes, and a link on another site cannot start it (audit, 10 October 2026).
    if (fromAnotherSite(request)) return NextResponse.json({ error: ANOTHER_SITE }, { status: 403 })
    if (url.searchParams.get('run') !== 'yes') {
      return NextResponse.json({ waiting: 'This one writes hand-off dates to the change log. Add ?run=yes to go ahead.' })
    }
  }
  if (hop >= LINKS) return NextResponse.json({ stopped: `Chain hit its limit of ${LINKS} hops.` })

  const token = await getMondayToken()
  if (!token) return NextResponse.json({ skipped: 'No Monday token configured.' })

  const supabase = createAdminClient()
  const started = Date.now()

  // Every step that already has a hand-off is done. Read whole, a page at a
  // time: a single read stopped at 1,000 of them, so steps with a hand-off
  // looked like they had none and got a second one (audit, 10 October 2026).
  const known = await selectAllPages<{ item_id: number; people_col: string; monday_user_id: number }>((from, to) => supabase
    .from('monday_assignment_events')
    .select('item_id, people_col, monday_user_id')
    .eq('event', 'assigned')
    .order('id').range(from, to))
  if (known.error) return NextResponse.json({ error: 'The change log could not be read.' }, { status: 500 })

  const haveHandoff = new Set(known.data.map(k => `${k.item_id}|${k.people_col}|${k.monday_user_id}`))

  const open = await selectAllPages<OpenAssignment>((from, to) => supabase
    .from('monday_assignments')
    .select('board_id, item_id, people_col, monday_user_id, status_text, status_done, due_date')
    .or('status_done.is.null,status_done.eq.false')
    .order('id').range(from, to))
  if (open.error) return NextResponse.json({ error: 'The open work could not be read.' }, { status: 500 })
  const openRows = open.data

  const missing = ((openRows ?? []) as OpenAssignment[])
    .filter(a => !haveHandoff.has(`${a.item_id}|${a.people_col}|${a.monday_user_id}`))

  // One Monday query serves every step of one item, so the work is grouped by
  // item rather than by assignment.
  const byItem = new Map<string, OpenAssignment[]>()
  for (const a of missing) {
    const k = `${a.board_id}|${a.item_id}`
    const list = byItem.get(k)
    if (list) list.push(a)
    else byItem.set(k, [a])
  }

  let items = 0
  let written = 0
  let undated = 0
  const queue = [...byItem.entries()]

  for (let i = 0; i < queue.length; i += CHUNK) {
    if (Date.now() - started > BUDGET_MS) break

    for (const [key, group] of queue.slice(i, i + CHUNK)) {
      const [boardId, itemId] = key.split('|').map(Number)
      items++
      try {
        const logs = await fetchItemLogs(token, boardId, itemId)

        // One item can carry several steps, each on its own people column.
        const events = group.flatMap(a =>
          backfillEvents([a], handoffsFrom(logs, a.people_col)))

        undated += group.length - events.length
        if (!events.length) continue

        const { error } = await supabase
          .from('monday_assignment_events')
          .upsert(events, {
            onConflict: 'board_id,item_id,people_col,monday_user_id,event,occurred_at',
            ignoreDuplicates: true,
          })
        if (error) throw error
        written += events.length
      } catch (e) {
        // One item Monday will not answer for must not stop the pass: the
        // next hop simply picks it up again, and a permanent failure shows as
        // a count that stops falling.
        console.error(`backfill item ${itemId}:`, e instanceof Error ? e.message : e)
      }
    }
  }

  const left = Math.max(0, byItem.size - items)
  if (left > 0 && hop + 1 < LINKS) {
    // Fire and forget: waiting would spend this function's budget on the next
    // one's work and the chain would never get past hop one.
    //
    // The hop carries the cron secret when there is one, and the caller's own
    // cookie otherwise. Without the fallback, an account with no CRON_SECRET
    // set gets a first pass that works and a second that 403s, which looks
    // like the backfill silently stopping halfway.
    const forward: Record<string, string> = {}
    const secret = process.env.CRON_SECRET
    if (secret) forward.authorization = `Bearer ${secret}`
    const cookie = request.headers.get('cookie')
    if (cookie) forward.cookie = cookie

    void fetch(`${internalOrigin(request.url)}/api/admin/monday-backfill?run=yes&hop=${hop + 1}`, { headers: forward })
      .catch(() => {})
  }

  return NextResponse.json({
    hop,
    itemsRead: items,
    handoffsWritten: written,
    // Monday keeps activity logs for a limited window, so some open work is
    // simply older than its memory. Reported rather than retried forever.
    stepsMondayCouldNotDate: undated,
    itemsLeft: left,
    continuing: left > 0 && hop + 1 < LINKS,
  })
}
