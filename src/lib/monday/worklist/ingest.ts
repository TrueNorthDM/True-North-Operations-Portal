// Reading the work itself: one row per person per step of an item.
//
// This is the part that cannot be done live. 197 boards carry people columns
// and hold 22,000 items between them; asking Monday for that on every page
// load is not a page load. So it is ingested in slices and the page reads
// Postgres.
//
// Two things are read out of the column's value JSON rather than its text:
//
//   who   personsAndTeams carries user ids. The text carries display names,
//         which is what somebody typed. The whole point of the link table is
//         to stop matching people by how their name was spelled that day.
//
//   done  a status column's settings_str lists done_colors, the label indices
//         Monday itself treats as finished (the green ones). That answers "has
//         this step happened" from the board's own configuration instead of
//         asking a person to declare which label means done on 197 boards.
//
// Since September 2026 a step reads its own stages (steps.ts): the status that
// has a deadline, and that deadline. A row's status and due date come from the
// stage the step is on, so a step already delivered is not late because the
// item's next stage is.

import type { SupabaseClient } from '@supabase/supabase-js'
import { gql } from './discover'
import { missingColumn } from './missing-column'
import { boardsToProbe, readOrder } from './stale'
import { diffAssignments, keyOf, type AssignmentSnapshot } from './changes'
import { currentStage, pickLanguageColumn, readStages, type StepStage } from './steps'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 250

export { missingColumn }

export interface BoardRow {
  id: number
  name: string
  is_subitem_board: boolean
  /** Chosen at discovery; null when the board has no date column at all. */
  date_col?: string | null
}

interface StepRow {
  board_id: number
  people_col: string
  status_col: string | null
  source: string
  /** Null on a row seeded before stages existed; see readStages. */
  stages?: unknown
}

/**
 * How one people column is read on this board.
 *
 * `legacy` is a step seeded before stages existed: the old pairing, with the
 * board's one date column. It lasts until discovery rewrites the row, which the
 * sync does at the head of every chain, so in practice it covers the window
 * between a deploy and the next discovery.
 */
type Plan =
  | { peopleCol: string; kind: 'stages'; stages: StepStage[] }
  | { peopleCol: string; kind: 'legacy'; statusCol: string | null }

interface ItemRow {
  id: string
  name: string
  updated_at: string | null
  group: { title: string } | null
  parent_item: { id: string; name: string; board: { id: string } | null } | null
  column_values: { id: string; text: string | null; value: string | null }[]
}

interface StatusSettings {
  /** Label indices Monday itself treats as finished. */
  done: Set<number>
  /** Label index → the hex Monday paints it with, so the portal can match. */
  colour: Map<number, string>
}

function statusSettings(settings: string | null): StatusSettings {
  const empty = { done: new Set<number>(), colour: new Map<number, string>() }
  if (!settings) return empty
  try {
    const s = JSON.parse(settings) as {
      done_colors?: number[]
      labels_colors?: Record<string, { color?: string; border?: string }>
    }
    const colour = new Map<number, string>()
    for (const [idx, c] of Object.entries(s.labels_colors ?? {})) {
      if (c?.color) colour.set(Number(idx), c.color)
    }
    return { done: new Set(s.done_colors ?? []), colour }
  } catch {
    return empty
  }
}

/** Monday writes a date column as {"date":"2026-08-19"}; a timeline as a range. */
function dateOf(value: string | null): string | null {
  if (!value) return null
  try {
    const v = JSON.parse(value) as { date?: string; to?: string; from?: string }
    // A timeline's end is its deadline; its start is when work may begin.
    const raw = v.date ?? v.to ?? v.from ?? null
    return raw ? raw.slice(0, 10) : null
  } catch {
    return null
  }
}

