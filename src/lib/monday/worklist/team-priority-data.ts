// Reading team priority: who is on which team, and the order a team saved.
//
// The rules live in team-priority.ts; this is only the database side of them.

import type { Db } from '@/lib/supabase/types'
import {
  baseOrder, cleanLevels, defaultOrder, hasLevels, isGrantScope, stepKey, teamRanking,
  type GrantScope, type Levels, type Membership, type Ranking, type SavedOrder,
} from './team-priority'
import type { WorkRow } from './data'
import { missingColumn } from './missing-column'
import { placedAbove } from './order-bands'

type Client = Db

/** A person's teams, with the position they hold on each. */
export async function loadMemberships(supabase: Client, personId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id, is_primary, position, teams(name)')
    .eq('person_id', personId)
  type R = { team_id: string; is_primary: boolean | null; position: string | null; teams: { name: string } | { name: string }[] | null }
  return ((data ?? []) as R[]).map(r => ({
    teamId: r.team_id,
    teamName: (Array.isArray(r.teams) ? r.teams[0]?.name : r.teams?.name) ?? 'Team',
    isPrimary: r.is_primary === true,
    position: r.position,
  }))
}

export interface SavedTeamOrder {
  /** False until migration 084 has been run: the feature stays out of sight. */
  available: boolean
  /** False until migration 087 has been run: the editor orders single items only. */
  levelsAvailable: boolean
  saved: SavedOrder | null
  updatedAt: string | null
  updatedById: string | null
  updatedByName: string | null
}

/** A read that failed because the table is not there yet, rather than for any other reason. */
function missingTable(error: { code?: string; message?: string } | null, table = 'monday_team_priority'): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || (error.message ?? '').includes(table)
}

/**
 * Whether migration 084 has been run, for a page that has no team's order to read.
 * A plain read of one row, not a HEAD request: a HEAD answer has no body, so
 * the error that names the missing table would never arrive.
 */
export async function priorityTableExists(supabase: Client): Promise<boolean> {
  const { error } = await supabase.from('monday_team_priority').select('team_id').limit(1)
  return !error
}

/** Enough of a team's saved order to know whether it has one, without reading the whole list. */
export interface OrderSummary {
  /** Steps placed by hand when it was saved, some of which may be finished since. */
  placed: number
  /** Anything that makes the list differ from True North's: steps placed, or a workspace or board order. */
  ordered: boolean
  updatedAt: string | null
}

/** A stored level list, read back as the lists it was written as. */
function levelsFrom(workspaces: unknown, boards: unknown): Levels | null {
  return cleanLevels({ workspaces: workspaces ?? [], boards: boards ?? [] })
}

/**
 * Which of these teams have an order, read in one small query.
 *
 * A team's full saved order is a list of every open step (about 40 KB for SEO),
 * and ranking a person's list against it means reading the whole team's work as
 * well. Most pages do not need either: nobody on the team has set an order, and
 * the person looking cannot set one. This is what the page asks first.
 */
export async function loadOrderSummaries(
  supabase: Client,
  teamIds: string[],
): Promise<{ available: boolean; byTeam: Map<string, OrderSummary> }> {
  if (!teamIds.length) return { available: await priorityTableExists(supabase), byTeam: new Map() }
  const read = (cols: string) => supabase.from('monday_team_priority').select(cols).in('team_id', teamIds)
  let { data, error } = await read('team_id, pinned, updated_at, workspace_order, board_order')
  // Migration 087 adds the level columns. Without them a team's order is its
  // placed steps alone, which is what it was before.
  if (missingColumn(error, 'workspace_order') || missingColumn(error, 'board_order')) {
    ;({ data, error } = await read('team_id, pinned, updated_at'))
  }
  if (error) {
    if (!missingTable(error)) console.error('[team-priority] reading saved orders failed:', error.message)
    return { available: false, byTeam: new Map() }
  }
  type R = { team_id: string; pinned: unknown; updated_at: string | null; workspace_order?: unknown; board_order?: unknown }
  return {
    available: true,
    byTeam: new Map(((data ?? []) as unknown as R[]).map(r => {
      const placed = Array.isArray(r.pinned) ? r.pinned.length : 0
      return [r.team_id, {
        placed,
        ordered: placed > 0 || hasLevels(levelsFrom(r.workspace_order, r.board_order)),
        updatedAt: r.updated_at,
      }]
    })),
  }
}

