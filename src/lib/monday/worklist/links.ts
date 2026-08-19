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

import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 2000

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

async function assignmentCounts(supabase: Client): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('monday_assignments').select('monday_user_id')
      .order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { monday_user_id: number }[]
    for (const r of rows) counts.set(r.monday_user_id, (counts.get(r.monday_user_id) ?? 0) + 1)
    if (rows.length < PAGE) break
  }
  return counts
}

export interface LinkBoard {
  pending: PendingAccount[]
  external: PendingAccount[]
  linked: LinkedAccount[]
  /** Ids on work with no monday_users row at all: discovery has not seen them. */
  unknownIds: { mondayUserId: number; assignments: number }[]
}

export async function loadLinkBoard(supabase: Client): Promise<LinkBoard> {
  const [{ data: userRows }, { data: linkRows }, { data: peopleRows }, counts] = await Promise.all([
    supabase.from('monday_users').select('id, name, email, enabled, is_guest, is_external'),
    supabase.from('monday_user_links').select('monday_user_id, person_id, linked_by'),
    supabase.from('people').select('id, full_name, status'),
    assignmentCounts(supabase),
  ])

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

  const pending = users.filter(u => !linkedIds.has(u.id) && !u.is_external).map(toPending).sort(bySize)
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

  const known = new Set(users.map(u => u.id))
  const unknownIds = [...counts.entries()]
    .filter(([id]) => !known.has(id))
    .map(([mondayUserId, assignments]) => ({ mondayUserId, assignments }))
    .sort(bySize)

  return { pending, external, linked, unknownIds }
}