/** User ids in a people column. Teams are skipped: a team is not a person. */
function peopleIn(value: string | null): number[] {
  if (!value) return []
  try {
    const v = JSON.parse(value) as { personsAndTeams?: { id: number | string; kind?: string }[] }
    return (v.personsAndTeams ?? [])
      .filter(p => (p.kind ?? 'person') === 'person')
      .map(p => Number(p.id))
      .filter(n => Number.isFinite(n))
  } catch {
    return []
  }
}

export interface BoardIngestResult {
  board: string
  items: number
  assignments: number
}

/**
 * One board, start to finish. Deletes what it replaces for that board first:
 * an assignment that was removed in Monday has to disappear here, and an
 * upsert alone would leave it behind forever.
 */
/**
 * Write what changed on this board since the last sync.
 *
 * Deliberately not allowed to fail the ingest. A board whose history cannot
 * be written is a board missing some history; a board whose assignments stop
 * updating is a board missing from My Work, which people use every day. The
 * first loss is the smaller one, so it is logged and swallowed.
 */
async function recordChanges(
  supabase: Client,
  boardId: number,
  after: AssignmentSnapshot[],
  plans: Plan[],
  untracked: Set<string>,
) {
  try {
    const first = await supabase
      .from('monday_assignments')
      .select('item_id, people_col, monday_user_id, status_text, status_done, due_date, status_col, due_col')
      .eq('board_id', boardId)
    let data: unknown[] | null = first.data
    let error = first.error
    if (missingColumn(error, 'due_col')) {
      const second = await supabase
        .from('monday_assignments')
        .select('item_id, people_col, monday_user_id, status_text, status_done, due_date, status_col')
        .eq('board_id', boardId)
      data = second.data
      error = second.error
    }
    if (error) throw error
    const before = (data ?? []) as AssignmentSnapshot[]

    // A row is remapped when it used to be read from a column this step does
    // not read any more, or from before steps had deadlines of their own (no
    // due_col). Moving from one of a step's stages to the next is NOT that: it
    // is the work moving, and it is recorded.
    const readsFrom = new Map<string, Set<string>>()
    for (const pl of plans) {
      readsFrom.set(pl.peopleCol, new Set(pl.kind === 'stages'
        ? pl.stages.flatMap(st => [st.statusCol, st.dateCol])
        : [pl.statusCol ?? '']))
    }
    const was = new Map(before.map(r => [keyOf(r), r]))
    const remapped = new Set<string>()
    for (const row of after) {
      const old = was.get(keyOf(row))
      const plan = plans.find(pl => pl.peopleCol === row.people_col)
      if (!old || plan?.kind !== 'stages') continue
      const cols = readsFrom.get(row.people_col)!
      if (old.due_col == null || !cols.has(old.status_col ?? '') || !cols.has(old.due_col)) remapped.add(keyOf(row))
    }

    const events = diffAssignments(boardId, before, after, new Date().toISOString(), { remapped, untracked })
    if (!events.length) return

    for (let i = 0; i < events.length; i += 500) {
      // The same change seen by two syncs is one change, and the table's
      // unique key says so. Ignoring the duplicate is the intended outcome,
      // not an error to retry.
      const { error: insErr } = await supabase
        .from('monday_assignment_events')
        .upsert(events.slice(i, i + 500), {
          onConflict: 'board_id,item_id,people_col,monday_user_id,event,occurred_at',
          ignoreDuplicates: true,
        })
      if (insErr) throw insErr
    }
  } catch (e) {
    console.error(`change log for board ${boardId}:`, e instanceof Error ? e.message : e)
  }
}

