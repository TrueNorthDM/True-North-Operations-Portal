/**
 * boards/translation.ts
 *
 * Pure computation for the Translation view, ported from the COE Dashboard
 * (evalPipeline + enrichItem). Turns a snapshot board into TranslationItem[]
 * with the current pipeline stage, owners, subitem (per-language) progress,
 * and time-in-stage — no UI, no I/O.
 */

import { BOARDS, labelSemantic, type BoardConfig, type BoardStage, type LabelSemantic } from './config'
import { parseMondayLogTs } from './publishing'
import type { SnapshotBoard, SnapshotColumnValue, SnapshotItem, SnapshotSubitem, SnapshotLog } from './types'

export type StatusKind = 'done' | 'progress' | 'pending' | 'stuck' | 'warn'

export interface StageResult {
  col: string | null
  name: string
  skipped: boolean
  value: string
  semantic: LabelSemantic
  owners: string[]
}

export interface SubitemResult {
  id: string
  name: string
  language: string
  pipeline: StageResult[]
  currentStage: StageResult | null
  isDone: boolean
  doneDate: string | null
  peopleNames: string[]
}

export interface TranslationItem {
  id: string
  name: string
  boardId: string
  boardName: string
  boardShort: string
  stageName: string
  stageValue: string
  statusKind: StatusKind
  isDone: boolean
  currentOwners: string[]
  people: string[]
  group: string | null
  pipeline: StageResult[]
  subitems: SubitemResult[]
  subitemProgress: { done: number; total: number } | null
  workStart: string | null
  stageStart: string | null
  /** Calendar days in the current stage / since work started (UI may convert to business days). */
  stageDays: number | null
  workDays: number | null
  doneDate: string | null
}

/* ---------- Low-level helpers ---------- */

interface MondayLogData {
  pulse_id?: string | number
  column_id?: string
  column_type?: string
  group_id?: string | number
  previous_value?: { label?: { text?: string }; text?: string }
  value?: { label?: { text?: string }; text?: string }
}

interface Change {
  column_id: string | undefined
  created_at: string | null
  previous: string | null
  current: string | null
}

interface GroupMove {
  group_id: string
  created_at: string | null
}

export function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (isNaN(ta) || isNaN(tb)) return null
  return (tb - ta) / 86400000
}

/** Calendar days → business days (rough 5/7 factor, matching the COE). */
export function businessDays(days: number | null): number | null {
  return days == null || isNaN(days) ? null : days * (5 / 7)
}

export function fmtDays(d: number | null): string {
  if (d == null || isNaN(d)) return '—'
  if (d < 1) return `${Math.round(d * 24)}h`
  return `${d.toFixed(1)}d`
}

function colsById(cvs: SnapshotColumnValue[]): Record<string, SnapshotColumnValue> {
  const m: Record<string, SnapshotColumnValue> = {}
  for (const c of cvs || []) m[c.id] = c
  return m
}

function collectPeopleNames(byId: Record<string, SnapshotColumnValue>, peopleCols: string[]): Set<string> {
  const set = new Set<string>()
  for (const pcol of peopleCols || []) {
    const pc = byId[pcol]
    if (pc?.text) pc.text.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => set.add(n))
  }
  return set
}

function resolveStageOwners(byId: Record<string, SnapshotColumnValue>, st: BoardStage): string[] {
  const out: string[] = []
  if (st.ownerFixed) out.push(st.ownerFixed)
  if (st.ownerCol) {
    const pc = byId[st.ownerCol]
    if (pc?.text) pc.text.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => out.push(n))
  }
  return out
}

/** Map a status label to the UI "kind" used for chips/colors. */
function statusClass(label = ''): StatusKind {
  const map: Record<LabelSemantic, StatusKind> = {
    complete: 'done',
    skipped: 'done',
    active: 'progress',
    notstarted: 'pending',
    stuck: 'stuck',
    waiting: 'warn',
  }
  return map[labelSemantic(label)] || 'pending'
}

/**
 * Evaluate a stage list against an item's column values: which stages apply,
 * which is current (first non-complete), and whether all are done. Resolves
 * owners (ownerFixed / ownerCol) per stage. Honors gate (skipIf) + requires.
 */
function evalPipeline(
  byId: Record<string, SnapshotColumnValue>,
  stages: BoardStage[],
): { applicable: StageResult[]; currentStage: StageResult | null; isDone: boolean } {
  const applicable: StageResult[] = []
  for (const st of stages || []) {
    if (st.gate) {
      const gateVal = byId[st.gate.col]?.text || ''
      if (gateVal === st.gate.skipIf) {
        applicable.push({ col: st.col, name: st.name, skipped: true, value: '(not needed)', semantic: 'skipped', owners: [] })
        continue
      }
    }
    if (st.requires) {
      const reqVal = byId[st.requires.col]?.text || ''
      if (reqVal !== st.requires.value) {
        applicable.push({ col: st.col, name: st.name, skipped: true, value: '(not applicable)', semantic: 'skipped', owners: [] })
        continue
      }
    }
    const val = byId[st.col]?.text || ''
    applicable.push({ col: st.col, name: st.name, skipped: false, value: val, semantic: labelSemantic(val), owners: resolveStageOwners(byId, st) })
  }
  const done = (s: StageResult) => s.skipped || s.semantic === 'complete' || s.semantic === 'skipped'
  const currentStage = applicable.find((s) => !done(s)) || null
  const isDone = applicable.length > 0 && applicable.every(done)
  return { applicable, currentStage, isDone }
}

