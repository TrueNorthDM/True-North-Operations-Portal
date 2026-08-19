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
import { seedSteps, PEOPLE_TYPES, type BoardColumn } from './steps'

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
  // state: all, deliberately. The default returns active accounts only, and
  // people who left are still named on years of items: their ids turn up in
  // assignments with no row to explain them, which is how a page ends up
  // reporting 35 unknown accounts when discovery had only flagged 18.
  const d = await gql<{ users: { id: string; name: string; email: string | null; enabled: boolean; is_guest: boolean }[] }>(
    token, `query { users(limit: 500, state: all) { id name email enabled is_guest } }`)
  const users = d.users ?? []

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

  const [{ data: peopleRows }, { data: linkRows }] = await Promise.all([
    supabase.from('people').select('id, full_name, email_true_north, email_goodnews, email_coe, email_personal'),
    supabase.from('monday_user_links').select('monday_user_id'),
  ])
  type P = {
    id: string; full_name: string
    email_true_north: string | null; email_goodnews: string | null
    email_coe: string | null; email_personal: string | null
  }
  const already = new Set(((linkRows ?? []) as { monday_user_id: number }[]).map(l => l.monday_user_id))
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
    if (already.has(id)) continue
    const hit = u.email ? byEmail.get(norm(u.email)) : undefined
    if (hit) newLinks.push({ monday_user_id: id, person_id: hit.id, linked_by: 'email' })
    else unlinked.push({ id, name: u.name, email: u.email })
  }
  if (newLinks.length) {
    const { error } = await supabase.from('monday_user_links').upsert(newLinks, { onConflict: 'monday_user_id' })
    if (error) throw new Error(`monday_user_links upsert: ${error.message}`)
  }

  return { users: users.length, linkedByEmail: newLinks.length, unlinked }
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
    synced_at: now,
  }))
  for (let i = 0; i < boardRows.length; i += 200) {
    const { error } = await supabase.from('monday_boards').upsert(boardRows.slice(i, i + 200), { onConflict: 'id' })
    if (error) throw new Error(`monday_boards upsert: ${error.message}`)
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
