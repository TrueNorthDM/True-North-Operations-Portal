// Who is in scope, and which team they belong to.
//
// Shared by the People and Workload tabs. The team a person is shown under
// decides their avatar colour and the label under their name, and two tabs
// answering that differently for the same person is the kind of thing nobody
// reports as a bug and everybody quietly distrusts.

import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

export type ActivePerson = { id: string; full_name: string; weekly_hours: number | null }

export async function activePeople(
  supabase: Client, f: { personId?: string | null; teamId?: string | null },
): Promise<ActivePerson[]> {
  let ids: string[] | null = null
  if (f.personId) ids = [f.personId]
  else if (f.teamId) {
    const { data } = await supabase.from('team_members').select('person_id').eq('team_id', f.teamId)
    ids = ((data ?? []) as { person_id: string }[]).map(m => m.person_id)
    if (!ids.length) return []
  }

  let q = supabase.from('people').select('id, full_name, weekly_hours').eq('status', 'active')
  if (ids) q = q.in('id', ids)
  const { data } = await q.order('full_name')
  return (data ?? []) as ActivePerson[]
}

/**
 * The team each person is shown under.
 *
 * team_members carries the primary flag, and this follows it rather than
 * taking whichever row came back first, which is what the rest of the portal
 * does and what somebody looking at two pages will expect.
 */
export async function primaryTeams(supabase: Client, personIds: string[]): Promise<Map<string, string>> {
  if (!personIds.length) return new Map()

  const { data } = await supabase
    .from('team_members')
    .select('person_id, is_primary, teams(name)')
    .in('person_id', personIds)

  // PostgREST returns the joined row as an object or an array depending on
  // how it infers the relationship, so both shapes are handled rather than
  // trusting one and quietly getting no team names at all.
  type Membership = { person_id: string; is_primary: boolean; teams: { name: string } | { name: string }[] | null }
  const nameOf = (t: Membership['teams']) => (Array.isArray(t) ? t[0]?.name : t?.name) ?? null

  const out = new Map<string, string>()
  for (const m of (data ?? []) as unknown as Membership[]) {
    const name = nameOf(m.teams)
    if (!name) continue
    if (m.is_primary || !out.has(m.person_id)) out.set(m.person_id, name)
  }
  return out
}