/** Parse activity logs into per-item column changes + group moves. */
function parseActivity(logs: SnapshotLog[]): { changes: Map<string, Change[]>; moves: Map<string, GroupMove[]> } {
  const changes = new Map<string, Change[]>()
  const moves = new Map<string, GroupMove[]>()
  for (const log of logs) {
    const ev = log.event
    let data: MondayLogData = {}
    try {
      data = (typeof log.data === 'string' ? JSON.parse(log.data) : log.data || {}) as MondayLogData
    } catch {
      continue
    }
    const pid = data.pulse_id != null ? String(data.pulse_id) : null
    if (!pid) continue
    const createdIso = parseMondayLogTs(log.created_at)
    if (ev === 'update_column_value' || ev === 'create_column_value') {
      if (data.column_type && data.column_type !== 'color' && data.column_type !== 'status') continue
      const arr = changes.get(pid) || []
      arr.push({
        column_id: data.column_id,
        created_at: createdIso,
        previous: data.previous_value?.label?.text ?? data.previous_value?.text ?? null,
        current: data.value?.label?.text ?? data.value?.text ?? null,
      })
      changes.set(pid, arr)
    } else if (ev === 'move_pulse_into_group' || ev === 'create_pulse') {
      const gid = data.group_id != null ? String(data.group_id) : null
      if (!gid) continue
      const arr = moves.get(pid) || []
      arr.push({ group_id: gid, created_at: createdIso })
      moves.set(pid, arr)
    }
  }
  return { changes, moves }
}

const byTimeAsc = (a: Change, b: Change) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()

/* ---------- Enrich ---------- */

