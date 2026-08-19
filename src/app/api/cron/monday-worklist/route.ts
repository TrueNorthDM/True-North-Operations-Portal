/**
 * GET /api/cron/monday-worklist, keeping My Work current on its own.
 *
 * Runs on the same six-times-a-day schedule as the boards pull, so everything
 * that comes from Monday is as of the same moment. Anything else invites
 * "why does this page say something different from that one".
 *
 * WHY IT CHAINS. 197 boards do not fit in one invocation: Vercel stops a
 * function at 300 seconds. One firing therefore has to become several. Each
 * pass takes as many boards as fit in its budget, oldest first, and if any are
 * left it calls itself again and returns without waiting.
 *
 * That is what makes the schedule mean what it says. A single non-chaining
 * slice every four hours would leave the oldest boards a day behind while the
 * settings page cheerfully announced a four-hour cadence: the cron would run
 * on time and the data would still be stale, which is the worst combination
 * because it looks fine.
 *
 * The chain is bounded two ways. LINKS caps how many hops one firing may make,
 * so a bug cannot turn into a loop that bills by the second. And every hop
 * makes progress by construction: a board is stamped with items_synced_at as
 * it finishes, so the queue can only shrink.
 *
 * Discovery runs once at the head of a chain, not on every hop: new boards and
 * renamed columns should be picked up, but eighteen seconds of it per hop is
 * eighteen seconds not spent reading work.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { syncMondayUsers, syncMondayBoards } from '@/lib/monday/worklist/discover'
import { ingestSlice } from '@/lib/monday/worklist/ingest'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

/** Leaves room to finish writing before the platform pulls the plug. */
const BUDGET_MS = 210_000

/** Hops one firing may make. Eight covers a full pass with room to spare. */
const LINKS = 8

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const hop = Number(url.searchParams.get('hop') ?? '0')
  if (hop >= LINKS) {
    return NextResponse.json({ stopped: `Chain hit its limit of ${LINKS} hops.` })
  }

  const token = await getMondayToken()
  if (!token) return NextResponse.json({ skipped: 'No Monday token configured.' })

  const supabase = createAdminClient()
  const started = Date.now()
  let discovered: unknown = null

  try {
    // Head of the chain: refresh the map before reading the work.
    if (hop === 0) {
      const users = await syncMondayUsers(supabase, token)
      const boards = await syncMondayBoards(supabase, token)
      discovered = {
        accounts: users.users,
        linked: users.linkedByEmail,
        pending: users.unlinked.length,
        boards: boards.boards,
        stepsSeeded: boards.stepsSeeded,
      }
    }

    const r = await ingestSlice(supabase, token, BUDGET_MS - (Date.now() - started))

    if (r.remaining > 0) {
      // Fire and forget: the next hop is a separate invocation with its own
      // 300 seconds. Awaiting it here would just spend this one's budget
      // waiting, and both would die together.
      const next = new URL(request.url)
      next.searchParams.set('hop', String(hop + 1))
      void fetch(next.toString(), {
        headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
      }).catch(() => {
        // A dropped hop costs freshness until the next scheduled firing, which
        // is a delay rather than a hole: the queue is ordered by how stale a
        // board is, so whatever was missed is first in line next time.
      })
    }

    return NextResponse.json({
      hop,
      discovered,
      boards: r.done.length,
      items: r.done.reduce((s, b) => s + b.items, 0),
      assignments: r.done.reduce((s, b) => s + b.assignments, 0),
      remaining: r.remaining,
      seconds: Math.round(r.spentMs / 1000),
      chained: r.remaining > 0,
    })
  } catch (e) {
    // Whatever finished is already saved, board by board. The next firing
    // resumes from the oldest, which is exactly where this stopped.
    return NextResponse.json(
      { hop, error: (e as Error).message, seconds: Math.round((Date.now() - started) / 1000) },
      { status: 500 },
    )
  }
}