export async function ingestBoard(
  supabase: Client,
  token: string,
  board: BoardRow,
): Promise<BoardIngestResult> {
  const firstSteps = await supabase
    .from('monday_board_steps')
    .select('board_id, people_col, status_col, source, stages')
    .eq('board_id', board.id)
  let stepRows: unknown[] | null = firstSteps.data
  let stepErr = firstSteps.error
  if (missingColumn(stepErr, 'stages')) {
    const legacy = await supabase
      .from('monday_board_steps')
      .select('board_id, people_col, status_col, source')
      .eq('board_id', board.id)
    stepRows = legacy.data
    stepErr = legacy.error
  }
  if (stepErr) throw new Error(`steps for board ${board.id}: ${stepErr.message}`)
  const allSteps = (stepRows ?? []) as StepRow[]

  const plans: Plan[] = []
  for (const st of allSteps) {
    if (st.source === 'off') continue
    const stages = readStages(st.stages)
    if (stages === null) plans.push({ peopleCol: st.people_col, kind: 'legacy', statusCol: st.status_col })
    else if (stages.length) plans.push({ peopleCol: st.people_col, kind: 'stages', stages })
  }
  // People columns whose rows leave because of a setting rather than the work.
  const untracked = new Set(allSteps.map(st => st.people_col).filter(pc => !plans.some(pl => pl.peopleCol === pc)))

  // Nothing on this board is a step any more: every people column is switched
  // off or owns no status with a deadline. Its rows go, without history events
  // (it is a setting, not the work), and the board is stamped. Returning early
  // without the stamp left it first in the queue forever and pinned the page's
  // "refreshed" footer, which reads the oldest stamp, to the day it happened.
  if (!plans.length) {
    const { error: clearErr } = await supabase.from('monday_assignments').delete().eq('board_id', board.id)
    if (clearErr) throw new Error(`clear board ${board.id}: ${clearErr.message}`)
    await supabase.from('monday_boards')
      .update({ items_synced_at: new Date().toISOString(), assignments_count: 0 })
      .eq('id', board.id)
    return { board: board.name, items: 0, assignments: 0 }
  }

  // Done flags and label colours per status column, read once for the board,
  // and whether the board says which language each item is in.
  const cd = await gql<{ boards: { columns: { id: string; title: string; type: string; settings_str: string | null }[] }[] }>(
    token, `query ($id: [ID!]) { boards(ids: $id) { columns { id title type settings_str } } }`, { id: [String(board.id)] })
  const boardColumns = cd.boards?.[0]?.columns ?? []
  const settingsBy = new Map<string, StatusSettings>()
  for (const c of boardColumns) settingsBy.set(c.id, statusSettings(c.settings_str))
  const languageCol = pickLanguageColumn(boardColumns)?.id ?? null

  const wanted = [...new Set([
    ...plans.flatMap(pl => pl.kind === 'stages'
      ? [pl.peopleCol, ...pl.stages.flatMap(st => [st.statusCol, st.dateCol])]
      : [pl.peopleCol, ...(pl.statusCol ? [pl.statusCol] : []), ...(board.date_col ? [board.date_col] : [])]),
    ...(languageCol ? [languageCol] : []),
  ])]

  const ITEM_FIELDS = `
    id name updated_at
    group { title }
    parent_item { id name board { id } }
    column_values(ids: $cols) { id text value }`

  const rows: Record<string, unknown>[] = []
  let items = 0
  let cursor: string | null = null

  type Page = { cursor: string | null; items: ItemRow[] }
  for (;;) {
    let page: Page | null
    if (!cursor) {
      const d = await gql<{ boards: { items_page: Page }[] }>(
        token, `query ($id: [ID!], $limit: Int, $cols: [String!]) {
          boards(ids: $id) { items_page(limit: $limit) { cursor items { ${ITEM_FIELDS} } } }
        }`, { id: [String(board.id)], limit: PAGE, cols: wanted })
      page = d.boards?.[0]?.items_page ?? null
    } else {
      const d: { next_items_page: Page | null } = await gql<{ next_items_page: Page | null }>(
        token, `query ($cursor: String!, $limit: Int, $cols: [String!]) {
          next_items_page(cursor: $cursor, limit: $limit) { cursor items { ${ITEM_FIELDS} } }
        }`, { cursor, limit: PAGE, cols: wanted })
      page = d.next_items_page
    }
    if (!page) break

    for (const it of page.items ?? []) {
      items++
      const byCol = new Map(it.column_values.map(c => [c.id, c]))
      for (const pl of plans) {
        const ids = peopleIn(byCol.get(pl.peopleCol)?.value ?? null)
        if (!ids.length) continue

        // Each stage read the same way: which label, whether Monday counts it
        // as done, its colour, and the stage's own deadline.
        const read = (statusCol: string | null, dateCol: string | null) => {
          const sc = statusCol ? byCol.get(statusCol) : undefined
          let index: number | null = null
          if (sc?.value) {
            try { index = (JSON.parse(sc.value) as { index?: number }).index ?? null } catch { index = null }
          }
          const cfg = statusCol ? settingsBy.get(statusCol) : undefined
          return {
            statusCol,
            dateCol,
            text: sc?.text ?? null,
            index,
            done: statusCol && index != null ? cfg?.done.has(index) ?? false : null,
            colour: index != null ? cfg?.colour.get(index) ?? null : null,
            due: dateCol ? dateOf(byCol.get(dateCol)?.value ?? null) : null,
          }
        }

        let at: ReturnType<typeof read>
        let done: boolean | null
        if (pl.kind === 'stages') {
          const cur = currentStage(pl.stages.map(st => read(st.statusCol, st.dateCol)))!
          at = cur.stage
          done = cur.allDone ? true : cur.stage.done
        } else {
          at = read(pl.statusCol, board.date_col ?? null)
          done = at.done
        }

        for (const uid of ids) {
          rows.push({
            board_id: board.id,
            item_id: Number(it.id),
            item_name: it.name,
            parent_item_id: it.parent_item ? Number(it.parent_item.id) : null,
            parent_item_name: it.parent_item?.name ?? null,
            // A subitem board is not navigable in Monday, so a link has to go
            // to the parent, on the parent's own board.
            parent_board_id: it.parent_item?.board ? Number(it.parent_item.board.id) : null,
            group_title: it.group?.title ?? null,
            people_col: pl.peopleCol,
            monday_user_id: uid,
            status_col: at.statusCol,
            status_text: at.text,
            status_index: at.index,
            status_done: done,
            status_color: at.colour,
            due_date: at.due,
            due_col: at.dateCol,
            item_language: languageCol ? (byCol.get(languageCol)?.text || null) : null,
            item_updated_at: it.updated_at,
          })
        }
      }
    }
    cursor = page.cursor
    if (!cursor) break
  }

  // Read what is there BEFORE replacing it. This is the only moment both
  // halves exist, and the difference between them is the only record of the
  // past this system will ever have: monday_assignments keeps the present and
  // Monday does not keep the rest.
  await recordChanges(supabase, board.id, rows as unknown as AssignmentSnapshot[], plans, untracked)

  const { error: delErr } = await supabase.from('monday_assignments').delete().eq('board_id', board.id)
  if (delErr) throw new Error(`clear board ${board.id}: ${delErr.message}`)
  // Columns added by migrations the database may not have yet (082: due_col,
  // 083: item_language). The rows are still right without them, so a missing one
  // is dropped from the insert, said once in the log, and the board carries on.
  const optional = ['due_col', 'item_language']
  const missing = new Set<string>()
  const trim = (r: Record<string, unknown>) => {
    if (!missing.size) return r
    const copy = { ...r }
    for (const k of missing) delete copy[k]
    return copy
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    let { error } = await supabase.from('monday_assignments').insert(chunk.map(trim))
    for (let tries = 0; error && tries < optional.length; tries++) {
      const col = optional.find(k => !missing.has(k) && missingColumn(error, k))
      if (!col) break
      missing.add(col)
      console.warn(`[monday-ingest] monday_assignments.${col} is missing: run its migration`)
      ;({ error } = await supabase.from('monday_assignments').insert(chunk.map(trim)))
    }
    if (error) throw new Error(`assignments insert (${board.name}): ${error.message}`)
  }

  // Recorded here because the ingest already holds it. A settings page asking
  // "when was this board last used" would otherwise scan 53,000 assignments to
  // find out.
  const touched = rows.map(r => r.item_updated_at).filter(Boolean).sort() as string[]
  await supabase.from('monday_boards')
    .update({
      items_synced_at: new Date().toISOString(),
      last_activity_at: touched[touched.length - 1] ?? null,
      assignments_count: rows.length,
    })
    .eq('id', board.id)

  return { board: board.name, items, assignments: rows.length }
}

