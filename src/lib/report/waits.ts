// The Where it waits tab: the same spans, grouped by step instead of by name.
//
// Diagnosis rather than scoreboard. A slow month traced to a stage is a
// process to fix; the same month traced to a person is a conversation that
// may be about the wrong thing entirely.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWorklist } from '@/lib/monday/worklist/data'
import type { BoardWait, StepWait, StuckItem } from '@/components/report/ReportWaits'
import { accountsInScope, loadOpenSince, loadSpans } from './data'
import { median } from './spans'
import type { Period } from './scope'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** How many of the longest-waiting items the panel lists. */
const STUCK_LIMIT = 12

/** A step needs a few finishes before its median means anything. */
const MIN_SPANS_PER_STEP = 3

export async function loadWaits(
  supabase: Client,
  f: { personId?: string | null; teamId?: string | null; period?: Period },
): Promise<{ steps: StepWait[]; boards: BoardWait[]; stuck: StuckItem[] }> {
  const period = f.period ?? 90
  const since = new Date(Date.now() - period * 86_400_000)

  const accounts = await accountsInScope(supabase, f)
  const [spans, openSince, snapshot] = await Promise.all([
    loadSpans(supabase, accounts, since),
    loadOpenSince(supabase, accounts),
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, includeDone: false }),
  ])

  // The log stores a board and a people column; the step's name lives on
  // monday_board_steps. Both halves of the key are carried through the span,
  // so this is an exact lookup rather than a search for a column id that
  // happens to appear on some other board.
  const { data: stepRows } = await supabase
    .from('monday_board_steps').select('board_id, people_col, step_name')
  const nameByCol = new Map(
    ((stepRows ?? []) as { board_id: number; people_col: string; step_name: string }[])
      .map(s => [`${s.board_id}|${s.people_col}`, s.step_name]),
  )

  const byStep = new Map<string, number[]>()
  for (const s of spans) {
    // Grouped by step NAME across boards, not by column: "Approve" on four
    // boards is one stage of one process, and splitting it by board would
    // turn the panel back into a list of boards.
    const name = nameByCol.get(`${s.board_id}|${s.people_col}`) ?? s.people_col
    const list = byStep.get(name)
    if (list) list.push(s.heldDays)
    else byStep.set(name, [s.heldDays])
  }

  // Board names come from the snapshot, which already reads them, rather than
  // from a second query returning names for boards nobody in scope touched.
  const boardName = new Map<number, string>()
  for (const r of snapshot.rows) boardName.set(r.boardId, r.boardName)

  const byBoard = new Map<number, { held: number[]; late: number; judged: number }>()
  for (const s of spans) {
    const cur = byBoard.get(s.board_id) ?? { held: [], late: 0, judged: 0 }
    cur.held.push(s.heldDays)
    if (s.lateDays !== null) {
      cur.judged++
      if (s.lateDays > 0) cur.late++
    }
    byBoard.set(s.board_id, cur)
  }

  const boards: BoardWait[] = [...byBoard.entries()]
    .filter(([, v]) => v.held.length >= MIN_SPANS_PER_STEP)
    .map(([id, v]) => ({
      board: boardName.get(id) ?? `Board ${id}`,
      delivered: v.held.length,
      medianHeld: median(v.held) ?? 0,
      // Only over what carried a deadline, the same rule as the on-time share.
      latePct: v.judged ? Math.round((v.late / v.judged) * 100) : null,
    }))

  const steps: StepWait[] = [...byStep.entries()]
    .filter(([, days]) => days.length >= MIN_SPANS_PER_STEP)
    .map(([name, days]) => ({ name, median: median(days) ?? 0, delivered: days.length }))

  /**
   * The live snapshot, not the period: this is the list somebody acts on
   * today. An item is only here if the log knows when it landed, because
   * "sitting longest" with no hand-off date is a guess.
   */
  const now = Date.now()
  const stuck: StuckItem[] = snapshot.rows
    .filter(r => !r.statusDone)
    .map(r => {
      // Exactly the key the log writes: item, people column, person.
      const started = openSince.get(`${r.itemId}|${r.peopleCol}|${r.mondayUserId}`)
      return { r, started }
    })
    .filter((x): x is { r: (typeof snapshot.rows)[number]; started: string } => Boolean(x.started))
    .map(({ r, started }) => ({
      id: String(r.id),
      item: r.parentItemName ? `${r.parentItemName}: ${r.itemName}` : r.itemName,
      who: r.who,
      step: r.stepName,
      heldDays: Math.max(0, Math.round((now - Date.parse(started)) / 86_400_000)),
    }))
    .sort((a, b) => b.heldDays - a.heldDays)
    .slice(0, STUCK_LIMIT)

  return { steps, boards, stuck }
}
