/**
 * POST /api/snapshot — returns Monday board snapshots for the dashboards.
 *
 * Reads from the `monday_snapshot` warm store (populated nightly by
 * /api/cron/ingest), so the dashboards load instantly instead of fetching live
 * from Monday on every request. Boards not yet in the store fall back to a live
 * fetch — keeps things working before the first nightly run.
 *
 * Response shape is unchanged: { boards: [{ id, items, groups, activity }], _meta }.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processBoard, getMondayToken, type BoardReq, type BoardSnapshot } from '@/lib/monday/snapshot'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

// Fallback live-fetch window when a board isn't in the store yet.
const FALLBACK_LOG_DAYS = 180

/** Anon client for the public-read monday_snapshot store. Works locally and in
 *  prod without the service-role key (the cron writes with service role). */
function readClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
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
  const region = process.env.VERCEL_REGION || 'unknown'

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
