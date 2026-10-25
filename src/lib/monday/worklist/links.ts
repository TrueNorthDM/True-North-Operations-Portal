// Resolving a Monday account to a person, or deciding it is nobody's.
//
// Every assignment carries a Monday user id. Until that id is attached to a
// directory person, the work shows on the list but sits outside every team
// filter, which is the quiet failure this screen exists to end.
//
// Two answers are legitimate and the screen offers both. "This is Ashery" and
// "this is the client's own staff" are equally final; modelling only the first
// leaves the second reported as unresolved forever, and a pending list that
// never empties is a pending list nobody reads.

import type { Db } from '@/lib/supabase/types'
import { selectAllPages } from './resilience'
import { assignmentCounts } from './counts'

type Client = Db


/**
 * Accounts that still owe an answer, decided in one place.
 *
 * This rule has been written from scratch three times today, in the links
 * screen, in the discovery output and in the My Work counter, and the three
 * disagreed: one of them said 23 while another said none were pending. A
 * number nobody can reconcile is worse than no number, so both readers now
 * call this and a disagreement becomes impossible rather than merely unlikely.
 *
 * Unresolved means: this account is named on work, no directory person owns
 * it, and nobody has said it belongs outside True North. Both settlements are
 * final; only the absence of either is a question.
 */
export function unresolvedAccounts(
  onWork: Iterable<number>,
  linked: ReadonlySet<number>,
  external: ReadonlySet<number>,
): Set<number> {
  const out = new Set<number>()
  for (const id of onWork) if (!linked.has(id) && !external.has(id)) out.add(id)
  return out
}

/**
 * The accounts the screen lists as "Waiting on an answer": no person owns
 * them and nobody has said they are outside True North. The screen and the
 * rail's "Accounts to link" (owner, 25 October 2026) both read it here.
 */
export function waitingOnAnswer<U extends { id: number; is_external: boolean }>(users: readonly U[], linked: { has(id: number): boolean }): U[] {
  return users.filter(u => !linked.has(u.id) && !u.is_external)
}

/**
 * How many accounts wait on an answer, without the screen's assignment counts
 * and suggestions: two small reads.
 */
export async function countWaitingOnAnswer(supabase: Client): Promise<number> {
  const [userRead, linkRead] = await Promise.all([
    selectAllPages((from, to) => supabase.from('monday_users').select('id, is_external').order('id').range(from, to)),
    selectAllPages((from, to) => supabase.from('monday_user_links').select('monday_user_id').order('monday_user_id').range(from, to)),
  ])
  for (const [what, r] of [['Monday accounts', userRead], ['account links', linkRead]] as const) {
    if (r.error) throw new Error(`Could not read the ${what}: ${r.error.message}`)
  }
  const linked = new Set((linkRead.data as { monday_user_id: number }[]).map(l => l.monday_user_id))
  return waitingOnAnswer(userRead.data as { id: number; is_external: boolean }[], linked).length
}

export interface PendingAccount {
  mondayUserId: number
  name: string
  email: string | null
  enabled: boolean
  isGuest: boolean
  isExternal: boolean
  /** How much work is riding on this being resolved. */
  assignments: number
  /** Best directory match, offered as a click rather than applied. */
  suggestion: { personId: string; personName: string; why: string } | null
}

export interface LinkedAccount {
  mondayUserId: number
  name: string
  personId: string
  personName: string
  linkedBy: string
  assignments: number
}

