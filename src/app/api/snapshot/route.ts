/**
 * POST /api/snapshot — server-side aggregation of all Monday boards in one call.
 *
 * Ported from the COE Dashboard (api/snapshot.js) into the unified portal.
 *
 * Why it exists:
 *   The Boards Review dashboard used to make ~40 individual browser→Monday
 *   calls per load (one per items page, one per activity-log chunk, per board),
 *   each paying browser↔server RTT + the occasional cold start. Total: 3min+.
 *   This function does it all in parallel SERVER-SIDE (Vercel↔Monday ~20ms RTT),
 *   trims what the browser doesn't need, and returns a single response.
 *
 * Cache:
 *   60s CDN cache (s-maxage) + 5min stale-while-revalidate.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Hobby allows up to 60s. First load (1500+ items + log chunks per board)
// can approach it; the HTTP cache covers subsequent calls.
export const runtime = 'nodejs'
export const maxDuration = 60
// CRITICAL: pin to iad1 (US-East), next to Monday + Supabase. This function makes
// ~40 calls to Monday (US). In gru1 (São Paulo) each paid ~150ms transatlantic
// × 40 → timeout. The COE app pinned this via vercel.json; in the App Router we
// pin it per-route with preferredRegion.
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const MONDAY_URL = 'https://api.monday.com/v2'

interface MondayColumnValue {
  id: string
  type: string
  text: string | null
  value: string | null
}
interface MondaySubitem {
  id: string
  name: string
  column_values: MondayColumnValue[]
}
interface MondayItem {
  id: string
  name: string
  created_at: string
  updated_at: string
  state: string
  group: { id: string; title: string } | null
  column_values: MondayColumnValue[]
  subitems?: MondaySubitem[]
}
interface MondayGroup {
  id: string
  title: string
}
interface ItemsPage {
  cursor: string | null
  items: MondayItem[]
}
interface MondayLog {
  id: string
  event: string
  created_at: string
  data: string
}
interface MondayBoard {
  id: string
  name: string
  groups?: MondayGroup[]
  items_page?: ItemsPage
  activity_logs?: MondayLog[]
}

interface BoardReq {
  id: string
  short?: string
  includeSubitems?: boolean
  columnIds?: string[]
  subitemColumnIds?: string[]
  relevantLogColumnIds?: string[]
}

/* ---------- Monday call helper ---------- */

/* Retry with exponential backoff to absorb transient Monday failures (503/502/
   429 and network errors like TCP reset / timeout-before-response). GraphQL
   errors in the body are NOT retried — those are deterministic query bugs. */
async function mondayCall<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  label = '',
  attempt = 1,
): Promise<T> {
  const MAX_ATTEMPTS = 4
  const RETRY_STATUSES = new Set([429, 500, 502, 503, 504])

  try {
    const r = await fetch(MONDAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      if (RETRY_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS) {
        const wait = Math.min(8000, 500 * Math.pow(2, attempt - 1)) // 500, 1000, 2000, 4000
        console.warn(`[snapshot ${label}] HTTP ${r.status} attempt ${attempt}, retrying in ${wait}ms`)
        await new Promise((res) => setTimeout(res, wait))
        return mondayCall<T>(token, query, variables, label, attempt + 1)
      }
      throw new Error(`Monday HTTP ${r.status}${label ? ` [${label}]` : ''}: ${text.slice(0, 200)}`)
    }

    const data = await r.json()
    if (data.errors) {
      throw new Error(`Monday GraphQL${label ? ` [${label}]` : ''}: ${JSON.stringify(data.errors).slice(0, 300)}`)
    }
    return data.data as T
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string })?.code
    const isNetworkError =
      !msg.includes('Monday GraphQL') &&
      (code != null || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|terminated|network/i.test(msg))
    if (isNetworkError && attempt < MAX_ATTEMPTS) {
      const wait = Math.min(8000, 500 * Math.pow(2, attempt - 1))
      console.warn(`[snapshot ${label}] network error attempt ${attempt} (${msg.slice(0, 80)}), retrying in ${wait}ms`)
      await new Promise((res) => setTimeout(res, wait))
      return mondayCall<T>(token, query, variables, label, attempt + 1)
    }
    throw err
  }
}

