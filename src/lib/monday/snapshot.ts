/**
 * monday/snapshot.ts
 *
 * Server-side Monday board fetching, extracted from /api/snapshot so it can be
 * shared by the live endpoint AND the nightly ingestion cron. Fetches items
 * (paginated) + activity logs (parallel chunks) with retry/backoff.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const MONDAY_URL = 'https://api.monday.com/v2'

export interface MondayColumnValue {
  id: string
  type: string
  text: string | null
  value: string | null
}
export interface MondaySubitem {
  id: string
  name: string
  column_values: MondayColumnValue[]
}
export interface MondayItem {
  id: string
  name: string
  created_at: string
  updated_at: string
  state: string
  group: { id: string; title: string } | null
  column_values: MondayColumnValue[]
  subitems?: MondaySubitem[]
}
export interface MondayGroup {
  id: string
  title: string
}
interface ItemsPage {
  cursor: string | null
  items: MondayItem[]
}
export interface MondayLog {
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

export interface BoardReq {
  id: string
  short?: string
  includeSubitems?: boolean
  columnIds?: string[]
  subitemColumnIds?: string[]
  relevantLogColumnIds?: string[]
}

export interface BoardSnapshot {
  id: string
  items: MondayItem[]
  groups: MondayGroup[]
  activity: MondayLog[]
}

/* ---------- Monday call helper ---------- */

/* Retry with exponential backoff for transient Monday failures (503/502/429 and
   network errors). GraphQL errors in the body are NOT retried, deterministic. */
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
        const wait = Math.min(8000, 500 * Math.pow(2, attempt - 1))
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

  const chunks: { idx: number; from: string; to: string }[] = []
  let chunkStart = sinceMs
  let idx = 0
  while (chunkStart < nowMs) {
    const chunkEnd = Math.min(chunkStart + CHUNK_DAYS * 86400000, nowMs)
    chunks.push({ idx, from: new Date(chunkStart).toISOString(), to: new Date(chunkEnd).toISOString() })
    chunkStart = chunkEnd
    idx++
  }

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

export async function processBoard(token: string, boardReq: BoardReq & { since: string }): Promise<BoardSnapshot> {
  const { id, columnIds, subitemColumnIds, includeSubitems, since, relevantLogColumnIds, short } = boardReq
  const label = short || id

  const [itemsData, activity] = await Promise.all([
    fetchBoardItems(token, id, columnIds, subitemColumnIds, !!includeSubitems, label),
    fetchBoardActivity(token, id, since, relevantLogColumnIds, label),
  ])

  return { id, items: itemsData.items, groups: itemsData.groups, activity }
}

/**
 * Resolve the Monday API token. Primary source is the Settings page
 * (app_settings.monday_api_token), the same token the webhook + cron use, so
 * the whole portal shares one token managed in one place. Falls back to the
 * MONDAY_TOKEN env var (handy for local dev without the service-role key).
 */
export async function getMondayToken(): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_settings')
      .select('monday_api_token')
      .eq('singleton_id', 1)
      .maybeSingle<{ monday_api_token: string | null }>()
    if (data?.monday_api_token) return data.monday_api_token
  } catch {
    // Admin client unavailable (e.g. no SUPABASE_SERVICE_ROLE_KEY locally).
  }
  return process.env.MONDAY_TOKEN ?? null
}
