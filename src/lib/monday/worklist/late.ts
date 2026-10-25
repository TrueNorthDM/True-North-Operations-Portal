// How many of one person's steps are late, for the number on the rail's My
// Work icon (owner, 25 October 2026).
//
// The same answer as My Work's "Late" filter on that person's own list, asked
// without building the list. The list reads every open step and the finished
// ones of the last months, with names, links and stages, to show them; a count
// needs only the open steps whose date has passed, so the database narrows to
// those and this keeps the list's own rules for the rest:
//
//   - whose: the Monday accounts linked to the person (monday_user_links), as
//     loadWorklist resolves a person filter;
//   - which boards: the ones switched on, minus the accounts hidden in
//     Settings, and only people columns the list shows (shownStep);
//   - late: matchesDue(row, 'late', today), so a finished step is never late
//     and a date outside 2000 to 2100 is no deadline at all;
//   - today: the New York day, as the page works it out.
//
// Two round trips: the four small lookups together, then the late steps.

import type { Db } from '@/lib/supabase/types'
import { accountsFor, shownStep, type WorkRow } from './data'
import { matchesDue } from './list-view'
import { selectAllPages } from './resilience'
import { readStages } from './steps'

type LateRow = { board_id: number; people_col: string; due_date: string | null; status_done: boolean | null }

export async function countLate(supabase: Db, personId: string, today: string): Promise<number> {
  const [accounts, boardRead, userRead, stepRead] = await Promise.all([
    accountsFor(supabase, [personId]),
    selectAllPages((from, to) => supabase.from('monday_boards').select('id, included').order('id').range(from, to)),
    selectAllPages((from, to) => supabase.from('monday_users').select('id, hidden').order('id').range(from, to)),
    selectAllPages((from, to) => supabase.from('monday_board_steps').select('board_id, people_col, source, stages').order('board_id').order('people_col').range(from, to)),
  ])
  for (const [what, r] of [['boards', boardRead], ['Monday accounts', userRead], ['board steps', stepRead]] as const) {
    if (r.error) throw new Error(`Could not read the ${what}: ${r.error.message}`)
  }
  const hidden = new Set((userRead.data as { id: number; hidden: boolean }[]).filter(u => u.hidden).map(u => u.id))
  const mine = accounts.filter(id => !hidden.has(id))
  const boards = (boardRead.data as { id: number; included: boolean }[]).filter(b => b.included).map(b => b.id)
  if (!mine.length || !boards.length) return 0

  // Open, with a date before today: the database's part of matchesDue. Dates
  // before 2000 are left out here because the list reads them as suspect.
  const { data: rows, error } = await selectAllPages<LateRow>((from, to) => supabase.from('monday_assignments')
    .select('board_id, people_col, due_date, status_done')
    .in('monday_user_id', mine).in('board_id', boards)
    .or('status_done.is.null,status_done.eq.false')
    .gte('due_date', '2000-01-01').lt('due_date', today)
    .order('id').range(from, to))
  if (error) throw new Error(`Could not read the late steps: ${error.message}`)

  type S = { board_id: number; people_col: string; source: string; stages?: unknown }
  const steps = new Map((stepRead.data as S[]).map(s => [`${s.board_id}:${s.people_col}`, { source: s.source, stageList: readStages(s.stages) }]))
  return rows.filter(r => shownStep(steps.get(`${r.board_id}:${r.people_col}`)) && matchesDue(asRow(r), 'late', today)).length
}

/** What matchesDue reads of a row: its date, whether that date is trusted, and whether the step is finished. */
function asRow(r: LateRow): WorkRow {
  const y = r.due_date ? Number(r.due_date.slice(0, 4)) : 0
  return { dueDate: r.due_date, dueSuspect: r.due_date != null && !(y >= 2000 && y <= 2100), statusDone: r.status_done } as WorkRow
}
