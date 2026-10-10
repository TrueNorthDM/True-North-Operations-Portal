/**
 * POST /api/snapshot, returns Monday board snapshots for the dashboards.
 *
 * Reads from the `monday_snapshot` warm store (written every four hours by
 * /api/cron/ingest), so the dashboard loads instantly instead of fetching live
 * from Monday on every request.
 *
 * Called by the Publishing Goals dashboard (public/boards.html, framed on
 * /ops/publishing) for everyone with that tool. From 7 to 10 October 2026 it
 * answered Super Admins only, on the belief that nothing called it, and the
 * dashboard failed for everybody else (audit, 10 October 2026). A board not in
 * the store yet is fetched live only for a Super Admin: that spends the
 * portal's Monday token on request.
 *
 * Response shape is unchanged: { boards: [{ id, items, groups, activity }], _meta }.
 */

import { NextResponse } from 'next/server'
import { isSuperAdmin, loadAccess, verifiedSession } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { processBoard, getMondayToken, type BoardReq, type BoardSnapshot } from '@/lib/monday/snapshot'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

// Fallback live-fetch window when a board isn't in the store yet.
const FALLBACK_LOG_DAYS = 180

/**
 * Service-role client for the snapshot store.
 *
 * This used to be the anon client, described as reading a "public-read" store,
 * and it was: monday_snapshot's policy said `FOR SELECT USING (true)` with no
 * TO clause, which in Postgres means TO PUBLIC, which includes anon. The whole
 * of both boards, 14 MB of item names, assignees and activity, was downloadable
 * by anyone holding the anon key out of the JS bundle. Migration 055 locks the
 * table to authenticated; reading it here with service_role is what lets that
 * lock exist (audit finding M7-1).
 */
function readClient() {
  return createAdminClient()
}

/** Whoever may open Publishing Goals, as the page itself decides it. */
async function mayRead(): Promise<boolean> {
  if (!(await verifiedSession())) return false
  return (await loadAccess()).canTool('publishing')
}

const FAILED = 'The boards could not be read. Try again in a moment.'

export async function POST(request: Request) {
  if (!(await mayRead())) return NextResponse.json({ error: 'Publishing Goals is not open to your access.' }, { status: 403 })
  let body: { boards?: BoardReq[]; since?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { boards } = body
  if (!Array.isArray(boards) || boards.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "boards" in request body' }, { status: 400 })
  }

  // Only the publishing boards. The ids arrive in the request body, so without
  // this a reader could name any board the portal knows (audit finding M7-2).
  const unknown = boards.filter(b => !PUBLISHING_BOARD_IDS.includes(String(b.id))).map(b => String(b.id))
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown board(s): ${unknown.join(', ')}` }, { status: 400 })
  }

  const t0 = Date.now()
  const boardIds = boards.map((b) => b.id)
  const stored: Record<string, BoardSnapshot> = {}
  let storeError: string | null = null
  let ingestedAt: string | null = null

  // 1) Read what the nightly cron has stored.
  try {
    const supabase = readClient()
    const { data, error } = await supabase
      .from('monday_snapshot')
      .select('board_id, data, ingested_at')
      .in('board_id', boardIds)
    if (error) storeError = error.message
    // data is the JSON column the ingest wrote from a BoardSnapshot.
    for (const row of (data ?? []) as unknown as { board_id: string; data: BoardSnapshot; ingested_at: string }[]) {
      stored[row.board_id] = row.data
      // The older of the boards: the only time true of everything shown.
      if (!ingestedAt || row.ingested_at < ingestedAt) ingestedAt = row.ingested_at
    }
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'store read failed'
  }

  // 2) Boards missing from the store → live-fetch as a fallback.
  const missing = boards.filter((b) => !stored[b.id])
  let liveCount = 0
  if (missing.length > 0 && (await isSuperAdmin())) {
    const token = await getMondayToken()
    if (token) {
      const since = new Date(Date.now() - FALLBACK_LOG_DAYS * 86400000).toISOString()
      try {
        const live = await Promise.all(missing.map((b) => processBoard(token, { ...b, since })))
        for (const snap of live) stored[snap.id] = snap
        liveCount = live.length
      } catch (e) {
        if (!storeError) storeError = e instanceof Error ? e.message : 'live fetch failed'
      }
    }
  }

  const results = boardIds.map((id) => stored[id]).filter(Boolean)
  const elapsed = Date.now() - t0
  const region = 'tn-server'
  // The detail goes to the server log; the dashboard gets a sentence.
  if (storeError) console.error('[snapshot]', storeError)
  if (results.length === 0 && storeError) return NextResponse.json({ error: FAILED }, { status: 500 })

  return NextResponse.json(
    {
      boards: results,
      _meta: { elapsedMs: elapsed, region, ingestedAt, fromStore: results.length - liveCount, live: liveCount, storeError: storeError ? FAILED : null },
    },
    {
      // Private: the answer depends on who asks, so no shared cache keeps it.
      headers: { 'Cache-Control': 'private, no-store', 'X-Snapshot-Region': region },
    },
  )
}