/* ---------- Items (paginated) ---------- */

async function fetchBoardItems(
  token: string,
  boardId: string,
  columnIds: string[] | undefined,
  subitemColumnIds: string[] | undefined,
  includeSubitems: boolean,
  label: string,
): Promise<{ items: MondayItem[]; groups: MondayGroup[] }> {
  // Adaptive pageSize: 500 for plain boards (Publishing), 100 for boards with
  // subitems (Translation) since nested subitems explode the payload.
  const pageSize = includeSubitems ? 100 : 500

  const subitemFragment = includeSubitems
    ? `
    subitems {
      id name
      column_values${subitemColumnIds && subitemColumnIds.length ? `(ids: ${JSON.stringify(subitemColumnIds)})` : ''} {
        id type text value
      }
    }`
    : ''

  // Fetch only the columns the dashboard needs — drastically reduces payload.
  const colsArg = columnIds && columnIds.length ? `(ids: ${JSON.stringify(columnIds)})` : ''

  const firstQ = `query ($boardId: [ID!], $limit: Int) {
    boards(ids: $boardId) {
      id name
      groups { id title }
      items_page(limit: $limit) {
        cursor
        items {
          id name created_at updated_at state
          group { id title }
          column_values${colsArg} { id type text value }
          ${subitemFragment}
        }
      }
    }
  }`

  const first = await mondayCall<{ boards: MondayBoard[] }>(
    token,
    firstQ,
    { boardId: [boardId], limit: pageSize },
    `${label} items page 0`,
  )
  const board = first.boards?.[0]
  if (!board) return { items: [], groups: [] }

  const items: MondayItem[] = [...(board.items_page?.items || [])]
  const groups = board.groups || []
  let cursor = board.items_page?.cursor

  const nextQ = `query ($cursor: String!, $limit: Int) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id name created_at updated_at state
        group { id title }
        column_values${colsArg} { id type text value }
        ${subitemFragment}
      }
    }
  }`

  let guard = 0
  while (cursor && guard < 200) {
    const nxt = await mondayCall<{ next_items_page: ItemsPage | null }>(
      token,
      nextQ,
      { cursor, limit: pageSize },
      `${label} items page ${guard + 1}`,
    )
    const page = nxt.next_items_page
    if (!page) break
    cursor = page.cursor
    items.push(...(page.items || []))
    guard++
    if (!page.items || page.items.length === 0) break
  }

  return { items, groups }
}

/* ---------- Activity logs (parallel chunks) ---------- */

