// Who is in scope, and which team they belong to.
//
// Shared by the People and Workload tabs. The team a person is shown under
// decides their avatar colour and the label under their name, and two tabs
// answering that differently for the same person is the kind of thing nobody
// reports as a bug and everybody quietly distrusts.
//
// Read with the server's own client (lib/report/data.ts), narrowed by the
// filter the app decided; a read that fails stops the page.

import { primaryTeamByPerson } from '@/lib/directory/primary-team'
import { peopleInFilter, type PeopleFilter } from '@/lib/monday/worklist/data'
import { teamColoursFrom, type TeamColours } from '@/lib/directory/team-colour'
import { failed, reportDb } from './data'

export type ActivePerson = { id: string; full_name: string; weekly_hours: number | null }
export type ScopedPerson = ActivePerson & { active: boolean }

/** Everyone the filter names, active or not, by name. */
export async function peopleInScope(f: PeopleFilter): Promise<ScopedPerson[]> {
  const db = reportDb()
  const ids = await peopleInFilter(db, f)
  if (ids && !ids.length) return []

  const out: ScopedPerson[] = []
  const read = async (slice: string[] | null) => {
    let q = db.from('people').select('id, full_name, weekly_hours, status')
    if (slice) q = q.in('id', slice)
    const { data, error } = await q.order('full_name')
    failed('the directory', error)
    for (const p of (data ?? []) as (ActivePerson & { status: string })[]) {
      out.push({ id: p.id, full_name: p.full_name, weekly_hours: p.weekly_hours, active: p.status === 'active' })
    }
  }
  if (ids === null) await read(null)
  else for (let i = 0; i < ids.length; i += 200) await read(ids.slice(i, i + 200))
  return ids && ids.length > 200 ? out.sort((a, b) => a.full_name.localeCompare(b.full_name)) : out
}

export async function activePeople(f: PeopleFilter): Promise<ActivePerson[]> {
  return (await peopleInScope(f)).filter(p => p.active)
}

/** Every team's colour, from the database, falling back by name. */
export async function teamColours(): Promise<TeamColours> {
  const { data, error } = await reportDb().from('teams').select('name, color')
  failed('the teams', error)
  return teamColoursFrom((data ?? []) as { name: string; color: string | null }[])
}

type Membership = {
  person_id: string; team_id: string; is_primary: boolean
  teams: { name: string } | { name: string }[] | null
}

async function memberships(personIds: string[]): Promise<Membership[]> {
  const out: Membership[] = []
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await reportDb()
      .from('team_members')
      .select('person_id, team_id, is_primary, teams(name)')
      .in('person_id', personIds.slice(i, i + 200))
    failed('the team members', error)
    out.push(...((data ?? []) as unknown as Membership[]))
  }
  return out
}

/**
 * The team each person is shown under.
 *
 * team_members carries the primary flag, and this follows it rather than
 * taking whichever row came back first, which is what the rest of the portal
 * does and what somebody looking at two pages will expect.
 */
export async function primaryTeams(personIds: string[]): Promise<Map<string, string>> {
  if (!personIds.length) return new Map()

  // PostgREST returns the joined row as an object or an array depending on
  // how it infers the relationship, so both shapes are handled rather than
  // trusting one and quietly getting no team names at all.
  const nameOf = (t: Membership['teams']) => (Array.isArray(t) ? t[0]?.name : t?.name) ?? null

  const rows = (await memberships(personIds)).flatMap(m => {
    const name = nameOf(m.teams)
    return name ? [{ personId: m.person_id, team: { name }, isPrimary: m.is_primary === true }] : []
  })
  // The portal's one rule for a main team (lib/directory/primary-team).
  return new Map([...primaryTeamByPerson(rows)].map(([id, t]) => [id, t.name]))
}

/** Every team each person is on, primary or not: what a team filter matches. */
export async function teamsOf(personIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!personIds.length) return out
  for (const m of await memberships(personIds)) {
    out.set(m.person_id, [...(out.get(m.person_id) ?? []), m.team_id])
  }
  return out
}
