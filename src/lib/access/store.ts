/**
 * Reading the access tables (migration 094) with the privileged client: the
 * rules (ticks and tool team lists), and people as the rule sees them (level,
 * teams, exceptions). The signed-in role reads none of these tables; the
 * server reads them for a person it has already identified.
 *
 * Every reader degrades to the catalogue's defaults while the migration has
 * not been run, so a deploy that lands before it does not lock anyone out of
 * what they had (tools then follow nobody's list but the Super Admins').
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isLeadPosition, type ConfigurableLevel } from './catalogue'
import { levelOf, ruleKey, type Audience, type Exception, type Rules, type Subject, type ToolScope } from './decide'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

export async function loadRules(db: Client): Promise<Rules> {
  const [r, s, t] = await Promise.all([
    db.from('access_rules').select('level, item_key, allowed'),
    db.from('access_tool_scope').select('item_key, every_team'),
    db.from('access_tool_teams').select('item_key, team_id, audience'),
  ])
  const levels = new Map<string, boolean>()
  for (const row of (r.data ?? []) as { level: ConfigurableLevel; item_key: string; allowed: boolean }[]) {
    levels.set(ruleKey(row.level, row.item_key), row.allowed)
  }
  const tools = new Map<string, { every: boolean; teams: Map<string, Audience> }>()
  const scopeOf = (k: string) => tools.get(k) ?? tools.set(k, { every: false, teams: new Map() }).get(k)!
  for (const row of (s.data ?? []) as { item_key: string; every_team: boolean }[]) scopeOf(row.item_key).every = row.every_team
  for (const row of (t.data ?? []) as { item_key: string; team_id: string; audience: Audience }[]) scopeOf(row.item_key).teams.set(row.team_id, row.audience)
  return { levels, tools: tools as Map<string, ToolScope> }
}

export interface PersonSubject extends Subject {
  id: string
  name: string
  /** The level given (Super Admin, Admin), or null for automatic. */
  given: 'super_admin' | 'admin' | null
  profileId: string | null
  status: string | null
}

type PersonRow = { id: string; full_name: string; access_level: string | null; profile_id: string | null; status: string | null }
type MemberRow = { person_id: string; team_id: string; position: string | null }
type ExceptionRow = { person_id: string; item_key: string; effect: 'grant' | 'deny'; until: string | null }

function build(p: PersonRow, members: readonly MemberRow[], exceptions: readonly ExceptionRow[]): PersonSubject {
  const teams = new Map<string, boolean>()
  for (const m of members) teams.set(m.team_id, (teams.get(m.team_id) ?? false) || isLeadPosition(m.position))
  const given = p.access_level === 'super_admin' || p.access_level === 'admin' ? p.access_level : null
  return {
    id: p.id, name: p.full_name, given, profileId: p.profile_id, status: p.status,
    level: levelOf(given, [...teams.values()].some(Boolean)),
    teams,
    exceptions: exceptions.map((e): Exception => ({ key: e.item_key, effect: e.effect, until: e.until })),
  }
}

/** Everyone active, as the rule sees them: for the Access page, its impact and the notifications. */
export async function loadSubjects(db: Client, opts: { includeInactive?: boolean } = {}): Promise<PersonSubject[]> {
  let q = db.from('people').select('id, full_name, access_level, profile_id, status').order('full_name')
  if (!opts.includeInactive) q = q.or('status.is.null,status.eq.active')
  const [{ data: people }, { data: members }, { data: exc }] = await Promise.all([
    q,
    db.from('team_members').select('person_id, team_id, position'),
    db.from('access_exceptions').select('person_id, item_key, effect, until').is('ended_at', null),
  ])
  const byPerson = new Map<string, MemberRow[]>()
  for (const m of (members ?? []) as MemberRow[]) (byPerson.get(m.person_id) ?? byPerson.set(m.person_id, []).get(m.person_id)!).push(m)
  const excBy = new Map<string, ExceptionRow[]>()
  for (const e of (exc ?? []) as ExceptionRow[]) (excBy.get(e.person_id) ?? excBy.set(e.person_id, []).get(e.person_id)!).push(e)
  return ((people ?? []) as PersonRow[]).map(p => build(p, byPerson.get(p.id) ?? [], excBy.get(p.id) ?? []))
}

/** One person, as the rule sees them. */
export async function loadSubject(db: Client, personId: string): Promise<PersonSubject | null> {
  const [{ data: p }, { data: members }, { data: exc }] = await Promise.all([
    db.from('people').select('id, full_name, access_level, profile_id, status').eq('id', personId).maybeSingle(),
    db.from('team_members').select('person_id, team_id, position').eq('person_id', personId),
    db.from('access_exceptions').select('person_id, item_key, effect, until').eq('person_id', personId).is('ended_at', null),
  ])
  if (!p) return null
  return build(p as PersonRow, (members ?? []) as MemberRow[], (exc ?? []) as ExceptionRow[])
}

/** team id -> name, for the reasons the Access page shows. */
export async function loadTeamNames(db: Client): Promise<Map<string, string>> {
  const { data } = await db.from('teams').select('id, name')
  return new Map(((data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]))
}
