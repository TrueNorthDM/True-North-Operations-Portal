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
import type { Db } from '@/lib/supabase/types'
import { gql } from './discover'
import { missingColumn } from './missing-column'
import { boardsToProbe, readOrder } from './stale'
import { diffAssignments, keyOf, type AssignmentEvent, type AssignmentSnapshot } from './changes'
import { currentStage, pickLanguageColumn, readStages, type StepStage } from './steps'
import { selectAllPages } from './resilience'

type Client = Db

const PAGE = 250

export { missingColumn }

export interface BoardRow {
  id: number
  name: string
  is_subitem_board: boolean
  /** Chosen at discovery; null when the board has no date column at all. */
  date_col?: string | null
  /** How many items Monday's listing says the board has. */
  items_count?: number | null
  /** Back in the listing after being gone: its rows return without events (migration 104). */
  baseline_pending?: boolean
}

interface StepRow {
  board_id: number
  people_col: string
  status_col: string | null
  source: string
  /** Null on a row seeded before stages existed; see readStages. */
  stages?: unknown
  /** Its rows return without events once (migration 104). */
  baseline_pending?: boolean
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
 * What changed on this board since the last sync, as change-log rows. Written
 * by the database together with the board's rows (monday_write_board), so a
 * board whose write fails logs nothing and the retry logs it once.
 *
 * A board whose "before" cannot be read fails (audit, 10 October 2026). It
 * used to be written anyway, which lost that sync's history for good to save
 * one firing of freshness.
 */
async function changesFor(
  supabase: Client,
  boardId: number,
  after: AssignmentSnapshot[],
  plans: Plan[],
  untracked: Set<string>,
  baseline: Set<string>,
): Promise<AssignmentEvent[]> {
  // Every row, a page at a time. A single read stops at 1,000 rows, and on a
  // bigger board everything past that looked new: "assigned" events for work
  // nobody touched.
  const { data, error } = await selectAllPages<AssignmentSnapshot>((from, to) => supabase
    .from('monday_assignments')
    .select('item_id, people_col, monday_user_id, status_text, status_done, due_date, status_col, due_col')
    .eq('board_id', boardId).order('id').range(from, to))
  if (error) throw new Error(`reading the board before the change: ${error.message}`)
  const before = data

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

  const heldInLog = baseline.size ? await heldByLog(supabase, boardId, baseline) : new Set<string>()
  return diffAssignments(boardId, before, after, new Date().toISOString(), { remapped, untracked, baseline, heldInLog })
}

/**
 * The steps in these columns the log still has in someone's hands: their last
 * hand-off (assigned or reopened) has no finish or removal after it.
 */
async function heldByLog(supabase: Client, boardId: number, cols: Set<string>): Promise<Set<string>> {
  type E = { item_id: number; people_col: string; monday_user_id: number; event: string }
  const { data, error } = await selectAllPages<E>((from, to) => supabase
    .from('monday_assignment_events')
    .select('item_id, people_col, monday_user_id, event')
    .eq('board_id', boardId).in('people_col', [...cols])
    .in('event', ['assigned', 'reopened', 'done', 'unassigned'])
    .order('occurred_at').order('id').range(from, to))
  if (error) throw new Error(`reading the change log: ${error.message}`)
  const held = new Set<string>()
  for (const e of data) {
    const k = keyOf(e)
    if (e.event === 'assigned' || e.event === 'reopened') held.add(k)
    else held.delete(k)
  }
  return held
}

/**
 * Replace a board's rows, and log what changed, in one transaction: the rows
 * go to a staging table, then monday_write_board (migration 104) writes the
 * events and swaps the rows in. A write that fails half way leaves the board
 * as it was and logs nothing, so the next try logs it once.
 *
 * Columns added by migrations the database may not have yet (082: due_col,
 * 083: item_language) are dropped from the rows, said once in the log, and the
 * board carries on: the rows are still right without them.
 */
async function writeBoardRows(typed: Client, board: BoardRow, rows: Record<string, unknown>[], events: AssignmentEvent[]) {
  // Loosely typed on purpose: the rows are assembled per board and lose the
  // columns of any migration not run yet. Their columns are checked where the
  // rows are built.
  const supabase = typed as unknown as SupabaseClient
  const optional = ['due_col', 'item_language']
  const missing = new Set<string>()
  const trim = (r: Record<string, unknown>) => {
    if (!missing.size) return r
    const copy = { ...r }
    for (const k of missing) delete copy[k]
    return copy
  }
  const batch = crypto.randomUUID()
  const drop = () => supabase.from('monday_assignments_staging').delete().eq('batch', batch)

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    let { error } = await supabase.from('monday_assignments_staging').insert(chunk.map(r => ({ ...trim(r), batch })))
    for (let tries = 0; error && tries < optional.length; tries++) {
      const col = optional.find(k => !missing.has(k) && missingColumn(error, k))
      if (!col) break
      missing.add(col)
      console.warn(`[monday-ingest] monday_assignments_staging.${col} is missing: run its migration`)
      ;({ error } = await supabase.from('monday_assignments_staging').insert(chunk.map(r => ({ ...trim(r), batch }))))
    }
    if (error) {
      await drop()
      throw new Error(`assignments staging (${board.name}): ${error.message}`)
    }
  }

