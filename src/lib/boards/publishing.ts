/**
 * boards/publishing.ts
 *
 * Pure computation for the Goals (Publishing) view, ported from the COE
 * Dashboard. No UI, no I/O, takes snapshot data + targets, returns structured
 * metrics the React components render.
 *
 * Two stages, mirroring the legacy flow:
 *   1. enrichPublishingBoard(), turn raw snapshot items + activity logs into
 *      PublishedItem[] (language, publishers, whether/when published).
 *   2. computePublishingMetrics(), one week of published items against that
 *      week's targets.
 */

import { BOARDS, type BoardConfig } from './config'
import type { SnapshotBoard, SnapshotColumnValue, SnapshotLog, TargetsMap } from './types'

export interface PublishedItem {
  id: string
  name: string
  boardId: string
  boardShort: string
  language: string
  publishers: string[]
  publishedDate: string | null
  isPublished: boolean
  // audit fields (parity with the COE "Copy audit" snapshot)
  currentStatusText: string | null
  logEventCount: number
  matchingEventCount: number
  isDoneWithoutEvent: boolean
  group: string | null
  isInExcludedGroup: boolean
  isStagedToPublish: boolean
}

/* ---------- Log/column helpers ---------- */

interface MondayLogData {
  pulse_id?: string | number
  column_id?: string
  column_type?: string
  previous_value?: { label?: { text?: string }; text?: string }
  value?: { label?: { text?: string }; text?: string }
}

interface Change {
  column_id: string | undefined
  created_at: string | null
  previous: string | null
  current: string | null
}

/** Monday activity-log timestamps are 100-nanosecond units (a huge integer),
 *  NOT ISO or ms, `new Date("17750831407806976")` silently yields Invalid Date.
 *  Convert to ISO. Passes through values that are already ISO. */
export function parseMondayLogTs(s: string | number | null): string | null {
  if (s == null) return null
  if (typeof s === 'string' && /T\d{2}:\d{2}/.test(s)) return s
  const n = typeof s === 'number' ? s : parseInt(String(s), 10)
  if (!isFinite(n) || n <= 0) return null
  return new Date(Math.round(n / 10000)).toISOString()
}

function colsById(cvs: SnapshotColumnValue[]): Record<string, SnapshotColumnValue> {
  const m: Record<string, SnapshotColumnValue> = {}
  for (const c of cvs) m[c.id] = c
  return m
}

function collectPeopleNames(byId: Record<string, SnapshotColumnValue>, peopleCols: string[]): Set<string> {
  const set = new Set<string>()
  for (const pcol of peopleCols || []) {
    const pc = byId[pcol]
    if (pc?.text) {
      pc.text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((n) => set.add(n))
    }
  }
  return set
}

/** Parse activity logs into per-item status/color column changes. */
function parseChanges(logs: SnapshotLog[]): Map<string, Change[]> {
  const byItem = new Map<string, Change[]>()
  for (const log of logs) {
    const ev = log.event
    if (ev !== 'update_column_value' && ev !== 'create_column_value') continue
    let data: MondayLogData = {}
    try {
      data = (typeof log.data === 'string' ? JSON.parse(log.data) : log.data || {}) as MondayLogData
    } catch {
      continue
    }
    const pid = data.pulse_id != null ? String(data.pulse_id) : null
    if (!pid) continue
    // Only status/color columns matter for the pipeline + published detection.
    if (data.column_type && data.column_type !== 'color' && data.column_type !== 'status') continue
    const arr = byItem.get(pid) || []
    arr.push({
      column_id: data.column_id,
      created_at: parseMondayLogTs(log.created_at),
      previous: data.previous_value?.label?.text ?? data.previous_value?.text ?? null,
      current: data.value?.label?.text ?? data.value?.text ?? null,
    })
    byItem.set(pid, arr)
  }
  return byItem
}

/* ---------- Stage 1: enrich ---------- */

/** Turn a publishing board's snapshot into PublishedItem[]. Non-publishing
 *  boards return []. */
