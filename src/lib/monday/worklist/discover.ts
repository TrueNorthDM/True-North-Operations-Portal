// Discovery: who works in Monday, which boards exist, and what their steps are.
//
// Runs before any assignment is read, and is cheap enough to re-run whenever a
// board changes shape. It never touches items.
//
// The one rule that matters here: a person's confirmation outranks the guess.
// Re-running discovery refreshes titles and adds columns that appeared, and
// leaves every row somebody has reviewed exactly as they left it. A seeding
// pass that quietly reverts corrections teaches people not to correct anything.

import type { SupabaseClient } from '@supabase/supabase-js'
import { seedSteps, pickDateColumn, PEOPLE_TYPES, type BoardColumn } from './steps'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const API = 'https://api.monday.com/v2'

export async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '))
  if (!json.data) throw new Error(`Monday: empty response (status ${res.status})`)
  return json.data
}

// ── People ──────────────────────────────────────────────────────────────────

export interface UserSyncResult {
  users: number
  /** Recovered by id because the listing did not include them. */
  recovered: number
  /** Ids on work that Monday will not resolve at all: deleted accounts. */
  ghosts: number
  linkedByEmail: number
  unlinked: { id: number; name: string; email: string | null }[]
}

/**
 * Monday accounts, and which directory person each one is.
 *
 * Guests are stored, not skipped. The survey counted 14 members against 17
 * active people and found nobody unmatched, but "we did not see any" is not
 * the same as "there are none": an assignee nobody has a row for would drop
 * out of a team filter with nothing said, which is exactly how the fifteen
 * duplicated people went unnoticed on the TSheets side. Anyone who cannot be
 * linked comes back in `unlinked` so it is a visible pending item.
 */
