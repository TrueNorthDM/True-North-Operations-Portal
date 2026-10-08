/**
 * Writes to a person's record that more than one place makes: adding someone
 * (admin/people/actions.ts) and a person's page (directory/[id]/actions.ts).
 * A plain module, not "use server": its callers check access first, and an
 * export of a "use server" file would be an action anyone signed in can call.
 */

import type { Db } from '@/lib/supabase/types'
import { normalPosition } from './people-types'
import { mailboxFilter } from '@/lib/auth/mailbox-filter'

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

/**
 * Set a person's teams to exactly these, with exactly one primary department,
 * in one transaction (set_person_teams, migration 099): the old memberships go
 * and the new ones arrive together, or nothing changes. Needs the privileged
 * client; callers check access first.
 */
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
  const { error } = await db.rpc('set_person_teams', {
    p_person: personId,
    p_teams: entries.map(([team_id, v]) => ({ team_id, position: v.position, is_primary: v.primary })),
  })
  if (error) throw new Error('The teams could not be saved. Nothing changed; try again.')
}

/**
 * The first of these company mailboxes that already belongs to someone else,
 * or null. A sign-in is matched to a person by their mailboxes, so one address
 * must never belong to two people (audit, 8 October 2026). Any of the four
 * address columns counts; an address the matcher refuses to search for is
 * never matched at sign-in either, so it is skipped.
 */
export async function takenMailbox(db: Client, addresses: (string | null)[], exceptPersonId: string | null): Promise<string | null> {
  for (const a of addresses) {
    const filter = a ? mailboxFilter(a.toLowerCase()) : null
    if (!filter) continue
    let q = db.from('people').select('id').or(filter).limit(1)
    if (exceptPersonId) q = q.neq('id', exceptPersonId)
    const { data, error } = await q
    // Fails closed: a read that fails must not let a duplicate through.
    if (error || (data ?? []).length) return a
  }
  return null
}
