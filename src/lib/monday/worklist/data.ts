// Reading the work list back out.
//
// Grouped the way the question is asked: workspace, then board, then the steps
// inside it. A person wanting to know what is theirs does not think in items,
// they think "what is waiting on me in Graphics".
//
// Open work first and by default. Every step a person was ever assigned is
// still here, and being able to look back matters, but a list that opens on
// four years of finished work is not a work list.

import type { SupabaseClient } from '@supabase/supabase-js'
import { unresolvedAccounts } from './links'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 1000

/**
 * How much the unfiltered view will read before it stops.
 *
 * There are 53,442 assignments. Paging all of them is fifty-four round trips
 * per page load, which is the shape of thing that froze the i7 report and the
 * Grant Pass page before it: correctness said nothing about cost either time.
 *
 * Nobody reads fifty thousand rows. Somebody looking at everything is
 * surveying, and a survey is served by the first few thousand plus an honest
 * count of the rest; somebody doing their work picks a person or a team, and
 * that query is small and complete. So the cap applies only when neither
 * filter is set, and the page says when it has been reached.
 */
const UNFILTERED_CAP = 5000

export interface WorkRow {
  id: number
  boardId: number
  boardName: string
  workspaceName: string | null
  itemId: number
  itemName: string
  /** Set when the step lives on a subitem: the name a person recognises. */
  parentItemName: string | null
  groupTitle: string | null
  stepName: string
  statusText: string | null
  statusDone: boolean | null
  /** Monday's own hex for this label, so the two never disagree on colour. */
  statusColor: string | null
  dueDate: string | null
  /** Which column the date came from, so a wrong one can be spotted. */
  dueLabel: string | null
  mondayUserId: number
  who: string
  itemUpdatedAt: string | null
}

export interface WorkBoard {
  boardId: number
  boardName: string
  rows: WorkRow[]
}

export interface WorkGroup {
  workspaceName: string
  boards: WorkBoard[]
  open: number
  total: number
}

export interface WorklistFilters {
  /** Directory person, resolved to their Monday accounts. */
  personId?: string | null
  /** Portal team, resolved to its members' Monday accounts. */
  teamId?: string | null
  includeDone?: boolean
}

export interface Worklist {
  groups: WorkGroup[]
  open: number
  total: number
  /**
   * Assignees who are neither linked to a person nor marked as outside True
   * North, which a team filter cannot see. Accounts settled either way are not
   * counted: an answered question is not an open one.
   */
  unlinked: number
  /** Assignments riding on those accounts, which is the size of the blind spot. */
  unlinkedAssignments: number
  /** True when the unfiltered view stopped early rather than reading everything. */
  truncated: boolean
  /** How many rows match, whether or not they were all read. */
  matching: number
  /**
   * The OLDEST board read, not the newest.
   *
   * Boards are refreshed in rotation, oldest first, so the newest stamp would
   * say "a minute ago" while some board had not been touched since morning.
   * The oldest is the only number that is true of everything on the page.
   */
  oldestSyncAt: string | null
}

/** Monday accounts belonging to a set of directory people. */
async function accountsFor(supabase: Client, personIds: string[]): Promise<number[]> {
  if (!personIds.length) return []
  const { data } = await supabase
    .from('monday_user_links').select('monday_user_id').in('person_id', personIds)
  return ((data ?? []) as { monday_user_id: number }[]).map(r => r.monday_user_id)
}