export async function syncMondayUsers(supabase: Client, token: string): Promise<UserSyncResult> {
  type U = { id: string; name: string; email: string | null; enabled: boolean; is_guest: boolean }
  const FIELDS = 'id name email enabled is_guest'

  const d = await gql<{ users: U[] }>(token, `query { users(limit: 500) { ${FIELDS} } }`)
  const users: U[] = d.users ?? []

  // The listing does not return everybody. People who have left are still
  // named on years of items, so their ids turn up in assignments with no row
  // to explain them: that is why the page counted 35 unknown accounts when
  // this had reported 18.
  //
  // Asking for them by id rather than trying to widen the listing, because the
  // filter that would widen it differs between API versions (`state` is not a
  // valid argument on this one) while `ids` is stable. It also asks a precise
  // question: these exact accounts are on real work, who are they.
  const seen = new Set(users.map(u => Number(u.id)))
  const missing = new Set<number>()
  for (let from = 0; ; from += 2000) {
    const { data, error } = await supabase
      .from('monday_assignments').select('monday_user_id')
      .order('id', { ascending: true }).range(from, from + 1999)
    if (error) break                       // no assignments yet on a first run
    const rows = (data ?? []) as { monday_user_id: number }[]
    for (const r of rows) if (!seen.has(r.monday_user_id)) missing.add(r.monday_user_id)
    if (rows.length < 2000) break
  }
  const ids = [...missing]
  let recovered = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map(String)
    const extra = await gql<{ users: U[] }>(
      token, `query ($ids: [ID!]) { users(ids: $ids, limit: 100) { ${FIELDS} } }`, { ids: chunk })
    const got = extra.users ?? []
    recovered += got.length
    users.push(...got)
  }

  // Some ids Monday will not resolve at all: the account was deleted from the
  // account outright, while the id stays written on every item that person
  // ever touched. Without a row they are permanently "unknown", which is a
  // warning that can never be cleared and therefore stops being read.
  //
  // So they get a placeholder. It says exactly what is known (an id, on real
  // work, with nobody behind it) and it can be marked as outside True North
  // like any other account, which is usually the truth.
  const resolved = new Set(users.map(u => Number(u.id)))
  const ghosts = ids.filter(id => !resolved.has(id))
  for (const id of ghosts) {
    users.push({ id: String(id), name: `Removed account ${id}`, email: null, enabled: false, is_guest: false })
  }

  const rows = users.map(u => ({
    id: Number(u.id),
    name: u.name,
    email: u.email,
    enabled: u.enabled,
    is_guest: u.is_guest,
    synced_at: new Date().toISOString(),
  }))
  if (rows.length) {
    const { error } = await supabase.from('monday_users').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`monday_users upsert: ${error.message}`)
  }

  const [{ data: peopleRows }, { data: linkRows }, { data: externalRows }] = await Promise.all([
    supabase.from('people').select('id, full_name, email_true_north, email_goodnews, email_coe, email_personal'),
    supabase.from('monday_user_links').select('monday_user_id'),
    // Marked as somebody outside True North. That is a finished answer, and
    // reporting it as pending is what makes a pending list stop being read:
    // the migration that added this column existed to prevent exactly that,
    // and this function was still counting the old way.
    supabase.from('monday_users').select('id').eq('is_external', true),
  ])
  type P = {
    id: string; full_name: string
    email_true_north: string | null; email_goodnews: string | null
    email_coe: string | null; email_personal: string | null
  }
  const already = new Set(((linkRows ?? []) as { monday_user_id: number }[]).map(l => l.monday_user_id))
  const external = new Set(((externalRows ?? []) as { id: number }[]).map(u => u.id))
  const norm = (s: string) => s.trim().toLowerCase()
  const byEmail = new Map<string, P>()
  for (const p of (peopleRows ?? []) as P[]) {
    for (const e of [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]) {
      if (e) byEmail.set(norm(e), p)
    }
  }

  // Email only. Name matching is what the portal is moving away from, and
  // linking a person to the wrong Monday account is worse than not linking
  // them: the work would show up on somebody else's list.
  const newLinks: { monday_user_id: number; person_id: string; linked_by: string }[] = []
  const unlinked: UserSyncResult['unlinked'] = []
  for (const u of users) {
    const id = Number(u.id)
    if (already.has(id) || external.has(id)) continue
    const hit = u.email ? byEmail.get(norm(u.email)) : undefined
    if (hit) newLinks.push({ monday_user_id: id, person_id: hit.id, linked_by: 'email' })
    else unlinked.push({ id, name: u.name, email: u.email })
  }
  if (newLinks.length) {
    const { error } = await supabase.from('monday_user_links').upsert(newLinks, { onConflict: 'monday_user_id' })
    if (error) throw new Error(`monday_user_links upsert: ${error.message}`)
  }

  return { users: users.length, recovered, ghosts: ghosts.length, linkedByEmail: newLinks.length, unlinked }
}

// ── Boards and their steps ──────────────────────────────────────────────────

export interface BoardSyncResult {
  boards: number
  withPeople: number
  stepsSeeded: number
  stepsKept: number
}

interface RawBoard {
  id: string
  name: string
  state: string
  board_kind: string
  items_count: number | null
  workspace: { id: string; name: string } | null
  columns: BoardColumn[]
}

async function allBoards(token: string): Promise<RawBoard[]> {
  const out: RawBoard[] = []
  for (let page = 1; page <= 40; page++) {
    const d = await gql<{ boards: RawBoard[] }>(token, `
      query ($page: Int!) {
        boards(limit: 50, page: $page, order_by: created_at) {
          id name state board_kind items_count
          workspace { id name }
          columns { id title type }
        }
      }`, { page })
    const got = d.boards ?? []
    out.push(...got)
    if (got.length < 50) break
  }
  return out.filter(b => b.state === 'active')
}