export interface SliceResult {
  done: BoardIngestResult[]
  remaining: number
  spentMs: number
}

/**
 * As many boards as fit in the budget, oldest first.
 *
 * Resumable by construction: progress is items_synced_at on the board itself,
 * so a slice that dies mid-run costs the board it was on and nothing else. The
 * same shape the TSheets import ended up with, for the same reason: a function
 * that gets killed at 300 seconds cannot be the unit of work.
 *
 * Shown boards, and the hidden ones Monday says have changed since we last read
 * them (boardsToProbe), in one order (readOrder). Reading those is what lets the
 * stale rule bring a board back: its activity is its items, and nobody was
 * reading them. A hidden board that fails to read is skipped and tried again
 * next time, so a board nobody can see cannot stop the ones everybody can.
 */
export async function ingestSlice(
  supabase: Client,
  token: string,
  budgetMs: number,
): Promise<SliceResult> {
  const started = Date.now()

  const COLS = 'id, name, is_subitem_board, date_col, items_synced_at, included, included_pinned'
  const read = (cols: string) => supabase
    .from('monday_boards')
    .select(cols)
    .order('items_synced_at', { ascending: true, nullsFirst: true })
  const first = await read(`${COLS}, board_updated_at`)
  // Migration 086 adds board_updated_at. Without it no hidden board is read
  // again, which is how the sync behaved before it.
  let boardRows = first.data
  if (missingColumn(first.error, 'board_updated_at')) boardRows = (await read(COLS)).data
  else if (first.error) throw new Error(`boards: ${first.error.message}`)
  type Row = BoardRow & {
    items_synced_at: string | null
    included: boolean
    included_pinned?: boolean
    board_updated_at?: string | null
  }
  const all = (boardRows ?? []) as unknown as Row[]
  const probe = new Set(boardsToProbe(all.map(b => ({
    id: b.id,
    included: b.included,
    includedPinned: b.included_pinned === true,
    boardUpdatedAt: b.board_updated_at ?? null,
    itemsSyncedAt: b.items_synced_at,
  }))))
  const boards = readOrder(all.map(b => ({
    ...b,
    itemsSyncedAt: b.items_synced_at,
    boardUpdatedAt: b.board_updated_at ?? null,
  })), probe)

  // Only boards that have steps: the other 65 are spreadsheets with nobody on
  // them, and walking their items would be reading for nothing.
  const { data: stepBoards } = await supabase
    .from('monday_board_steps').select('board_id').neq('source', 'off')
  const hasSteps = new Set(((stepBoards ?? []) as { board_id: number }[]).map(s => s.board_id))
  const queue = boards.filter(b => hasSteps.has(b.id))

  const done: BoardIngestResult[] = []
  for (const b of queue) {
    if (Date.now() - started > budgetMs) break
    if (b.included) {
      done.push(await ingestBoard(supabase, token, b))
      continue
    }
    try {
      done.push(await ingestBoard(supabase, token, b))
    } catch (e) {
      console.error(`reading hidden board ${b.id} to see if it is back:`, e instanceof Error ? e.message : e)
    }
  }

  return { done, remaining: queue.length - done.length, spentMs: Date.now() - started }
}