/** Everything after the first name, so "Ashery Boniface Lwimbo" can meet "Ashery Lwimbo". */
function nameKey(full: string): string {
  const parts = full.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts.join(' ')
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export interface LinkBoard {
  pending: PendingAccount[]
  external: PendingAccount[]
  linked: LinkedAccount[]
  /**
   * Exactly the accounts the My Work banner counts: named on work, owned by
   * nobody, not settled as outside. Named rather than tallied, because a count
   * on its own cannot be checked or acted on.
   */
  onWorkUnresolved: { mondayUserId: number; name: string; email: string | null; assignments: number; known: boolean }[]
}

export async function loadLinkBoard(supabase: Client): Promise<LinkBoard> {
  const [userRead, linkRead, peopleRead, counted] = await Promise.all([
    selectAllPages((from, to) => supabase.from('monday_users').select('id, name, email, enabled, is_guest, is_external').order('id').range(from, to)),
    selectAllPages((from, to) => supabase.from('monday_user_links').select('monday_user_id, person_id, linked_by').order('monday_user_id').range(from, to)),
    selectAllPages((from, to) => supabase.from('people').select('id, full_name, status').order('id').range(from, to)),
    assignmentCounts(supabase),
  ])
  // A failed read is not an empty one: every account would show as pending
  // (audit, 10 October 2026).
  for (const [what, r] of [['Monday accounts', userRead], ['account links', linkRead], ['people', peopleRead]] as const) {
    if (r.error) throw new Error(`Could not read the ${what}: ${r.error.message}`)
  }
  const userRows = userRead.data, linkRows = linkRead.data, peopleRows = peopleRead.data
  const counts = counted.accounts

  type U = { id: number; name: string; email: string | null; enabled: boolean; is_guest: boolean; is_external: boolean }
  type P = { id: string; full_name: string; status: string }
  const users = (userRows ?? []) as U[]
  const links = (linkRows ?? []) as { monday_user_id: number; person_id: string; linked_by: string }[]
  const people = (peopleRows ?? []) as P[]

  const linkedIds = new Map(links.map(l => [l.monday_user_id, l]))
  const personName = new Map(people.map(p => [p.id, p.full_name]))

  // Suggestions by first + last name. Offered, never applied: putting somebody
  // else's work on your list is worse than leaving it unassigned, so a machine
  // proposes and a person decides.
  const byNameKey = new Map<string, P[]>()
  for (const p of people) {
    const k = nameKey(p.full_name)
    byNameKey.set(k, [...(byNameKey.get(k) ?? []), p])
  }
  const takenPersonIds = new Set(links.map(l => l.person_id))

  const toPending = (u: U): PendingAccount => {
    const hits = (byNameKey.get(nameKey(u.name)) ?? []).filter(p => !takenPersonIds.has(p.id))
    const one = hits.length === 1 ? hits[0] : null
    return {
      mondayUserId: u.id,
      name: u.name,
      email: u.email,
      enabled: u.enabled,
      isGuest: u.is_guest,
      isExternal: u.is_external,
      assignments: counts.get(u.id) ?? 0,
      suggestion: one
        ? { personId: one.id, personName: one.full_name, why: 'first and last name match' }
        : null,
    }
  }

  const bySize = (a: { assignments: number }, b: { assignments: number }) => b.assignments - a.assignments

  const pending = waitingOnAnswer(users, linkedIds).map(toPending).sort(bySize)
  const external = users.filter(u => u.is_external).map(toPending).sort(bySize)
  const linked: LinkedAccount[] = users
    .filter(u => linkedIds.has(u.id))
    .map(u => {
      const l = linkedIds.get(u.id)!
      return {
        mondayUserId: u.id,
        name: u.name,
        personId: l.person_id,
        personName: personName.get(l.person_id) ?? '(person removed)',
        linkedBy: l.linked_by,
        assignments: counts.get(u.id) ?? 0,
      }
    })
    .sort(bySize)

  const knownIds = new Set(users.map(u => u.id))
  const externalIds = new Set(users.filter(u => u.is_external).map(u => u.id))
  const linkedSet = new Set(links.map(l => l.monday_user_id))
  const nameById = new Map(users.map(u => [u.id, u]))

  const onWorkUnresolved = [...unresolvedAccounts(counts.keys(), linkedSet, externalIds)]
    .map(id => {
      const u = nameById.get(id)
      return {
        mondayUserId: id,
        name: u?.name ?? `Unknown account ${id}`,
        email: u?.email ?? null,
        assignments: counts.get(id) ?? 0,
        known: knownIds.has(id),
      }
    })
    .sort(bySize)

  return { pending, external, linked, onWorkUnresolved }
}