export function enrichPublishingBoard(board: SnapshotBoard, config: BoardConfig): PublishedItem[] {
  if (!config.publishingMode) return []
  const changesByItem = parseChanges(board.activity)
  const out: PublishedItem[] = []

  for (const it of board.items) {
    const byId = colsById(it.column_values)
    const changes = changesByItem.get(String(it.id)) || []

    const language = (config.languageCol ? byId[config.languageCol]?.text : null) || '-'
    const publishers = config.publisherCol ? [...collectPeopleNames(byId, [config.publisherCol])] : []

    const targetLabel = config.publishedLabel || 'Done'
    const currentStatusText = config.publishedCol ? byId[config.publishedCol]?.text || null : null

    const allColChanges = config.publishedCol
      ? changes.filter((c) => c.column_id === config.publishedCol)
      : []
    const logEventCount = allColChanges.length
    const pubChanges = allColChanges
      .filter((c) => c.current === targetLabel)
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    const matchingEventCount = pubChanges.length

    let publishedDate: string | null = null
    let isPublished = false
    if (pubChanges.length) {
      publishedDate = pubChanges[pubChanges.length - 1].created_at
      isPublished = true
    }
    // Audit discrepancy: column reads as published but no log proves the transition.
    const isDoneWithoutEvent = currentStatusText === targetLabel && matchingEventCount === 0

    const group = it.group?.title || null
    const isInExcludedGroup = (config.excludedGroups || []).some(
      (n) => String(group || '').toLowerCase() === n.toLowerCase(),
    )

    // Reached the publishing stage, was touched, but hasn't shipped yet.
    const isStagedToPublish = !!currentStatusText && currentStatusText !== targetLabel && currentStatusText.trim() !== ''

    out.push({
      id: String(it.id),
      name: it.name,
      boardId: board.id,
      boardShort: config.short,
      language,
      publishers,
      publishedDate,
      isPublished,
      currentStatusText,
      logEventCount,
      matchingEventCount,
      isDoneWithoutEvent,
      group,
      isInExcludedGroup,
      isStagedToPublish,
    })
  }
  return out
}

/* ---------- Count one week against its targets ---------- */

export interface LangStat {
  lang: string
  perWeek: number
  done: number
  target: number
  pct: number
}

export interface BoardStat {
  boardId: string
  name: string
  short: string
  done: number
  target: number
  pct: number
  langs: LangStat[]
  /**
   * Published by a publisher in the week, in a language with no target (or
   * none at all). Not part of done or target: the score is against the
   * targeted languages, and these are shown beside it (decided 10 October 2026).
   */
  untargeted: number
}

/**
 * One week of published pages against that week's weekly targets.
 *
 * The week is the caller's: Monday to Sunday in New York (publishing-rules.ts).
 * An item counts once, on its last "Done", when one of its publishers is on the
 * list; one page published by two of them is still one page.
 */
export function computePublishingMetrics(
  items: PublishedItem[],
  targets: TargetsMap,
  from: Date,
  to: Date,
  isPublisher: (name: string | null | undefined) => boolean,
  /**
   * Board id -> languages paused on its site. Their pages are counted nowhere,
   * not even as "+N other", as on the dashboard (audit, 15 October 2026).
   */
  paused: Record<string, string[]> = {},
): { boards: BoardStat[] } {
  const data: Record<string, Record<string, number>> = {}
  const seen = new Set<string>()
  for (const it of items) {
    if (!BOARDS[it.boardId]?.publishingMode) continue
    if (!it.publishers.some(isPublisher)) continue
    if (!it.isPublished || !it.publishedDate) continue
    const d = new Date(it.publishedDate)
    if (d < from || d > to) continue
    // Monday can return an item twice when items change while it is read.
    const key = `${it.boardId}:${it.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const lang = it.language || '-'
    if (paused[it.boardId]?.includes(lang)) continue
    ;(data[it.boardId] ??= {})[lang] = (data[it.boardId][lang] || 0) + 1
  }

  const boards: BoardStat[] = []
  for (const [bid, langTargets] of Object.entries(targets)) {
    const config = BOARDS[bid]
    if (!config) continue
    let bTarget = 0
    let bDone = 0
    const langs: LangStat[] = []
    for (const [lang, perWeek] of Object.entries(langTargets)) {
      const done = data[bid]?.[lang] || 0
      langs.push({ lang, perWeek, done, target: perWeek, pct: perWeek ? Math.round((100 * done) / perWeek) : 0 })
      bTarget += perWeek
      bDone += done
    }
    const untargeted = Object.entries(data[bid] ?? {})
      .filter(([lang]) => !(lang in langTargets))
      .reduce((sum, [, n]) => sum + n, 0)
    boards.push({
      boardId: bid, name: config.name, short: config.short,
      done: bDone, target: bTarget, pct: bTarget ? Math.round((100 * bDone) / bTarget) : 0, langs, untargeted,
    })
  }
  return { boards }
}