function enrichTranslationItem(
  it: SnapshotItem,
  config: BoardConfig,
  boardId: string,
  changes: Change[],
  groupMoves: GroupMove[],
  onGoingGroupIds: Set<string>,
  allChangesMap: Map<string, Change[]>,
): TranslationItem {
  const byId = colsById(it.column_values)
  const main = evalPipeline(byId, config.stages)

  // --- Subitems (per-language pipelines) ---
  const subitemsData: SubitemResult[] = []
  if (config.subitemPipeline && Array.isArray(it.subitems)) {
    const sp = config.subitemPipeline
    const subPipelineCols = new Set(sp.stages.map((s) => s.col).filter(Boolean))
    for (const sub of it.subitems as SnapshotSubitem[]) {
      const sbyId = colsById(sub.column_values)
      const lang = sbyId[sp.languageCol]?.text || '—'
      const evalSub = evalPipeline(sbyId, sp.stages)
      let subDoneDate: string | null = null
      if (evalSub.isDone) {
        const hits = (allChangesMap.get(String(sub.id)) || [])
          .filter((ch) => ch.column_id && subPipelineCols.has(ch.column_id) && ch.current && labelSemantic(ch.current) === 'complete')
          .sort(byTimeAsc)
        if (hits.length) subDoneDate = hits[hits.length - 1].created_at
      }
      subitemsData.push({
        id: String(sub.id),
        name: sub.name,
        language: lang,
        pipeline: evalSub.applicable,
        currentStage: evalSub.currentStage,
        isDone: evalSub.isDone,
        doneDate: subDoneDate,
        peopleNames: [...collectPeopleNames(sbyId, sp.peopleCols)],
      })
    }
  }
  const subCount = subitemsData.length
  const subDone = subitemsData.filter((s) => s.isDone).length
  const subitemProgress = config.subitemPipeline && subCount > 0 ? { done: subDone, total: subCount } : null

  // --- Current stage + isDone + status kind for the whole item ---
  let currentStage: StageResult | null
  let isDone: boolean
  let stageName: string
  let stageValue: string
  let statusKind: StatusKind
  if (!main.isDone) {
    currentStage = main.currentStage
    isDone = false
    stageName = currentStage?.name || 'No stage'
    stageValue = currentStage?.value || '(not started)'
    statusKind = currentStage ? statusClass(currentStage.value) : 'pending'
  } else if (config.subitemPipeline) {
    if (subCount === 0) {
      currentStage = { col: null, name: 'Translation', value: '(no subitems yet)', semantic: 'notstarted', skipped: false, owners: [] }
      isDone = false
      stageName = 'Translation'
      stageValue = '(no subitems)'
      statusKind = 'pending'
    } else if (subDone === subCount) {
      currentStage = null
      isDone = true
      stageName = 'Completed'
      stageValue = 'Done'
      statusKind = 'done'
    } else {
      currentStage = { col: null, name: 'Translation', value: `${subDone}/${subCount} done`, semantic: 'active', skipped: false, owners: [] }
      isDone = false
      stageName = 'Translation'
      stageValue = `${subDone}/${subCount} languages done`
      const anyStuck = subitemsData.some((s) => s.currentStage && (s.currentStage.semantic === 'stuck' || s.currentStage.semantic === 'waiting'))
      statusKind = anyStuck ? 'stuck' : 'progress'
    }
  } else {
    currentStage = null
    isDone = true
    stageName = 'Completed'
    stageValue = 'Done'
    statusKind = 'done'
  }

  // --- workStart = last move INTO an "On Going" group (never created_at) ---
  let workStart: string | null = null
  if (onGoingGroupIds.size) {
    const sorted = groupMoves.slice().sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    for (const mv of sorted) {
      if (onGoingGroupIds.has(String(mv.group_id))) workStart = mv.created_at
    }
  }

  // --- stageStart: latest change to the current stage column after workStart,
  //     else workStart itself. ---
  let stageStart: string | null = null
  let stageStartKnown = false
  const workStartMs = workStart ? new Date(workStart).getTime() : null
  if (currentStage && currentStage.col) {
    const col = currentStage.col
    const colChanges = changes
      .filter((ch) => ch.column_id === col && ch.current)
      .filter((ch) => workStartMs == null || new Date(ch.created_at ?? 0).getTime() >= workStartMs)
      .sort(byTimeAsc)
    if (colChanges.length) {
      stageStart = colChanges[colChanges.length - 1].created_at
      stageStartKnown = true
    }
  }
  if (!stageStartKnown && workStart) stageStart = workStart

  const nowIso = new Date().toISOString()
  const stageDays = stageStart ? daysBetween(stageStart, nowIso) : null
  const workDays = workStart ? daysBetween(workStart, nowIso) : null

  // --- doneDate = last pipeline-column change to "complete" ---
  let doneDate: string | null = null
  if (isDone) {
    const pipelineCols = new Set(config.stages.map((s) => s.col))
    const hits = changes
      .filter((ch) => ch.column_id && pipelineCols.has(ch.column_id) && ch.current && labelSemantic(ch.current) === 'complete')
      .sort(byTimeAsc)
    doneDate = hits.length ? hits[hits.length - 1].created_at : it.updated_at
  }

  // --- currentOwners = who has the ball right now ---
  let currentOwners: string[] = []
  if (!isDone) {
    const ownSet = new Set<string>()
    if (!main.isDone && main.currentStage) {
      for (const n of main.currentStage.owners) ownSet.add(n)
    } else if (main.isDone && config.subitemPipeline) {
      for (const sub of subitemsData) {
        if (sub.isDone || !sub.currentStage) continue
        for (const n of sub.currentStage.owners) ownSet.add(n)
      }
    }
    currentOwners = [...ownSet]
  }

  // --- people = parent people cols ∪ all subitem people ---
  const peopleSet = collectPeopleNames(byId, config.peopleCols)
  for (const sub of subitemsData) for (const n of sub.peopleNames) peopleSet.add(n)

  return {
    id: String(it.id),
    name: it.name,
    boardId,
    boardName: config.name,
    boardShort: config.short,
    stageName,
    stageValue,
    statusKind,
    isDone,
    currentOwners,
    people: [...peopleSet],
    group: it.group?.title || null,
    pipeline: main.applicable,
    subitems: subitemsData,
    subitemProgress,
    workStart,
    stageStart,
    stageDays,
    workDays,
    doneDate,
  }
}

/** Turn a translation (non-publishing) board's snapshot into TranslationItem[]. */
export function enrichTranslationBoard(board: SnapshotBoard, config: BoardConfig): TranslationItem[] {
  if (config.publishingMode) return []
  const { changes: changesByItem, moves: movesByItem } = parseActivity(board.activity)

  const onGoingGroupIds = new Set<string>()
  if (config.workStartGroup) {
    const needle = config.workStartGroup.replace(/[\s-]+/g, '').toLowerCase()
    for (const g of board.groups) {
      if (String(g.title || '').replace(/[\s-]+/g, '').toLowerCase() === needle) onGoingGroupIds.add(String(g.id))
    }
  }

  return board.items.map((it) =>
    enrichTranslationItem(
      it,
      config,
      board.id,
      changesByItem.get(String(it.id)) || [],
      movesByItem.get(String(it.id)) || [],
      onGoingGroupIds,
      changesByItem,
    ),
  )
}

/** Board IDs that run in translation mode (non-publishing). */
export const TRANSLATION_BOARD_IDS = Object.keys(BOARDS).filter((id) => !BOARDS[id].publishingMode)
