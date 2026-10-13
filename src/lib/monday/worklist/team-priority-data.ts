// Reading team priority: who is on which team, and the order a team saved.
//
// The rules live in team-priority.ts; this is only the database side of them.

import type { Db } from '@/lib/supabase/types'
import {
  baseOrder, cleanLevels, defaultOrder, hasLevels, isGrantScope, stepKey, teamRanking,
  type GrantScope, type Levels, type Membership, type Ranking, type SavedOrder,
} from './team-priority'
import type { WorkRow } from './data'
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
  saved: SavedOrder | null
  updatedAt: string | null
  updatedById: string | null
  updatedByName: string | null
}

/** A read that failed because the table is not there yet, rather than for any other reason. */
function missingTable(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || (error.message ?? '').includes(table)
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
): Promise<Map<string, OrderSummary> | null> {
  if (!teamIds.length) return new Map()
  const { data, error } = await supabase.from('monday_team_priority')
    .select('team_id, pinned, updated_at, workspace_order, board_order')
    .in('team_id', teamIds)
  // A failed read leaves the list in the default order for this page load
  // (null) rather than failing My Work: a list in the default order is still
  // the list. The compatibility reads for migrations 084 and 087 are gone,
  // both ran long ago (audit, 13 October 2026).
  if (error) {
    console.error('[team-priority] reading saved orders failed:', error.message)
    return null
  }
  type R = { team_id: string; pinned: unknown; updated_at: string | null; workspace_order: unknown; board_order: unknown }
  return new Map(((data ?? []) as unknown as R[]).map(r => {
    const placed = Array.isArray(r.pinned) ? r.pinned.length : 0
    return [r.team_id, {
      placed,
      ordered: placed > 0 || hasLevels(levelsFrom(r.workspace_order, r.board_order)),
      updatedAt: r.updated_at,
    }]
  }))
}

/**
 * A team's saved order, with who saved it. Null when the read failed: the
 * page then shows the list in the default order, and logs why.
 */
export async function loadSavedOrder(supabase: Client, teamId: string): Promise<SavedTeamOrder | null> {
  const { data, error } = await supabase.from('monday_team_priority')
    .select('step_order, pinned, updated_at, updated_by, workspace_order, board_order')
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) {
    console.error('[team-priority] reading the saved order failed:', error.message)
    return null
  }

  const row = data as unknown as {
    step_order: unknown; pinned: unknown; updated_at: string | null; updated_by: string | null
    workspace_order: unknown; board_order: unknown
  } | null
  if (!row) return { saved: null, updatedAt: null, updatedById: null, updatedByName: null }

  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [])
  let updatedByName: string | null = null
  if (row.updated_by) {
    const { data: who } = await supabase.from('people').select('full_name').eq('id', row.updated_by).maybeSingle()
    updatedByName = (who as { full_name: string } | null)?.full_name ?? null
  }
  return {
    saved: {
      order: strings(row.step_order),
      pinned: strings(row.pinned),
      levels: levelsFrom(row.workspace_order, row.board_order),
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
