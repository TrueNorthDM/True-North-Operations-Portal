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
 * left it hands on to the next pass (see GET below for how).
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
 * it finishes, and a hop reads only boards not read since the firing began,
 * so the queue can only shrink, and empties.
 *
 * Discovery runs once at the head of a chain, not on every hop: new boards and
 * renamed columns should be picked up, but eighteen seconds of it per hop is
 * eighteen seconds not spent reading work.
 */

import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { syncMondayUsers, syncMondayBoards } from '@/lib/monday/worklist/discover'
import { ingestSlice } from '@/lib/monday/worklist/ingest'
import { applyStaleRule } from '@/app/(app)/settings/monday/actions'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

/** Leaves room to finish writing before the platform pulls the plug. */
const BUDGET_MS = 210_000

/** Hops one firing may make. Eight covers a full pass with room to spare. */
const LINKS = 8

/** How long a hop waits for the next one to say it has started. */
const HANDOFF_MS = 20_000

/**
 * How a hop hands on, since 21 September 2026. It used to fire the next
 * request without waiting and return; Vercel freezes a function the moment it
 * returns, so that request was mostly never sent, and each firing read about
 * 21 of the 36 shown boards. A board was refreshed every eight hours while the
 * page promised four, and "last refreshed" said seven hours.
 *
 * Now every hop answers 202 at once and does its work in after(), which runs
 * on for the route's maxDuration. The hop before it therefore gets its answer
 * in a second or two, and awaits it, so the next hop is actually on its way
 * before this one ends. `since` is the start of the firing: each hop reads only
 * boards not read since then, so the chain stops when every board has been
 * read once, not when it reaches LINKS.
 */
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
  const since = url.searchParams.get('since') ?? new Date().toISOString()

  after(async () => {
    const result = await runHop(url, hop, since, secret)
    console.log(`[monday-worklist] hop ${hop}`, JSON.stringify(result))
  })
  return NextResponse.json({ accepted: true, hop, since }, { status: 202 })
}

async function runHop(url: URL, hop: number, since: string, secret: string | undefined): Promise<Record<string, unknown>> {
  const token = await getMondayToken()
  if (!token) return { skipped: 'No Monday token configured.' }

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

    const r = await ingestSlice(supabase, token, BUDGET_MS - (Date.now() - started), since)

    let chained: string | boolean = false
    if (r.remaining > 0) {
      const next = new URL(url.toString())
      next.searchParams.set('hop', String(hop + 1))
      next.searchParams.set('since', since)
      try {
        // Awaited: the next hop answers 202 before doing its work, so this
        // costs a second or two and guarantees the request left.
        const res = await fetch(next.toString(), {
          headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
          signal: AbortSignal.timeout(HANDOFF_MS),
        })
        chained = res.ok ? true : `next hop answered ${res.status}`
      } catch (e) {
        // A lost hop costs freshness until the next scheduled firing: the
        // queue is ordered by how stale a board is, so what was missed is
        // first in line next time.
        chained = `next hop not reached: ${(e as Error).message}`
      }
    }

    // The stale rule runs after every hop. It used to wait for the end of the
    // chain, and the end never came; judging after a hop cannot flip a board
    // back and forth, since each board is judged on its own last read against
    // a window of six months.
    let stale: { hidden: number; shown: number } | undefined
    const { data: settings } = await supabase
      .from('app_settings').select('monday_hide_stale_boards').eq('singleton_id', 1).maybeSingle()
    if ((settings as { monday_hide_stale_boards?: boolean } | null)?.monday_hide_stale_boards) {
      stale = await applyStaleRule(supabase)
    }

    return {
      hop,
      since,
      discovered,
      ...(stale ? { staleHidden: stale.hidden, staleShown: stale.shown } : {}),
      boards: r.done.length,
      items: r.done.reduce((s, b) => s + b.items, 0),
      assignments: r.done.reduce((s, b) => s + b.assignments, 0),
      remaining: r.remaining,
      seconds: Math.round(r.spentMs / 1000),
      chained,
    }
  } catch (e) {
    // Whatever finished is already saved, board by board. The next firing
    // resumes from the oldest, which is exactly where this stopped.
    return { hop, error: (e as Error).message, seconds: Math.round((Date.now() - started) / 1000) }
  }
}
