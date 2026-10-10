// How many assignments each Monday account and each step has, counted by the
// database (migration 104). The settings screens counted them from rows, and
// a read stops at 1,000 of the 50,000 (audit, 10 October 2026).

import type { Db } from '@/lib/supabase/types'

export interface AssignmentCounts {
  /** Monday account id -> assignments. */
  accounts: Map<number, number>
  /** "<board id>:<people column>" -> assignments. */
  steps: Map<string, number>
}

export async function assignmentCounts(supabase: Db): Promise<AssignmentCounts> {
  const { data, error } = await supabase.rpc('monday_assignment_counts')
  if (error) throw new Error(`Could not count the assignments: ${error.message}`)
  const d = (data ?? {}) as { accounts?: Record<string, number>; steps?: Record<string, number> }
  return {
    accounts: new Map(Object.entries(d.accounts ?? {}).map(([k, v]) => [Number(k), Number(v)])),
    steps: new Map(Object.entries(d.steps ?? {}).map(([k, v]) => [k, Number(v)])),
  }
}
