// The 515 guesses nobody has confirmed.
//
// seedSteps() pairs each people column with the status column to its right,
// and the pairing is right most of the time and wrong loudly when it is not:
// a board whose people column sits next to a Priority dropdown gets a step
// called Priority, and every row of it is on somebody's list.
//
// Reviewing 515 of anything by hand does not happen. Ordering by how many
// assignments ride on each one does, because then twenty minutes of work
// fixes most of the data and the rest can stay a guess.

import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

export type StepSource = 'guess' | 'confirmed' | 'off'

export type StepUnderReview = {
  boardId: number
  boardName: string
  workspaceName: string | null
  peopleCol: string
  stepName: string
  source: StepSource
  /** How many assignments ride on it, which is what makes it worth a minute. */
  assignments: number
  /** Reads like a column that is not a stage of work. */
  suspicious: boolean
}

/**
 * Names that are almost never a step somebody performs.
 *
 * Priority is the one that started this: it is a dropdown of importance, not
 * a stage, so "Lana, Priority: High" is not a task. The rest are the same
 * shape of mistake, and flagging beats hiding: the reviewer decides.
 */
const NOT_A_STAGE = /^(priority|status|type|category|label|stage|state|progress|owner|team|notes?|comments?)$/i

export function looksSuspicious(stepName: string): boolean {
  return NOT_A_STAGE.test(stepName.trim())
}

export async function loadStepsForReview(supabase: Client): Promise<StepUnderReview[]> {
  const [{ data: steps }, { data: boards }, { data: counts }] = await Promise.all([
    supabase.from('monday_board_steps').select('board_id, people_col, step_name, source'),
    supabase.from('monday_boards').select('id, name, workspace_name').eq('included', true),
    supabase.from('monday_assignments').select('board_id, people_col').limit(200_000),
  ])

  const boardById = new Map(
    ((boards ?? []) as { id: number; name: string; workspace_name: string | null }[])
      .map(b => [b.id, b]),
  )

  const rides = new Map<string, number>()
  for (const a of (counts ?? []) as { board_id: number; people_col: string }[]) {
    const k = `${a.board_id}|${a.people_col}`
    rides.set(k, (rides.get(k) ?? 0) + 1)
  }

  return ((steps ?? []) as { board_id: number; people_col: string; step_name: string; source: StepSource }[])
    .filter(s => boardById.has(s.board_id))
    .map(s => ({
      boardId: s.board_id,
      boardName: boardById.get(s.board_id)!.name,
      workspaceName: boardById.get(s.board_id)!.workspace_name,
      peopleCol: s.people_col,
      stepName: s.step_name,
      source: s.source,
      assignments: rides.get(`${s.board_id}|${s.people_col}`) ?? 0,
      suspicious: looksSuspicious(s.step_name),
    }))
    .sort(orderForReview)
}

/**
 * The order a reviewer should meet them in.
 *
 * Still a guess first, since a confirmed one needs nothing. Then suspicious,
 * because those are the ones that are wrong on screen right now. Then by how
 * much work rides on them, so the minute spent buys the most.
 */
export function orderForReview(a: StepUnderReview, b: StepUnderReview): number {
  const pending = (s: StepUnderReview) => (s.source === 'guess' ? 0 : 1)
  if (pending(a) !== pending(b)) return pending(a) - pending(b)
  if (a.suspicious !== b.suspicious) return a.suspicious ? -1 : 1
  return b.assignments - a.assignments
}

export function reviewProgress(steps: StepUnderReview[]) {
  return {
    total: steps.length,
    settled: steps.filter(s => s.source !== 'guess').length,
    suspicious: steps.filter(s => s.source === 'guess' && s.suspicious).length,
    // Assignments still resting on a guess: the size of what is unverified,
    // which is the number that actually matters.
    unverifiedAssignments: steps
      .filter(s => s.source === 'guess')
      .reduce((n, s) => n + s.assignments, 0),
  }
}