async function fetchBoardActivity(
  token: string,
  boardId: string,
  sinceIso: string,
  relevantColumnIds: string[] | undefined,
  label: string,
): Promise<MondayLog[]> {
  const q = `query ($boardId: [ID!], $from: ISO8601DateTime, $to: ISO8601DateTime, $limit: Int) {
    boards(ids: $boardId) {
      activity_logs(from: $from, to: $to, limit: $limit) {
        id event created_at data
      }
    }
  }`
  const CHUNK_DAYS = 30
  const CONCURRENCY = 3
  const sinceMs = new Date(sinceIso).getTime()
  const nowMs = Date.now()

  // 1) Build the chunk list
  const chunks: { idx: number; from: string; to: string }[] = []
  let chunkStart = sinceMs
  let idx = 0
  while (chunkStart < nowMs) {
    const chunkEnd = Math.min(chunkStart + CHUNK_DAYS * 86400000, nowMs)
    chunks.push({ idx, from: new Date(chunkStart).toISOString(), to: new Date(chunkEnd).toISOString() })
    chunkStart = chunkEnd
    idx++
  }

  // 2) Worker pool
  const relevantSet = relevantColumnIds && relevantColumnIds.length ? new Set(relevantColumnIds) : null
  const out: MondayLog[] = []
  let nextIdx = 0
  let failed = 0

  async function worker(): Promise<void> {
    let myIdx = nextIdx++
    while (myIdx < chunks.length) {
      const c = chunks[myIdx]
      try {
        const r = await mondayCall<{ boards: MondayBoard[] }>(
          token,
          q,
          { boardId: [boardId], from: c.from, to: c.to, limit: 10000 },
          `${label} log chunk ${c.idx}`,
        )
        const logs = r.boards?.[0]?.activity_logs || []

        // Server-side filter: keep only logs the browser actually uses.
        for (const log of logs) {
          if (!log || !log.event) continue
          if (log.event === 'move_pulse_into_group' || log.event === 'create_pulse') {
            out.push(log)
            continue
          }
          if (log.event === 'update_column_value' || log.event === 'create_column_value') {
            if (!relevantSet) {
              out.push(log)
              continue
            }
            let cid: string | null = null
            try {
              const parsed = typeof log.data === 'string' ? JSON.parse(log.data) : log.data || {}
              cid = parsed?.column_id ?? null
            } catch {
              /* ignore malformed log.data */
            }
            if (cid && relevantSet.has(cid)) out.push(log)
          }
        }
      } catch (e) {
        failed++
        console.error(`[snapshot ${label}] chunk ${c.idx} FAILED:`, e instanceof Error ? e.message : e)
      }
      myIdx = nextIdx++
    }
  }

  const workerCount = Math.min(CONCURRENCY, chunks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  if (failed > 0) {
    console.warn(`[snapshot ${label}] ${failed}/${chunks.length} log chunks failed`)
  }
  return out
}

/* ---------- Process one board (items + activity in parallel) ---------- */

async function processBoard(token: string, boardReq: BoardReq & { since: string }) {
  const { id, columnIds, subitemColumnIds, includeSubitems, since, relevantLogColumnIds, short } = boardReq
  const label = short || id

  const [itemsData, activity] = await Promise.all([
    fetchBoardItems(token, id, columnIds, subitemColumnIds, !!includeSubitems, label),
    fetchBoardActivity(token, id, since, relevantLogColumnIds, label),
  ])

  return { id, items: itemsData.items, groups: itemsData.groups, activity }
}

/* ---------- HTTP handler ---------- */

/**
 * Resolve the Monday API token. Primary source is the Settings page
 * (app_settings.monday_api_token) — the same token the Monday webhook uses, so
 * the whole portal shares one token managed in one place. Falls back to the
 * MONDAY_TOKEN env var (handy for local dev without the service-role key).
 */
async function getMondayToken(): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_settings')
      .select('monday_api_token')
      .eq('singleton_id', 1)
      .maybeSingle<{ monday_api_token: string | null }>()
    if (data?.monday_api_token) return data.monday_api_token
  } catch {
    // Admin client unavailable (e.g. no SUPABASE_SERVICE_ROLE_KEY locally) —
    // fall through to the env-var fallback.
  }
  return process.env.MONDAY_TOKEN ?? null
}

export async function POST(request: Request) {
  const MONDAY_TOKEN = await getMondayToken()
  if (!MONDAY_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Monday API token not configured — set it on the Settings page (app_settings.monday_api_token) or via the MONDAY_TOKEN env var.',
      },
      { status: 500 },
    )
  }

  let body: { boards?: BoardReq[]; since?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { boards, since } = body
  if (!Array.isArray(boards) || boards.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "boards" in request body' }, { status: 400 })
  }
  if (!since) {
    return NextResponse.json({ error: 'Missing "since" (ISO 8601 timestamp)' }, { status: 400 })
  }

  const t0 = Date.now()
  try {
    // All boards in parallel — server has no browser HTTP/2 limit, and Monday
    // handles ~5-10 concurrent requests per token comfortably.
    const results = await Promise.all(boards.map((b) => processBoard(MONDAY_TOKEN, { ...b, since })))

    const elapsed = Date.now() - t0
    const region = process.env.VERCEL_REGION || 'unknown'
    const payload = { boards: results, _meta: { elapsedMs: elapsed, region } }
    const json = JSON.stringify(payload)
    console.log(`[snapshot] OK · ${elapsed}ms · ${(json.length / 1024).toFixed(1)} KB · ${results.length} boards · region=${region}`)

    return new Response(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'Server-Timing': `total;dur=${elapsed}`,
        'X-Snapshot-Region': region,
      },
    })
  } catch (err) {
    console.error('[snapshot] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Snapshot failed', elapsedMs: Date.now() - t0 },
      { status: 502 },
    )
  }
}
