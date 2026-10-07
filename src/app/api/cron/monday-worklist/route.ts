/**
 * GET /api/cron/monday-worklist, keeping My Work current on its own.
 *
 * Runs on the same six-times-a-day schedule as the boards pull, so everything
 * that comes from Monday is as of the same moment. Anything else invites
 * "why does this page say something different from that one".
 *
 * WHY IT CHAINS. 197 boards do not fit in one invocation of 300 seconds (the
 * limit on Vercel, where this began, and still the route's maxDuration). One
 * firing therefore has to become several. Each
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
import { applyStaleRule } from '@/app/(app)/admin/settings/monday/actions'
import { notifyAfterSync, notifyUnlinked } from '@/lib/notifications/run'
import { acquireLease, releaseLease, startRun, finishRun, failedThisRun } from '@/lib/monday/worklist/sync-run'

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
 * Past this, the last hop does not start the notifications: they would race
 * the platform's 300-second stop. What they would have found is found by the
 * next firing (the dedupe keys make that safe), except the "assigned" events
 * of this one sync, which is the smaller loss than a hop killed mid-write.
 */
const NOTIFY_BEFORE_MS = 250_000

/**
 * How a hop hands on, since 21 September 2026. It used to fire the next
 * request without waiting and return; Vercel froze a function the moment it
 * returned, so that request was mostly never sent, and each firing read about
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
  const since = url.searchParams.get('since') ?? new Date().toISOString()
  if (hop >= LINKS) {
    after(async () => {
      await releaseLease(createAdminClient(), since)
      const n = await notifyAfterSync({ since, incomplete: { remaining: null, reason: `the chain hit its limit of ${LINKS} hops.` } })
      console.log('[monday-worklist] notifications', JSON.stringify(summary(n)))
    })
    return NextResponse.json({ stopped: `Chain hit its limit of ${LINKS} hops.` })
  }

  after(async () => {
    const result = await runHop(url, hop, since, secret)
    console.log(`[monday-worklist] hop ${hop}`, JSON.stringify(result))
  })
  return NextResponse.json({ accepted: true, hop, since }, { status: 202 })
}

/**
 * Where the next hop is sent: INTERNAL_ORIGIN on the portal's server
 * (http://127.0.0.1:3000, set in its Dockerfile), so the hop stays on the
 * machine. Sent to the public address instead, it left the container for
 * Cloudflare and never came back ("fetch failed", found on 5 October 2026), so
 * only the first hop ran. Locally the request's own origin is used.
 */
function nextHopUrl(url: URL): URL {
  const next = new URL(url.toString())
  const internal = process.env.INTERNAL_ORIGIN
  if (internal) {
    const base = new URL(internal)
    next.protocol = base.protocol
    next.host = base.host
  }
  return next
}

