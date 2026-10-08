/**
 * Writes to a person's record that more than one place makes: adding someone
 * (admin/people/actions.ts) and a person's page (directory/[id]/actions.ts).
 * A plain module, not "use server": its callers check access first, and an
 * export of a "use server" file would be an action anyone signed in can call.
 */

import type { Db } from '@/lib/supabase/types'
import { normalPosition } from './people-types'

type Client = Db

/** Friendlier message for the one-account-per-person unique index. */
export function mapPersonError(message: string): string {
  if (/people_profile_id_unique/.test(message)) return 'That portal account is already linked to another person.'
  return message
}

/**
 * Would setting `id`'s manager to `newManagerId` make a reporting loop? Walks up
 * from the proposed manager; coming back to `id` is a loop. The `seen` set also
 * stops on a loop already in the data. Guards the org chart's tree.
 */
export async function wouldCreateCycle(db: Client, id: string, newManagerId: string): Promise<boolean> {
  if (newManagerId === id) return true
  const { data } = await db.from('people').select('id, manager_id')
  const mgr = new Map(((data ?? []) as { id: string; manager_id: string | null }[]).map(p => [p.id, p.manager_id]))
  const seen = new Set<string>([id])
  let cur: string | null = newManagerId
  while (cur) {
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = mgr.get(cur) ?? null
  }
  return false
}

/** Set a person's teams to exactly these, with exactly one primary department. */
export async function setPersonTeams(db: Client, personId: string, teams: { teamId: string; position: string; primary?: boolean }[]) {
  const byTeam = new Map<string, { position: string; primary: boolean }>()
  for (const t of teams) if (t.teamId) byTeam.set(t.teamId, { position: normalPosition(t.position), primary: !!t.primary })
  const entries = [...byTeam]
  // Exactly one primary: the first team if none was chosen, the first one if several were.
  if (entries.length && !entries.some(([, v]) => v.primary)) entries[0][1].primary = true
  let primarySeen = false
  for (const [, v] of entries) {
    if (!v.primary) continue
    if (primarySeen) v.primary = false
    else primarySeen = true
  }
  const { error: delErr } = await db.from('team_members').delete().eq('person_id', personId)
  if (delErr) throw new Error(delErr.message)
  const rows = entries.map(([team_id, v]) => ({ team_id, person_id: personId, position: v.position, is_primary: v.primary }))
  if (rows.length) {
    const { error } = await db.from('team_members').insert(rows)
    if (error) throw new Error(error.message)
  }
}