export async function loadWorklist(supabase: Client, f: WorklistFilters): Promise<Worklist> {
  // Who are we asking about. An empty array here means "nobody", which is not
  // the same as no filter, so the two cases stay apart.
  let onlyAccounts: number[] | null = null
  if (f.personId) {
    onlyAccounts = await accountsFor(supabase, [f.personId])
  } else if (f.teamId) {
    const { data: members } = await supabase
      .from('team_members').select('person_id').eq('team_id', f.teamId)
    onlyAccounts = await accountsFor(supabase, ((members ?? []) as { person_id: string }[]).map(m => m.person_id))
  }

  const [{ data: boardRows }, { data: stepRows }, { data: linkRows }, { data: userRows }, { data: peopleRows }] =
    await Promise.all([
      supabase.from('monday_boards').select('id, name, workspace_name, included, items_synced_at, date_title'),
      supabase.from('monday_board_steps').select('board_id, people_col, step_name, position, source'),
      supabase.from('monday_user_links').select('monday_user_id, person_id'),
      supabase.from('monday_users').select('id, name, is_external'),
      supabase.from('people').select('id, full_name'),
    ])

  type B = {
    id: number; name: string; workspace_name: string | null; included: boolean
    items_synced_at: string | null; date_title: string | null
  }
  const boardList = (boardRows ?? []) as B[]
  const boards = new Map(boardList.map(b => [b.id, b]))
  const steps = new Map(((stepRows ?? []) as { board_id: number; people_col: string; step_name: string; position: number; source: string }[])
    .map(s => [`${s.board_id}:${s.people_col}`, s]))
  const personByAccount = new Map(((linkRows ?? []) as { monday_user_id: number; person_id: string }[])
    .map(l => [l.monday_user_id, l.person_id]))
  const users = (userRows ?? []) as { id: number; name: string; is_external: boolean }[]
  const mondayName = new Map(users.map(u => [u.id, u.name]))
  // Settled the other way: somebody said this account is a client or an
  // outside collaborator. It has no person on purpose, so counting it as
  // "needs linking" reports a question that was already answered. This is the
  // third reader of that rule; the screen and the discovery had to learn it
  // separately, which is what adding a state to a schema actually costs.
  const externalAccounts = new Set(users.filter(u => u.is_external).map(u => u.id))
  const personName = new Map(((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  type A = {
    id: number; board_id: number; item_id: number; item_name: string
    parent_item_name: string | null; group_title: string | null
    people_col: string; monday_user_id: number
    status_text: string | null; status_done: boolean | null; status_color: string | null
    due_date: string | null; item_updated_at: string | null
  }
  const SELECT = 'id, board_id, item_id, item_name, parent_item_name, group_title, people_col, monday_user_id, status_text, status_done, status_color, due_date, item_updated_at'
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const applyFilters = (q: any): any => {
    let out = q
    if (onlyAccounts) out = out.in('monday_user_id', onlyAccounts)
    if (!f.includeDone) out = out.or('status_done.is.null,status_done.eq.false')
    return out
  }

  if (onlyAccounts && !onlyAccounts.length) {
    return { groups: [], open: 0, total: 0, unlinked: 0, unlinkedAssignments: 0, truncated: false, matching: 0, oldestSyncAt: null }
  }

  // How many match, asked once and counted by the database rather than by
  // reading the rows and measuring the array.
  const { count: matching } = (await applyFilters(
    supabase.from('monday_assignments').select('id', { count: 'exact', head: true }),
  )) as { count: number | null }

  const cap = onlyAccounts ? Number.POSITIVE_INFINITY : UNFILTERED_CAP
  const rows: A[] = []
  let truncated = false
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = (await applyFilters(
      supabase.from('monday_assignments').select(SELECT).order('id', { ascending: true }).range(from, from + PAGE - 1),
    )) as { data: A[] | null; error: { message: string } | null }
    if (error) throw new Error(error.message)
    const page = (data ?? []) as A[]
    rows.push(...page)
    if (page.length < PAGE) break
    if (from + PAGE >= cap) truncated = (matching ?? 0) > rows.length
  }

  const linkedAccounts = new Set(personByAccount.keys())
  const byWorkspace = new Map<string, Map<number, WorkRow[]>>()
  let open = 0
  const accountsOnWork = new Set<number>()
  let unlinkedAssignments = 0

  for (const a of rows) {
    const b = boards.get(a.board_id)
    if (!b || !b.included) continue
    const st = steps.get(`${a.board_id}:${a.people_col}`)
    // A column switched off is not a step, so it is not work.
    if (st?.source === 'off') continue

    const pid = personByAccount.get(a.monday_user_id)
    accountsOnWork.add(a.monday_user_id)
    // Same rule as the links screen, from the same function, so the two
    // screens cannot report different numbers for the same question.
    if (!pid && !externalAccounts.has(a.monday_user_id)) unlinkedAssignments++

    const row: WorkRow = {
      id: a.id,
      boardId: a.board_id,
      boardName: b.name,
      workspaceName: b.workspace_name,
      itemId: a.item_id,
      itemName: a.item_name,
      parentItemName: a.parent_item_name,
      groupTitle: a.group_title,
      stepName: st?.step_name ?? a.people_col,
      statusText: a.status_text,
      statusDone: a.status_done,
      statusColor: a.status_color,
      dueDate: a.due_date,
      dueLabel: b.date_title ?? null,
      mondayUserId: a.monday_user_id,
      who: (pid ? personName.get(pid) : undefined) ?? mondayName.get(a.monday_user_id) ?? `User ${a.monday_user_id}`,
      itemUpdatedAt: a.item_updated_at,
    }
    if (row.statusDone !== true) open++

    const ws = b.workspace_name ?? 'No workspace'
    const inWs = byWorkspace.get(ws) ?? new Map<number, WorkRow[]>()
    byWorkspace.set(ws, inWs)
    inWs.set(a.board_id, [...(inWs.get(a.board_id) ?? []), row])
  }

  const groups: WorkGroup[] = [...byWorkspace.entries()].map(([workspaceName, boardMap]) => {
    const bs: WorkBoard[] = [...boardMap.entries()]
      .map(([boardId, rs]) => ({
        boardId,
        boardName: rs[0].boardName,
        rows: rs.sort((x, y) =>
          Number(x.statusDone) - Number(y.statusDone)
          // Soonest deadline first; a row with no date is not urgent, so it
          // sits behind the dated ones instead of ahead of them.
          || (x.dueDate ? 0 : 1) - (y.dueDate ? 0 : 1)
          || (x.dueDate ?? '').localeCompare(y.dueDate ?? '')
          || (x.parentItemName ?? x.itemName).localeCompare(y.parentItemName ?? y.itemName)),
      }))
      .sort((a, b) => b.rows.length - a.rows.length)
    const total = bs.reduce((s, x) => s + x.rows.length, 0)
    return {
      workspaceName,
      boards: bs,
      total,
      open: bs.reduce((s, x) => s + x.rows.filter(r => r.statusDone !== true).length, 0),
    }
  }).sort((a, b) => b.open - a.open || b.total - a.total)

  const stamps = boardList
    .filter(b => b.included && b.items_synced_at)
    .map(b => b.items_synced_at as string)
    .sort()

  return {
    groups,
    open,
    total: rows.length,
    unlinked: unresolvedAccounts(accountsOnWork, linkedAccounts, externalAccounts).size,
    unlinkedAssignments,
    truncated,
    matching: matching ?? rows.length,
    oldestSyncAt: stamps[0] ?? null,
  }
}
