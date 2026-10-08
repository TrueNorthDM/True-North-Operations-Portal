// The steps nobody has confirmed.
//
// seedSteps() reads each board's layout for the statuses that have a deadline
// beside them (steps.ts explains the rule). It is right most of the time and
// wrong loudly when it is not, and a wrong step puts every one of its rows on
// somebody's list, so a person can see what it decided and switch a step off.
//
// Reviewing 515 of anything by hand does not happen. Ordering by how many
// assignments ride on each one does, because then twenty minutes of work
// fixes most of the data and the rest can stay a guess.

import type { Db } from '@/lib/supabase/types'
import { readStages, type StepStage } from './steps'
import { missingColumn } from './ingest'

type Client = Db

export type StepSource = 'guess' | 'confirmed' | 'off'

export type StepUnderReview = {
  boardId: number
  boardName: string
  workspaceName: string | null
  peopleCol: string
  /** The people column's own title: who the step belongs to on the board. */
  peopleTitle: string
  stepName: string
  /**
   * What the rule read for it: each status and the deadline beside it. Empty
   * when the column owns no status with a deadline, which keeps it off My Work.
   * Null for a row seeded before stages existed.
   */
  stages: StepStage[] | null
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
// "Status" and "Stage" left this list in September 2026. A step now needs a
// deadline beside it, and on the simple boards (Person, Status, Date) a column
// called Status with a date after it is exactly the stage of work; flagging all
// 114 of them would make "look wrong" mean nothing.
const NOT_A_STAGE = /^(priority|type|category|label|state|progress|owner|team|notes?|comments?)$/i

export function looksSuspicious(stepName: string): boolean {
  return NOT_A_STAGE.test(stepName.trim())
}

export async function loadStepsForReview(supabase: Client): Promise<StepUnderReview[]> {
  const [firstSteps, { data: boards }, { data: counts }] = await Promise.all([
    supabase.from('monday_board_steps').select('board_id, people_col, people_title, step_name, source, stages'),
    supabase.from('monday_boards').select('id, name, workspace_name').eq('included', true),
    supabase.from('monday_assignments').select('board_id, people_col').limit(200_000),
  ])
  let steps: unknown[] | null = firstSteps.data
  if (missingColumn(firstSteps.error, 'stages')) {
    steps = (await supabase.from('monday_board_steps').select('board_id, people_col, people_title, step_name, source')).data
  }

  const boardById = new Map(
    ((boards ?? []) as { id: number; name: string; workspace_name: string | null }[])
      .map(b => [b.id, b]),
  )

  const rides = new Map<string, number>()
  for (const a of (counts ?? []) as { board_id: number; people_col: string }[]) {
    const k = `${a.board_id}|${a.people_col}`
    rides.set(k, (rides.get(k) ?? 0) + 1)
  }

  return ((steps ?? []) as { board_id: number; people_col: string; people_title: string; step_name: string; source: StepSource; stages?: unknown }[])
    .filter(s => boardById.has(s.board_id))
    .map(s => ({
      boardId: s.board_id,
      boardName: boardById.get(s.board_id)!.name,
      workspaceName: boardById.get(s.board_id)!.workspace_name,
      peopleCol: s.people_col,
      peopleTitle: s.people_title,
      stepName: s.step_name,
      stages: readStages(s.stages),
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
  // A column that is not a step puts nothing on anybody's list, so it waits at
  // the end: worth a glance for a stage the rule missed, not worth a decision.
  const notStep = (s: StepUnderReview) => (isNotAStep(s) ? 1 : 0)
  if (notStep(a) !== notStep(b)) return notStep(a) - notStep(b)
  const pending = (s: StepUnderReview) => (s.source === 'guess' ? 0 : 1)
  if (pending(a) !== pending(b)) return pending(a) - pending(b)
  if (a.suspicious !== b.suspicious) return a.suspicious ? -1 : 1
  return b.assignments - a.assignments
}

/** A people column the rule found no status with a deadline for. */
export function isNotAStep(s: Pick<StepUnderReview, 'stages'>): boolean {
  return s.stages != null && s.stages.length === 0
}

export function reviewProgress(steps: StepUnderReview[]) {
  const real = steps.filter(s => !isNotAStep(s))
  return {
    total: real.length,
    settled: real.filter(s => s.source !== 'guess').length,
    suspicious: real.filter(s => s.source === 'guess' && s.suspicious).length,
    /** People columns left off My Work because they own no status with a deadline. */
    notSteps: steps.length - real.length,
    // Assignments still resting on a guess: the size of what is unverified,
    // which is the number that actually matters.
    unverifiedAssignments: real
      .filter(s => s.source === 'guess')
      .reduce((n, s) => n + s.assignments, 0),
  }
}
