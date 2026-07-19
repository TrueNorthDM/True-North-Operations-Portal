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
 *   2. computePublishingMetrics(), aggregate published items vs targets into
 *      pace-vs-target numbers for the selected period.
 */

import { BOARDS, isPublisher, type BoardConfig } from './config'
import type { SnapshotBoard, SnapshotColumnValue, SnapshotLog, TargetsMap } from './types'

export type Period = 'week' | 'lastweek' | '2weeks' | 'month' | 'quarter' | 'all' | 'custom'

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

/* ---------- Date range + period → weeks ---------- */

/** Map a period (+ optional custom range) to concrete from/to dates. */
export function getDateRange(
  period: Period,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  if (period === 'all') return { from: null, to: null }
  let from: Date | null = null
  let to: Date | null = null
  if (period === 'week') {
    const monday = new Date(now)
    const day = monday.getDay()
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1))
    monday.setHours(0, 0, 0, 0)
    from = monday
    to = new Date(now)
  } else if (period === 'lastweek') {
    const monday = new Date(now)
    const day = monday.getDay()
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1) - 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 7)
    from = monday
    to = sunday
  } else if (period === '2weeks') {
    from = new Date(now.getTime() - 14 * 86400000)
    to = new Date(now)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now)
  } else if (period === 'quarter') {
    from = new Date(now.getTime() - 90 * 86400000)
    to = new Date(now)
  } else if (period === 'custom') {
    if (customFrom) from = new Date(customFrom)
    if (customTo) {
      to = new Date(customTo)
      to.setHours(23, 59, 59, 999)
    }
  }
  return { from, to }
}

/** Count how many calendar weeks (Mon→Sun) touch the month of a date. */
export function countWeeksInMonth(date: Date): number {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const dow1 = first.getDay() || 7
  const dow2 = last.getDay() || 7
  const mondayStart = new Date(first)
  mondayStart.setDate(first.getDate() - (dow1 - 1))
  const sundayEnd = new Date(last)
  sundayEnd.setDate(last.getDate() + (7 - dow2))
  return Math.round(((sundayEnd.getTime() - mondayStart.getTime()) / 86400000 + 1) / 7)
}

/** How many weeks the target should cover, plus a human label for the period.
 *  Targets are always the FULL period total, never pro-rated to elapsed time. */
export function computeWeeksFractional(
  period: Period,
  from: Date | null,
  to: Date | null,
): { weeks: number; label: string } {
  const periodTo = to ?? new Date()
  const daysInPeriod = from ? Math.max(0.5, (periodTo.getTime() - from.getTime()) / 86400000) : 90
  switch (period) {
    case 'week':
      return { weeks: 1, label: 'this week' }
    case 'lastweek':
      return { weeks: 1, label: 'last week' }
    case '2weeks':
      return { weeks: 2, label: 'last 2 weeks' }
    case 'month': {
      const w = countWeeksInMonth(from ?? new Date())
      return { weeks: w, label: `this month (${w}wk)` }
    }
    case 'quarter':
      return { weeks: 13, label: 'last quarter' }
    case 'all':
      return { weeks: 13, label: 'last 90d (ref.)' }
    case 'custom':
      return { weeks: daysInPeriod / 7, label: `custom (${daysInPeriod.toFixed(1)}d)` }
    default:
      return { weeks: daysInPeriod / 7, label: `${daysInPeriod.toFixed(1)} days` }
  }
}

/* ---------- Stage 2: aggregate vs targets ---------- */

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
}

export interface PublishingMetrics {
  periodLabel: string
  weeks: number
  totals: { done: number; target: number; pct: number }
  boards: BoardStat[]
}

/** Aggregate published items against per-board/language weekly targets. */
export function computePublishingMetrics(
  items: PublishedItem[],
  targets: TargetsMap,
  period: Period,
  from: Date | null,
  to: Date | null,
  boardFilter = 'all',
): PublishingMetrics {
  const periodTo = to ?? new Date()
  const periodFrom = from
  const { weeks, label } = computeWeeksFractional(period, from, to)

  // Group published items by board → language (same gates as the COE).
  const data: Record<string, Record<string, number>> = {}
  for (const it of items) {
    const config = BOARDS[it.boardId]
    if (!config?.publishingMode) continue
    if (boardFilter !== 'all' && it.boardId !== boardFilter) continue
    if (!it.publishers.some(isPublisher)) continue
    if (!it.isPublished || !it.publishedDate) continue
    const d = new Date(it.publishedDate)
    if (periodFrom && d < periodFrom) continue
    if (periodTo && d > periodTo) continue
    if (!data[it.boardId]) data[it.boardId] = {}
    const lang = it.language || '-'
    data[it.boardId][lang] = (data[it.boardId][lang] || 0) + 1
  }

  const boardEntries = Object.entries(targets).filter(([bid]) => boardFilter === 'all' || bid === boardFilter)
  let totalTarget = 0
  let totalDone = 0
  const boards: BoardStat[] = []

  for (const [bid, langTargets] of boardEntries) {
    const config = BOARDS[bid]
    if (!config) continue
    let bTarget = 0
    let bDone = 0
    const langs: LangStat[] = []
    for (const [lang, perWeek] of Object.entries(langTargets)) {
      const target = perWeek * weeks
      const done = data[bid]?.[lang] || 0
      const pct = target ? Math.round((100 * done) / target) : 0
      bTarget += target
      bDone += done
      langs.push({ lang, perWeek, done, target, pct })
    }
    const pct = bTarget ? Math.round((100 * bDone) / bTarget) : 0
    boards.push({ boardId: bid, name: config.name, short: config.short, done: bDone, target: bTarget, pct, langs })
    totalTarget += bTarget
    totalDone += bDone
  }

  const totalPct = totalTarget ? Math.round((100 * totalDone) / totalTarget) : 0
  return {
    periodLabel: label,
    weeks,
    totals: { done: totalDone, target: totalTarget, pct: totalPct },
    boards,
  }
}
