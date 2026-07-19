/**
 * GET /api/targets, reads publishing targets from Supabase.
 *
 * Ported from the COE Dashboard (api/targets.js) into the unified portal.
 *
 * Returns a nested map compatible with the dashboard's old PUBLISHING_TARGETS
 * shape (zero refactor downstream):
 *   { "6691665827": { "English": 5, "Swahili": 5 }, ... }
 *
 * NOTE: the `publishing_targets` table lands in the portal's Supabase in a
 * later migration step. Until then this returns a 502, and the dashboard falls
 * back to its hardcoded PUBLISHING_TARGETS_FALLBACK, so wiring it now is safe.
 *
 * Cache: 5min CDN cache + 24h stale-while-revalidate.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10
// Supabase is in us-east-1 (North Virginia), keep this function next to it.
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

interface TargetRow {
  board_id: string
  language: string
  target_value: number
}

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
      { status: 500 },
    )
  }

  try {
    // Read only weekly targets for now. When quarterly targets land, read both
    // and let the browser pick based on the active period.
    const url = `${SUPABASE_URL}/rest/v1/publishing_targets?select=board_id,language,target_value&period_type=eq.weekly`
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new Error(`Supabase HTTP ${r.status}: ${text.slice(0, 200)}`)
    }

    const rows = (await r.json()) as TargetRow[]

    // Transform the flat array into a nested map { boardId: { language: target } }
    const map: Record<string, Record<string, number>> = {}
    for (const row of rows) {
      if (!map[row.board_id]) map[row.board_id] = {}
      map[row.board_id][row.language] = row.target_value
    }

    return new Response(JSON.stringify(map), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[/api/targets] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Targets fetch failed' }, { status: 502 })
  }
}