export async function syncMondayBoards(supabase: Client, token: string): Promise<BoardSyncResult> {
  // The account's subdomain, which item links are built from. Read here rather
  // than written into the source: hardcoding it means the day it changes every
  // link breaks quietly and nobody connects the two events.
  const acct = await gql<{ account: { slug: string } }>(token, `query { account { slug } }`)
  if (acct.account?.slug) {
    await supabase.from('app_settings')
      .update({ monday_account_slug: acct.account.slug }).eq('singleton_id', 1)
  }

  const boards = await allBoards(token)
  const now = new Date().toISOString()

  const boardRows = boards.map(b => ({
    id: Number(b.id),
    name: b.name,
    workspace_id: b.workspace ? Number(b.workspace.id) : null,
    workspace_name: b.workspace?.name ?? null,
    kind: b.board_kind,
    // Monday models a board's subitems as a board of their own, which is why
    // the account reports far more boards than a person would name.
    is_subitem_board: /^Subitems of /i.test(b.name),
    items_count: b.items_count,
    ...(() => {
      const c = pickDateColumn(b.columns ?? [])
      return { date_col: c?.id ?? null, date_title: c?.title ?? null }
    })(),
    synced_at: now,
  }))
  // Read before the upsert overwrites it: the comparison is against what the
  // board was reading a moment ago.
  const { data: before } = await supabase.from('monday_boards').select('id, date_col')
  const wasUsing = new Map(((before ?? []) as { id: number; date_col: string | null }[])
    .map(b => [b.id, b.date_col]))

  for (let i = 0; i < boardRows.length; i += 200) {
    const { error } = await supabase.from('monday_boards').upsert(boardRows.slice(i, i + 200), { onConflict: 'id' })
    if (error) throw new Error(`monday_boards upsert: ${error.message}`)
  }

  // Dates that came from a column this board no longer reads.
  //
  // The first version of this only cleared boards that lost their date column
  // outright, and missed the case that actually mattered: a board that SWAPPED
  // one column for another kept showing the old column's values, so BM -
  // General Audits switched from "Published On" to "Audit By" and went on
  // reporting year 202 as though nothing had changed. Any change of source
  // invalidates what the old source produced, not just its removal.
  const changed = boardRows
    .filter(b => wasUsing.has(b.id) && wasUsing.get(b.id) !== b.date_col)
    .map(b => b.id)
  for (let i = 0; i < changed.length; i += 200) {
    await supabase.from('monday_assignments')
      .update({ due_date: null }).in('board_id', changed.slice(i, i + 200)).not('due_date', 'is', null)
  }

  const withPeople = boards.filter(b => (b.columns ?? []).some(c => PEOPLE_TYPES.has(c.type)))

  // What a person already decided, which the seeding must not undo.
  const { data: existing } = await supabase
    .from('monday_board_steps').select('board_id, people_col, source')
  const reviewed = new Set(
    ((existing ?? []) as { board_id: number; people_col: string; source: string }[])
      .filter(r => r.source !== 'guess')
      .map(r => `${r.board_id}:${r.people_col}`))

  const seeded: Record<string, unknown>[] = []
  for (const b of withPeople) {
    for (const st of seedSteps(b.columns ?? [])) {
      if (reviewed.has(`${b.id}:${st.peopleCol}`)) continue
      seeded.push({
        board_id: Number(b.id),
        people_col: st.peopleCol,
        people_title: st.peopleTitle,
        status_col: st.statusCol,
        step_name: st.stepName,
        position: st.position,
        source: 'guess',
        updated_at: now,
      })
    }
  }
  for (let i = 0; i < seeded.length; i += 200) {
    const { error } = await supabase
      .from('monday_board_steps').upsert(seeded.slice(i, i + 200), { onConflict: 'board_id,people_col' })
    if (error) throw new Error(`monday_board_steps upsert: ${error.message}`)
  }

  return {
    boards: boards.length,
    withPeople: withPeople.length,
    stepsSeeded: seeded.length,
    stepsKept: reviewed.size,
  }
}