  const { error } = await supabase.rpc('monday_write_board', { p_board: board.id, p_batch: batch, p_events: events })
  if (error) {
    await drop()
    throw new Error(`writing the board (${board.name}): ${error.message}`)
  }
}

export async function ingestBoard(
  supabase: Client,
  token: string,
  board: BoardRow,
): Promise<BoardIngestResult> {
  const { data: stepRows, error: stepErr } = await supabase
    .from('monday_board_steps')
    .select('board_id, people_col, status_col, source, stages, baseline_pending')
    .eq('board_id', board.id)
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
  // And the ones whose rows come back for one (migration 104): no hand-offs.
  const baseline = new Set(plans.map(pl => pl.peopleCol)
    .filter(pc => board.baseline_pending || allSteps.some(st => st.people_col === pc && st.baseline_pending)))

  // Nothing on this board is a step any more: every people column is switched
  // off or owns no status with a deadline. Its rows go, without history events
  // (it is a setting, not the work), and the board is stamped. Returning early
  // without the stamp left it first in the queue forever and pinned the page's
  // "refreshed" footer, which reads the oldest stamp, to the day it happened.
  if (!plans.length) {
    const { error: clearErr } = await supabase.from('monday_assignments').delete().eq('board_id', board.id)
    if (clearErr) throw new Error(`clear board ${board.id}: ${clearErr.message}`)
    const { error: stampErr } = await supabase.from('monday_boards')
      .update({ items_synced_at: new Date().toISOString(), assignments_count: 0 })
      .eq('id', board.id)
    if (stampErr) console.error(`[monday-ingest] stamping board ${board.id}: ${stampErr.message}`)
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
    // No page is not an empty board: a board deleted or out of the token's
    // reach, or a bad moment at Monday. Read as empty, it emptied the board
    // and logged every row as taken off its person (audit, 10 October 2026).
    // Failing keeps the board as it was, and the next firing tries again.
    if (!page) throw new Error(`Monday returned no ${cursor ? 'next ' : ''}page of items`)

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

  // Monday listing items on a board and handing back none is a read that went
  // wrong, not a board emptied: refuse it rather than wipe the board.
  if (items === 0 && (board.items_count ?? 0) > 0) {
    throw new Error(`Monday returned no items for a board it lists with ${board.items_count}; kept as it was`)
  }

  // Read what is there BEFORE replacing it. This is the only moment both
  // halves exist, and the difference between them is the only record of the
  // past this system will ever have: monday_assignments keeps the present and
  // Monday does not keep the rest.
  const events = await changesFor(supabase, board.id, rows as unknown as AssignmentSnapshot[], plans, untracked, baseline)

  await writeBoardRows(supabase, board, rows, events)

  // Written once: the next read logs as usual.
  if (baseline.size) {
    const steps = await supabase.from('monday_board_steps').update({ baseline_pending: false })
      .eq('board_id', board.id).in('people_col', [...baseline])
    const boards = board.baseline_pending
      ? await supabase.from('monday_boards').update({ baseline_pending: false }).eq('id', board.id)
      : { error: null }
    const err = steps.error ?? boards.error
    if (err) console.error(`[monday-ingest] clearing the baseline mark on board ${board.id}: ${err.message}`)
  }

  // Recorded here because the ingest already holds it. A settings page asking
  // "when was this board last used" would otherwise scan 53,000 assignments to
  // find out.
  const touched = rows.map(r => r.item_updated_at).filter(Boolean).sort() as string[]
  const { error: stampErr } = await supabase.from('monday_boards')
    .update({
      items_synced_at: new Date().toISOString(),
      last_activity_at: touched[touched.length - 1] ?? null,
      assignments_count: rows.length,
    })
    .eq('id', board.id)
  if (stampErr) console.error(`[monday-ingest] stamping board ${board.id}: ${stampErr.message}`)

  return { board: board.name, items, assignments: rows.length }
}

export interface SliceResult {
  done: BoardIngestResult[]
  /** Boards that failed this slice; the run skips them from here on. */
  failed: { board: number; name: string; error: string }[]
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
 * reading them.
 *
 * Since phase 5 (migration 091) a board that fails, shown or hidden, is caught
 * and listed in `failed`, and the boards after it are still read: one board
 * with a broken column used to stop every board behind it in the queue. The
 * run skips it for the rest of the firing (`skip`), and the next firing tries
 * it again, first in line since it was not stamped. Boards Monday no longer
 * lists (gone_at) are not read at all.
 */
export async function ingestSlice(
  supabase: Client,
  token: string,
  budgetMs: number,
  /**
   * The start of the scheduled run this slice belongs to. Boards already read
   * since then are left out, so a run reads each board once and stops, instead
   * of going round again until its hop limit (21 September 2026).
   */
  notReadSince?: string,
  /** Boards that already failed in this run. */
  skip: Set<number> = new Set(),
): Promise<SliceResult> {
  const started = Date.now()

  const COLS = 'id, name, is_subitem_board, date_col, items_synced_at, included, included_pinned, items_count, assignments_count, baseline_pending'
  const read = (cols: string) => supabase
    .from('monday_boards')
    .select(cols)
    .order('items_synced_at', { ascending: true, nullsFirst: true })
  // Newest columns first; each migration not yet run drops back one step.
  // 086 adds board_updated_at (without it no hidden board is read again, as
  // before); 091 adds gone_at (without it every board counts as present).
  let boardRows: unknown[] | null = null
  let lastErr: { message?: string } | null = null
  for (const cols of [`${COLS}, board_updated_at, gone_at`, `${COLS}, board_updated_at`, COLS]) {
    const r = await read(cols)
    if (!r.error) { boardRows = r.data; lastErr = null; break }
    lastErr = r.error
    if (!missingColumn(r.error, 'gone_at') && !missingColumn(r.error, 'board_updated_at')) break
  }
  if (lastErr) throw new Error(`boards: ${lastErr.message}`)
  type Row = BoardRow & {
    items_synced_at: string | null
    included: boolean
    included_pinned?: boolean
    board_updated_at?: string | null
    gone_at?: string | null
    assignments_count?: number | null
  }
  const all = ((boardRows ?? []) as unknown as Row[]).filter(b => !b.gone_at)
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
  const { data: stepBoards, error: stepErr } = await selectAllPages<{ board_id: number }>((from, to) => supabase
    .from('monday_board_steps').select('board_id').neq('source', 'off').order('board_id').range(from, to))
  if (stepErr) throw new Error(`steps: ${stepErr.message}`)
  const hasSteps = new Set(stepBoards.map(s => s.board_id))
  const cutoff = notReadSince ? Date.parse(notReadSince) : Number.NaN
  const readThisRun = (b: { items_synced_at: string | null }) =>
    Number.isFinite(cutoff) && !!b.items_synced_at && Date.parse(b.items_synced_at) >= cutoff
  // A board whose steps were all switched off still has rows until it is read
  // once more and cleared; it used to keep them, and a frozen read stamp, for
  // good (audit, 10 October 2026).
  const toClear = (b: { id: number; assignments_count?: number | null }) => !hasSteps.has(b.id) && (b.assignments_count ?? 0) > 0
  const queue = boards.filter(b => (hasSteps.has(b.id) || toClear(b)) && !readThisRun(b) && !skip.has(b.id))

  const done: BoardIngestResult[] = []
  const failed: SliceResult['failed'] = []
  for (const b of queue) {
    if (Date.now() - started > budgetMs) break
    try {
      done.push(await ingestBoard(supabase, token, b))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      failed.push({ board: b.id, name: b.name, error: message.slice(0, 500) })
      console.error(`[monday-ingest] board ${b.id} (${b.name})${b.included ? '' : ', hidden,'} failed: ${message}`)
    }
  }

  return { done, failed, remaining: queue.length - done.length - failed.length, spentMs: Date.now() - started }
}