export async function loadSavedOrder(supabase: Client, teamId: string): Promise<SavedTeamOrder> {
  const read = (cols: string) => supabase.from('monday_team_priority').select(cols).eq('team_id', teamId).maybeSingle()
  let levelsAvailable = true
  let { data, error } = await read('step_order, pinned, updated_at, updated_by, workspace_order, board_order')
  // Migration 087 adds the level columns. Until it is run the order is read
  // without them and the editor offers single items only, as it did before.
  if (missingColumn(error, 'workspace_order') || missingColumn(error, 'board_order')) {
    levelsAvailable = false
    ;({ data, error } = await read('step_order, pinned, updated_at, updated_by'))
  }
  const none = { saved: null, updatedAt: null, updatedById: null, updatedByName: null }
  // Any failure hides the feature for this page load rather than failing My
  // Work: a list in the default order is still the list. Only the missing table
  // is expected, so anything else is said in the server log.
  if (error) {
    if (!missingTable(error)) console.error('[team-priority] reading the saved order failed:', error.message)
    return { available: false, levelsAvailable: false, ...none }
  }

  const row = data as unknown as {
    step_order: unknown; pinned: unknown; updated_at: string | null; updated_by: string | null
    workspace_order?: unknown; board_order?: unknown
  } | null
  if (!row) return { available: true, levelsAvailable, ...none }

  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [])
  let updatedByName: string | null = null
  if (row.updated_by) {
    const { data: who } = await supabase.from('people').select('full_name').eq('id', row.updated_by).maybeSingle()
    updatedByName = (who as { full_name: string } | null)?.full_name ?? null
  }
  return {
    available: true,
    levelsAvailable,
    saved: {
      order: strings(row.step_order),
      pinned: strings(row.pinned),
      levels: levelsAvailable ? levelsFrom(row.workspace_order, row.board_order) : null,
    },
    updatedAt: row.updated_at,
    updatedById: row.updated_by,
    updatedByName,
  }
}

/**
 * A team's open steps in the team's base order (True North's, then its workspace
 * and board order, if it has one), and the team's order over them once the
 * steps placed by hand take their places.
 *
 * `rows` may hold finished work as well; only open steps have a place.
 */
export function rankTeam(rows: WorkRow[], saved: SavedOrder | null): { open: WorkRow[]; ranking: Ranking; trueNorth: string[] } {
  const eligible = rows.filter(r => r.statusDone !== true && r.assigneeKnown)
  const open = baseOrder(eligible, saved?.levels ?? null)
  // True North's own order for the same steps, whatever levels the team set:
  // the place every row is compared with on My Work and in the editor.
  return { open, ranking: teamRanking(open.map(stepKey), saved), trueNorth: defaultOrder(eligible).map(stepKey) }
}

/**
 * Every open row given its place in the team's order, and what the bands on
 * My Work read (order-bands.ts): its place in True North's order, whether it
 * was placed by hand, and how many steps placed by hand come before it.
 * Finished rows are left without any of it.
 */
export function withTeamRanks(rows: WorkRow[], ranking: Ranking, trueNorth: string[] = []): WorkRow[] {
  const place = new Map(ranking.keys.map((k, i) => [k, i + 1]))
  const tn = new Map(trueNorth.map((k, i) => [k, i + 1]))
  const above = placedAbove(ranking)
  return rows.map(r => {
    if (r.statusDone === true) return r
    const k = stepKey(r)
    return { ...r, teamRank: place.get(k) ?? null, tnRank: tn.get(k) ?? null, placedByHand: ranking.pinned.has(k), placedAbove: above.get(k) ?? null }
  })
}

// ── People given team priority by name (migration 085) ─────────────────────

/** This person's by-name right to set team priorities, or null. Null too until migration 085 is run. */
export async function loadPriorityGrant(supabase: Client, personId: string): Promise<GrantScope | null> {
  const { data, error } = await supabase
    .from('monday_priority_grants')
    .select('scope')
    .eq('person_id', personId)
    .maybeSingle()
  if (error) {
    if (!missingTable(error, 'monday_priority_grants')) console.error('[team-priority] reading a grant failed:', error.message)
    return null
  }
  const scope = (data as { scope?: unknown } | null)?.scope
  return isGrantScope(scope) ? scope : null
}

export interface PriorityGrant {
  personId: string
  scope: GrantScope
  grantedAt: string | null
  grantedBy: string | null
}

/** Everyone given team priority by name, for the Access levels page. */
export async function loadPriorityGrants(supabase: Client): Promise<{ available: boolean; grants: PriorityGrant[] }> {
  const { data, error } = await supabase
    .from('monday_priority_grants')
    .select('person_id, scope, granted_at, granted_by')
  if (error) {
    if (!missingTable(error, 'monday_priority_grants')) console.error('[team-priority] reading grants failed:', error.message)
    return { available: false, grants: [] }
  }
  type R = { person_id: string; scope: unknown; granted_at: string | null; granted_by: string | null }
  return {
    available: true,
    grants: ((data ?? []) as R[]).flatMap(r => isGrantScope(r.scope)
      ? [{ personId: r.person_id, scope: r.scope, grantedAt: r.granted_at, grantedBy: r.granted_by }]
      : []),
  }
}
