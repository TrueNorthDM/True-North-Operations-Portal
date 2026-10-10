// Who was this account?
//
// For an account Monday has deleted, the id is all that survives and no query
// will name it. The work is still here though, and the shape of the work
// identifies a person better than a name would: which boards, which steps,
// over which years, and above all who else was on the same items. People are
// recognisable by the company they keep on a board.

import type { Db } from '@/lib/supabase/types'
import { selectAllPages } from './resilience'
import { zoneDate } from '@/lib/notifications/schedule'

function failed(what: string, error: { message?: string } | null | undefined): void {
  if (error) throw new Error(`Could not read ${what}: ${error.message}`)
}

type Client = Db

export interface AccountProfile {
  mondayUserId: number
  name: string | null
  email: string | null
  enabled: boolean | null
  isGuest: boolean | null
  isExternal: boolean
  linkedTo: string | null
  assignments: number
  boards: { name: string; workspace: string | null; count: number }[]
  steps: { name: string; count: number }[]
  firstDue: string | null
  lastDue: string | null
  lastTouched: string | null
  alongside: { name: string; count: number }[]
  sample: { item: string; parent: string | null; due: string | null }[]
}

export async function loadAccountProfile(supabase: Client, id: number): Promise<AccountProfile> {
  // Every read here fails loudly: a page that failed read as "0 assignments"
  // (audit, 10 October 2026).
  const [userRead, linkRead] = await Promise.all([
    supabase.from('monday_users').select('id, name, email, enabled, is_guest, is_external').eq('id', id).maybeSingle(),
    supabase.from('monday_user_links').select('person_id').eq('monday_user_id', id).maybeSingle(),
  ])
  failed('the account', userRead.error ?? linkRead.error)
  const user = userRead.data, link = linkRead.data
  const u = user as { name: string; email: string | null; enabled: boolean; is_guest: boolean; is_external: boolean } | null

  let linkedTo: string | null = null
  if (link) {
    const { data: p, error } = await supabase.from('people').select('full_name')
      .eq('id', (link as { person_id: string }).person_id).maybeSingle()
    failed('the person', error)
    linkedTo = (p as { full_name: string } | null)?.full_name ?? null
  }

  type A = {
    board_id: number; item_id: number; item_name: string; parent_item_name: string | null
    people_col: string; due_date: string | null; item_updated_at: string | null
  }
  const rows: A[] = []
  const assigned = await selectAllPages<A>((from, to) => supabase
    .from('monday_assignments')
    .select('board_id, item_id, item_name, parent_item_name, people_col, due_date, item_updated_at')
    .eq('monday_user_id', id)
    .order('id', { ascending: true }).range(from, to))
  failed('their assignments', assigned.error)
  rows.push(...assigned.data)

  const base: AccountProfile = {
    mondayUserId: id,
    name: u?.name ?? null,
    email: u?.email ?? null,
    enabled: u?.enabled ?? null,
    isGuest: u?.is_guest ?? null,
    isExternal: u?.is_external ?? false,
    linkedTo,
    assignments: rows.length,
    boards: [], steps: [], firstDue: null, lastDue: null, lastTouched: null, alongside: [], sample: [],
  }
  if (!rows.length) return base

  const [boardRead, stepRead] = await Promise.all([
    selectAllPages((from, to) => supabase.from('monday_boards').select('id, name, workspace_name').order('id').range(from, to)),
    selectAllPages((from, to) => supabase.from('monday_board_steps').select('board_id, people_col, step_name')
      .order('board_id').order('people_col').range(from, to)),
  ])
  failed('the boards', boardRead.error ?? stepRead.error)
  const boardRows = boardRead.data, stepRows = stepRead.data
  const boardById = new Map(((boardRows ?? []) as { id: number; name: string; workspace_name: string | null }[])
    .map(b => [b.id, b]))
  const stepBy = new Map(((stepRows ?? []) as { board_id: number; people_col: string; step_name: string }[])
    .map(st => [`${st.board_id}:${st.people_col}`, st.step_name]))

  const count = <K,>(pick: (r: A) => K) => {
    const m = new Map<K, number>()
    for (const r of rows) { const k = pick(r); m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  base.boards = count(r => r.board_id).map(([bid, n]) => {
    const b = boardById.get(bid as number)
    return { name: b?.name ?? `board ${bid}`, workspace: b?.workspace_name ?? null, count: n }
  })
  base.steps = count(r => stepBy.get(`${r.board_id}:${r.people_col}`) ?? r.people_col)
    .map(([name, n]) => ({ name: name as string, count: n }))

  const dues = rows.map(r => r.due_date).filter(Boolean).sort() as string[]
  base.firstDue = dues[0] ?? null
  base.lastDue = dues[dues.length - 1] ?? null
  const touched = rows.map(r => r.item_updated_at).filter(Boolean).sort() as string[]
  // The New York day, like every date the portal shows.
  const last = touched[touched.length - 1]
  base.lastTouched = last ? zoneDate(new Date(last), 'America/New_York') : null

  // The strongest signal: 400 items is plenty to see a pattern and keeps this
  // to one query rather than one per item.
  const itemIds = [...new Set(rows.map(r => r.item_id))].slice(0, 400)
  const mateCount = new Map<number, number>()
  // Paged: 400 items carry more than the 1,000 rows one read returns.
  for (let i = 0; i < itemIds.length; i += 100) {
    const mates = await selectAllPages<{ monday_user_id: number }>((from, to) => supabase
      .from('monday_assignments').select('monday_user_id').in('item_id', itemIds.slice(i, i + 100))
      .neq('monday_user_id', id).order('id').range(from, to))
    failed('who works alongside them', mates.error)
    for (const m of mates.data) mateCount.set(m.monday_user_id, (mateCount.get(m.monday_user_id) ?? 0) + 1)
  }
  if (mateCount.size) {
    const { data: names, error: namesErr } = await supabase.from('monday_users').select('id, name').in('id', [...mateCount.keys()])
    failed('the account names', namesErr)
    const nameById = new Map(((names ?? []) as { id: number; name: string }[]).map(n => [n.id, n.name]))
    base.alongside = [...mateCount.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([uid, n]) => ({ name: nameById.get(uid) ?? `id ${uid}`, count: n }))
  }

  base.sample = rows.slice(0, 12).map(r => ({ item: r.item_name, parent: r.parent_item_name, due: r.due_date }))
  return base
}
