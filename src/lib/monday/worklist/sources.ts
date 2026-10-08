// What My Work is allowed to show.
//
// Three switches, and they are not the same switch three times. A workspace is
// a folder somebody organised once; a board is a piece of work that may have
// finished years ago; a person may be perfectly real and still not belong on
// this page. Collapsing them into one list of checkboxes would lose the
// difference and make the decision harder rather than shorter.

import type { Db } from '@/lib/supabase/types'
import { staleSweep } from './stale'

type Client = Db

export type Priority = 'high' | 'medium' | 'low'

export interface SourceBoard {
  id: number
  name: string
  included: boolean
  priority: Priority
  isSubitemBoard: boolean
  assignments: number
  lastActivityAt: string | null
}

export interface SourceWorkspace {
  name: string
  boards: SourceBoard[]
  included: number
  assignments: number
  /** Newest activity across its boards: the number that says "still in use". */
  lastActivityAt: string | null
}

export interface SourceUser {
  mondayUserId: number
  name: string
  email: string | null
  personName: string | null
  hidden: boolean
  isExternal: boolean
  assignments: number
}

export interface WorklistSources {
  workspaces: SourceWorkspace[]
  users: SourceUser[]
  /**
   * The stale rule: whether it is on, and what one pass would change now.
   *
   * The preview is computed from the same function the sync runs, so the
   * number printed beside the switch cannot disagree with what pressing it
   * does.
   */
  stale: { on: boolean; wouldHide: number; wouldShow: number }
}

export async function loadWorklistSources(supabase: Client): Promise<WorklistSources> {
  const [{ data: boardRows }, { data: userRows }, { data: linkRows }, { data: peopleRows }] = await Promise.all([
    supabase.from('monday_boards')
      .select('id, name, workspace_name, included, included_pinned, priority, is_subitem_board, assignments_count, last_activity_at'),
    supabase.from('monday_users').select('id, name, email, hidden, is_external'),
    supabase.from('monday_user_links').select('monday_user_id, person_id'),
    supabase.from('people').select('id, full_name'),
  ])

  const { data: settings } = await supabase
    .from('app_settings').select('monday_hide_stale_boards').eq('singleton_id', 1).maybeSingle()

  const sweep = staleSweep(
    ((boardRows ?? []) as { id: number; included: boolean; included_pinned: boolean; last_activity_at: string | null }[])
      .map(b => ({
        id: b.id,
        included: b.included,
        includedPinned: b.included_pinned,
        lastActivityAt: b.last_activity_at,
      })),
    new Date(),
  )

  const stale = {
    on: Boolean((settings as { monday_hide_stale_boards?: boolean } | null)?.monday_hide_stale_boards),
    wouldHide: sweep.hide.length,
    wouldShow: sweep.show.length,
  }

  type B = {
    id: number; name: string; workspace_name: string | null; included: boolean; priority: Priority
    is_subitem_board: boolean; assignments_count: number | null; last_activity_at: string | null
  }
  const byWorkspace = new Map<string, SourceBoard[]>()
  for (const b of (boardRows ?? []) as B[]) {
    const ws = b.workspace_name ?? 'No workspace'
    byWorkspace.set(ws, [...(byWorkspace.get(ws) ?? []), {
      id: b.id,
      name: b.name,
      included: b.included,
      priority: b.priority,
      isSubitemBoard: b.is_subitem_board,
      assignments: b.assignments_count ?? 0,
      lastActivityAt: b.last_activity_at,
    }])
  }

  const workspaces: SourceWorkspace[] = [...byWorkspace.entries()]
    .map(([name, boards]) => ({
      name,
      // Most work first inside a workspace, and a board with nothing on it
      // last, because that is the order somebody switching things off reads in.
      boards: boards.sort((a, b) => b.assignments - a.assignments || a.name.localeCompare(b.name)),
      included: boards.filter(b => b.included).length,
      assignments: boards.reduce((s, b) => s + b.assignments, 0),
      lastActivityAt: boards.map(b => b.lastActivityAt).filter(Boolean).sort().pop() ?? null,
    }))
    .sort((a, b) => b.assignments - a.assignments || a.name.localeCompare(b.name))

  const personName = new Map(((peopleRows ?? []) as { id: string; full_name: string }[])
    .map(p => [p.id, p.full_name]))
  const personByAccount = new Map(((linkRows ?? []) as { monday_user_id: number; person_id: string }[])
    .map(l => [l.monday_user_id, l.person_id]))

  // Per-account totals come from the boards' own counts being unavailable at
  // this grain, so this is the one place a scan is unavoidable. Ids only, which
  // is a single column over the table.
  const counts = new Map<number, number>()
  for (let from = 0; ; from += 2000) {
    const { data } = await supabase.from('monday_assignments')
      .select('monday_user_id').order('id', { ascending: true }).range(from, from + 1999)
    const page = (data ?? []) as { monday_user_id: number }[]
    for (const r of page) counts.set(r.monday_user_id, (counts.get(r.monday_user_id) ?? 0) + 1)
    if (page.length < 2000) break
  }

  const users: SourceUser[] = ((userRows ?? []) as {
    id: number; name: string; email: string | null; hidden: boolean; is_external: boolean
  }[])
    .map(u => {
      const pid = personByAccount.get(u.id)
      return {
        mondayUserId: u.id,
        name: u.name,
        email: u.email,
        personName: pid ? personName.get(pid) ?? null : null,
        hidden: u.hidden,
        isExternal: u.is_external,
        assignments: counts.get(u.id) ?? 0,
      }
    })
    .sort((a, b) => b.assignments - a.assignments || a.name.localeCompare(b.name))

  return { workspaces, users, stale }
}
