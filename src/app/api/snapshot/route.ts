/**
 * POST /api/snapshot, returns Monday board snapshots for the dashboards.
 *
 * Reads from the `monday_snapshot` warm store (populated nightly by
 * /api/cron/ingest), so the dashboards load instantly instead of fetching live
 * from Monday on every request. Boards not yet in the store fall back to a live
 * fetch, keeps things working before the first nightly run.
 *
 * Response shape is unchanged: { boards: [{ id, items, groups, activity }], _meta }.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BOARDS } from '@/lib/boards/config'
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

export async function POST(request: Request) {
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

  // Only boards this portal is configured to show. The ids arrive in the
  // request body, and a board missing from the store is fetched LIVE with the
  // portal's own Monday token, so without this any signed-in person could name
  // any board in the Monday account and have the portal fetch it for them
  // (audit finding M7-2). The allowlist is the dashboard config itself, so
  // adding a board to the product adds it here and nowhere else.
  const unknown = boards.filter(b => !BOARDS[String(b.id)]).map(b => String(b.id))
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
    for (const row of (data ?? []) as { board_id: string; data: BoardSnapshot; ingested_at: string }[]) {
      stored[row.board_id] = row.data
      if (!ingestedAt || row.ingested_at > ingestedAt) ingestedAt = row.ingested_at
    }
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'store read failed'
  }

  // 2) Boards missing from the store → live-fetch as a fallback.
  const missing = boards.filter((b) => !stored[b.id])
  let liveCount = 0
  if (missing.length > 0) {
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

  return NextResponse.json(
    {
      boards: results,
      _meta: { elapsedMs: elapsed, region, ingestedAt, fromStore: results.length - liveCount, live: liveCount, storeError },
    },
    {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'X-Snapshot-Region': region,
      },
    },
  )
}