async function runHop(url: URL, hop: number, since: string, secret: string | undefined): Promise<Record<string, unknown>> {
  const token = await getMondayToken()
  if (!token) return { skipped: 'No Monday token configured.' }

  const supabase = createAdminClient()
  const started = Date.now()
  let discovered: unknown = null

  // One firing at a time (migration 091). Every hop of this firing may take the
  // lock again; a different firing that finds it held skips its turn, rather
  // than rewriting the same boards at the same moment.
  const lease = await acquireLease(supabase, since)
  if (!lease.ok) return { hop, since, skipped: `another sync (${lease.heldBy}) holds the lock until ${lease.until}` }
  const runId = await startRun(supabase, since, hop)
  let gone = 0

  try {
    // Head of the chain: refresh the map before reading the work.
    if (hop === 0) {
      const users = await syncMondayUsers(supabase, token)
      // A Monday account nobody in the Directory is (notification S5).
      await notifyUnlinked(supabase, users.unlinked)
      const boards = await syncMondayBoards(supabase, token)
      gone = boards.gone
      discovered = {
        accounts: users.users,
        linked: users.linkedByEmail,
        pending: users.unlinked.length,
        boards: boards.boards,
        stepsSeeded: boards.stepsSeeded,
        gone: boards.gone,
        back: boards.back,
        ...(boards.goneRefused ? { goneRefused: boards.goneRefused } : {}),
      }
    }

    // Boards that already failed in this firing are left for the next one.
    const skip = await failedThisRun(supabase, since)
    const r = await ingestSlice(supabase, token, BUDGET_MS - (Date.now() - started), since, skip)

    let chained: string | boolean = false
    if (r.remaining > 0) {
      const next = nextHopUrl(url)
      next.searchParams.set('hop', String(hop + 1))
      next.searchParams.set('since', since)
      try {
        // Awaited: the next hop answers 202 before doing its work, so this
        // costs a second or two and guarantees the request left. Redirects
        // are not followed and only our own "accepted" counts: a login page
        // answering 200 is how this failed unnoticed.
        const res = await fetch(next.toString(), {
          headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
          redirect: 'manual',
          signal: AbortSignal.timeout(HANDOFF_MS),
        })
        const body = res.status === 202 ? await res.json().catch(() => null) as { accepted?: boolean } | null : null
        chained = body?.accepted ? true : `next hop not accepted: ${res.status} ${res.headers.get('location') ?? ''}`.trim()
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

    // The end of the chain, whole or broken: what this sync found becomes
    // notifications. A chain that could not hand on is a sync that did not
    // finish, and admins hear about it (S2).
    let notifications: unknown = null
    if (r.remaining === 0 || chained !== true) {
      if (Date.now() - started < NOTIFY_BEFORE_MS) {
        const n = await notifyAfterSync({
          since,
          incomplete: r.remaining > 0 ? { remaining: r.remaining, reason: String(chained) } : undefined,
        })
        notifications = summary(n)
      } else {
        notifications = 'skipped: too close to the time limit'
      }
    }

    // The chain ends here, whole or broken: the next firing may start.
    if (r.remaining === 0 || chained !== true) await releaseLease(supabase, since)
    await finishRun(supabase, runId, {
      boards_read: r.done.length,
      items: r.done.reduce((s, b) => s + b.items, 0),
      assignments: r.done.reduce((s, b) => s + b.assignments, 0),
      remaining: r.remaining,
      failed: r.failed,
      gone,
      chained: typeof chained === 'string' ? chained : chained ? 'next hop accepted' : null,
    })

    return {
      hop,
      since,
      discovered,
      ...(stale ? { staleHidden: stale.hidden, staleShown: stale.shown } : {}),
      boards: r.done.length,
      failed: r.failed.map(f => `${f.name}: ${f.error.slice(0, 120)}`),
      items: r.done.reduce((s, b) => s + b.items, 0),
      assignments: r.done.reduce((s, b) => s + b.assignments, 0),
      remaining: r.remaining,
      seconds: Math.round(r.spentMs / 1000),
      chained,
      notifications,
    }
  } catch (e) {
    // Whatever finished is already saved, board by board. The next firing
    // resumes from the oldest, which is exactly where this stopped. The chain
    // ends here, so it is told as a sync that did not finish.
    const message = (e as Error).message
    await releaseLease(supabase, since)
    await finishRun(supabase, runId, { error: message.slice(0, 1000), gone })
    const n = Date.now() - started < NOTIFY_BEFORE_MS
      ? summary(await notifyAfterSync({ since, incomplete: { remaining: null, reason: message } }))
      : 'skipped: too close to the time limit'
    return { hop, error: message, seconds: Math.round((Date.now() - started) / 1000), notifications: n }
  }
}

/** What the log keeps of a notifications run: counts, not the rows. */
function summary(n: Awaited<ReturnType<typeof notifyAfterSync>>) {
  return { rows: n.rows ?? 0, byType: n.byType ?? {}, cleaned: n.cleaned ?? 0, skipped: n.skipped, failed: n.failed, error: n.error }
}
