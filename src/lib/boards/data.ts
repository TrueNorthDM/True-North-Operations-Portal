/**
 * boards/data.ts
 *
 * Client-side data access for the Boards Review React view: builds the
 * /api/snapshot request from the BOARDS config (so Monday returns only the
 * columns we need) and fetches snapshot + targets.
 *
 * Column-id builders are ported from the COE (getBoardColumnIds etc.).
 */

import { BOARDS, ACTIVITY_LOG_DAYS } from './config'
import type { SnapshotResponse, TargetsMap } from './types'

export interface SnapshotBoardRequest {
  id: string
  short: string
  includeSubitems: boolean
  columnIds: string[]
  subitemColumnIds: string[] | null
  relevantLogColumnIds: string[]
}

/** Columns this board needs (stages, people, language, publishing, date). */
export function getBoardColumnIds(bid: string): string[] {
  const b = BOARDS[bid]
  if (!b) return []
  const set = new Set<string>()
  for (const s of b.stages || []) if (s.col) set.add(s.col)
  for (const c of b.peopleCols || []) if (c) set.add(c)
  if (b.languageCol) set.add(b.languageCol)
  if (b.publishedCol) set.add(b.publishedCol)
  if (b.publisherCol) set.add(b.publisherCol)
  if (b.dateCol) set.add(b.dateCol)
  if (b.hrefLinkCol) set.add(b.hrefLinkCol) // Href Link status — feeds the Run Link audit
  return [...set]
}

export function getBoardSubitemColumnIds(bid: string): string[] | null {
  const sp = BOARDS[bid]?.subitemPipeline
  if (!sp) return null
  const set = new Set<string>()
  for (const s of sp.stages || []) if (s.col) set.add(s.col)
  for (const c of sp.peopleCols || []) if (c) set.add(c)
  if (sp.languageCol) set.add(sp.languageCol)
  return [...set]
}

/** Columns whose activity logs matter (stages + published + subitem stages). */
export function getBoardLogRelevantColumnIds(bid: string): string[] {
  const b = BOARDS[bid]
  if (!b) return []
  const set = new Set<string>()
  for (const s of b.stages || []) if (s.col) set.add(s.col)
  if (b.publishedCol) set.add(b.publishedCol)
  if (b.subitemPipeline) for (const s of b.subitemPipeline.stages || []) if (s.col) set.add(s.col)
  return [...set]
}

export function buildSnapshotRequest(boardIds: string[]): { boards: SnapshotBoardRequest[]; since: string } {
  const since = new Date(Date.now() - ACTIVITY_LOG_DAYS * 86400000).toISOString()
  const boards = boardIds
    .filter((bid) => BOARDS[bid])
    .map((bid) => ({
      id: bid,
      short: BOARDS[bid].short,
      includeSubitems: !!BOARDS[bid].subitemPipeline,
      columnIds: getBoardColumnIds(bid),
      subitemColumnIds: getBoardSubitemColumnIds(bid),
      relevantLogColumnIds: getBoardLogRelevantColumnIds(bid),
    }))
  return { boards, since }
}

/** POST /api/snapshot for the given boards. Throws on non-2xx. */
export async function fetchSnapshot(boardIds: string[]): Promise<SnapshotResponse> {
  const r = await fetch('/api/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSnapshotRequest(boardIds)),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Snapshot ${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json()
}

/** GET /api/targets. Returns {} on failure so callers can fall back gracefully. */
export async function fetchTargets(): Promise<TargetsMap> {
  try {
    const r = await fetch('/api/targets', { cache: 'no-store' })
    if (!r.ok) return {}
    return await r.json()
  } catch {
    return {}
  }
}
