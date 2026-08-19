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

import type { SupabaseClient } from '@supabase/supabase-js'
import { gql } from './discover'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 250

export interface BoardRow {
  id: number
  name: string
  is_subitem_board: boolean
}

interface StepRow {
  board_id: number
  people_col: string
  status_col: string | null
  source: string
}

interface ItemRow {
  id: string
  name: string
  updated_at: string | null
  group: { title: string } | null
  parent_item: { id: string; name: string } | null
  column_values: { id: string; text: string | null; value: string | null }[]
}

/** The label indices this status column treats as finished. */
function doneIndices(settings: string | null): Set<number> {
  if (!settings) return new Set()
  try {
    const s = JSON.parse(settings) as { done_colors?: number[] }
    return new Set(s.done_colors ?? [])
  } catch {
    return new Set()
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
export async function ingestBoard(
  supabase: Client,
  token: string,
  board: BoardRow,
): Promise<BoardIngestResult> {
  const { data: stepRows } = await supabase
    .from('monday_board_steps')
    .select('board_id, people_col, status_col, source')
    .eq('board_id', board.id)
  const steps = ((stepRows ?? []) as StepRow[]).filter(s => s.source !== 'off')
  if (!steps.length) return { board: board.name, items: 0, assignments: 0 }

  const peopleCols = steps.map(s => s.people_col)
  const statusCols = [...new Set(steps.map(s => s.status_col).filter(Boolean) as string[])]
  const wanted = [...peopleCols, ...statusCols]

  // done_colors per status column, read once for the board.
  const cd = await gql<{ boards: { columns: { id: string; settings_str: string | null }[] }[] }>(
    token, `query ($id: [ID!]) { boards(ids: $id) { columns { id settings_str } } }`, { id: [String(board.id)] })
  const doneBy = new Map<string, Set<number>>()
  for (const c of cd.boards?.[0]?.columns ?? []) doneBy.set(c.id, doneIndices(c.settings_str))

  const ITEM_FIELDS = `
    id name updated_at
    group { title }
    parent_item { id name }
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
      for (const st of steps) {
        const pc = byCol.get(st.people_col)
        const ids = peopleIn(pc?.value ?? null)
        if (!ids.length) continue

        const sc = st.status_col ? byCol.get(st.status_col) : undefined
        let index: number | null = null
        if (sc?.value) {
          try { index = (JSON.parse(sc.value) as { index?: number }).index ?? null } catch { index = null }
        }
        const done = st.status_col && index != null
          ? doneBy.get(st.status_col)?.has(index) ?? false
          : null

        for (const uid of ids) {
          rows.push({
            board_id: board.id,
            item_id: Number(it.id),
            item_name: it.name,
            parent_item_id: it.parent_item ? Number(it.parent_item.id) : null,
            parent_item_name: it.parent_item?.name ?? null,
            group_title: it.group?.title ?? null,
            people_col: st.people_col,
            monday_user_id: uid,
            status_col: st.status_col,
            status_text: sc?.text ?? null,
            status_index: index,
            status_done: done,
            item_updated_at: it.updated_at,
          })
        }
      }
    }
    cursor = page.cursor
    if (!cursor) break
  }

  const { error: delErr } = await supabase.from('monday_assignments').delete().eq('board_id', board.id)
  if (delErr) throw new Error(`clear board ${board.id}: ${delErr.message}`)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('monday_assignments').insert(rows.slice(i, i + 500))
    if (error) throw new Error(`assignments insert (${board.name}): ${error.message}`)
  }

  await supabase.from('monday_boards')
    .update({ items_synced_at: new Date().toISOString() })
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
 */
export async function ingestSlice(
  supabase: Client,
  token: string,
  budgetMs: number,
): Promise<SliceResult> {
  const started = Date.now()

  const { data: boardRows } = await supabase
    .from('monday_boards')
    .select('id, name, is_subitem_board, items_synced_at, included')
    .eq('included', true)
    .order('items_synced_at', { ascending: true, nullsFirst: true })
  const boards = (boardRows ?? []) as (BoardRow & { items_synced_at: string | null })[]

  // Only boards that have steps: the other 65 are spreadsheets with nobody on
  // them, and walking their items would be reading for nothing.
  const { data: stepBoards } = await supabase
    .from('monday_board_steps').select('board_id').neq('source', 'off')
  const hasSteps = new Set(((stepBoards ?? []) as { board_id: number }[]).map(s => s.board_id))
  const queue = boards.filter(b => hasSteps.has(b.id))

  const done: BoardIngestResult[] = []
  for (const b of queue) {
    if (Date.now() - started > budgetMs) break
    done.push(await ingestBoard(supabase, token, b))
  }

  return { done, remaining: queue.length - done.length, spentMs: Date.now() - started }
}
