/**
 * GET /api/cron/ingest, Monday → monday_snapshot ingestion, every four hours.
 *
 * Run by the server's crontab (deploy/cron/portal.crontab). Fetches the Publishing boards from
 * Monday (using the token from Settings) and writes them to the warm store, so
 * /api/snapshot (and therefore the dashboards) load instantly.
 *
 * Window: a rolling INGEST_DAYS (3 years). Each run does a full re-fetch and
 * OVERWRITES the store, so it always holds exactly the last 3 years, no
 * pruning needed. maxDuration 300s covers it comfortably (1yr took ~48s).
 *
 * A board that cannot be read whole keeps the snapshot it had, and the run
 * answers 500 so the cron log says FAIL (audit, 10 October 2026): a partial
 * read used to overwrite the good one and answer 200.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import type { Json } from '@/lib/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { processBoard, getMondayToken } from '@/lib/monday/snapshot'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { getBoardColumnIds, getBoardSubitemColumnIds, getBoardLogRelevantColumnIds } from '@/lib/boards/data'
import { compactPublished } from '@/lib/boards/published-items'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const INGEST_DAYS = 1095 // 3 years (rolling)

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await getMondayToken()
  if (!token) {
    return NextResponse.json({ error: 'Monday token not configured (Settings → Monday API).' }, { status: 500 })
  }

  const since = new Date(Date.now() - INGEST_DAYS * 86400000).toISOString()
  const supabase = createAdminClient()
  const t0 = Date.now()

  const results = await Promise.all(
    PUBLISHING_BOARD_IDS.map(async (bid) => {
      const short = BOARDS[bid].short
      try {
        const snap = await processBoard(token, {
          id: bid,
          short,
          since,
          includeSubitems: !!BOARDS[bid].subitemPipeline,
          columnIds: getBoardColumnIds(bid),
          subitemColumnIds: getBoardSubitemColumnIds(bid) ?? undefined,
          relevantLogColumnIds: getBoardLogRelevantColumnIds(bid),
        })
        // The published facts go in the same write as the snapshot they were
        // taken from, so the Home card can never count a different snapshot
        // than the dashboard shows. See migration 081.
        const row = { board_id: bid, data: snap as unknown as Json, ingested_at: new Date().toISOString() }
        let { error } = await supabase
          .from('monday_snapshot')
          .upsert({ ...row, published_items: compactPublished(snap, BOARDS[bid], new Date()) as unknown as Json }, { onConflict: 'board_id' })
        // Deployed before migration 081 was applied, the column does not exist
        // and PostgREST rejects the whole row. Losing the snapshot to protect
        // an optimisation would freeze both publishing dashboards, so the
        // snapshot is written without the facts and Home keeps its slow path
        // until the column exists.
        if (error && /published_items/.test(error.message)) {
          console.warn('[ingest] published_items column missing, apply migration 081:', error.message)
          ;({ error } = await supabase.from('monday_snapshot').upsert(row, { onConflict: 'board_id' }))
        }
        if (error) throw new Error(error.message)
        return { board: short, items: snap.items.length, logs: snap.activity.length, ok: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'failed'
        console.error(`[ingest] ${short} kept its previous snapshot: ${message}`)
        return { board: short, items: 0, logs: 0, ok: false, error: message }
      }
    }),
  )

  const ok = results.every((r) => r.ok)
  return NextResponse.json({
    ok,
    elapsedMs: Date.now() - t0,
    windowDays: INGEST_DAYS,
    results,
  }, { status: ok ? 200 : 500 })
}
