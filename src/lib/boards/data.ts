/**
 * boards/data.ts
 *
 * Which Monday columns each board needs, from the BOARDS config, so the ingest
 * (api/cron/ingest) asks Monday for those and nothing more. Ported from the
 * COE (getBoardColumnIds etc.).
 */

import { BOARDS } from './config'

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
