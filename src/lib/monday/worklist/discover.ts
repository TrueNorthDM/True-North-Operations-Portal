// Discovery: who works in Monday, which boards exist, and what their steps are.
//
// Runs before any assignment is read, and is cheap enough to re-run whenever a
// board changes shape. It never touches items.
//
// The one rule that matters here: a person's confirmation outranks the guess.
// Re-running discovery refreshes titles and adds columns that appeared, and
// leaves every row somebody has reviewed exactly as they left it. A seeding
// pass that quietly reverts corrections teaches people not to correct anything.

import type { TablesInsert } from '@/lib/types/database.types'
import type { Db } from '@/lib/supabase/types'
import { seedSteps, pickDateColumn, PEOPLE_TYPES, type BoardColumn } from './steps'
import { missingColumn } from './missing-column'
import { retryDecision, goneBoards, selectAllPages, type CallFailure } from './resilience'

type Client = Db

const API = 'https://api.monday.com/v2'

/** How long one attempt may take before it counts as a network failure. */
const CALL_TIMEOUT_MS = 45_000

class MondayError extends Error {}

/**
 * One Monday GraphQL call, tried again when the failure is the passing kind:
 * no answer, a timeout, a 429 or 5xx, or Monday's complexity budget running out
 * (it says when it resets, and the wait follows it). A query Monday refuses is
 * not retried. Rules and limits in resilience.ts.
 */
export async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let failure: CallFailure
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      })
      const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null
      if (json?.data && !json.errors?.length) return json.data
      const retryAfter = Number(res.headers.get('retry-after'))
      failure = {
        status: res.status,
        messages: json?.errors?.map(e => e.message) ?? [],
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      }
    } catch (e) {
      failure = { network: true, messages: [(e as Error).message] }
    }
    const next = retryDecision(failure, attempt)
    const said = failure.messages?.length ? failure.messages.join('; ') : `empty response (status ${failure.status ?? 'none'})`
    if (!next.retry) throw new MondayError(attempt > 1 ? `${said} (after ${attempt} attempts)` : said)
    console.warn(`[monday] attempt ${attempt} failed (${said.slice(0, 160)}); trying again in ${next.waitMs} ms`)
    await new Promise(r => setTimeout(r, next.waitMs))
  }
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
  /** People-column rows written from the layout, steps and non-steps alike. */
  stepsSeeded: number
  /** Of those, how many own at least one status with a deadline: the ones My Work shows. */
  stepsWithDeadline: number
  stepsKept: number
  /** Boards discovery stopped seeing in Monday this time, and ones that came back. */
  gone: number
  back: number
  goneRefused?: string
}

interface RawBoard {
  id: string
  name: string
  state: string
  board_kind: string
  items_count: number | null
  /**
   * When Monday says the board last changed. Free in this query, and the only
   * sign of life the sync ever gets about a board it does not read: a hidden
   * board is read again when this is newer than the last read (stale.ts,
   * boardsToProbe), and the rule then judges it on its items as always.
   */
  updated_at: string | null
  workspace: { id: string; name: string } | null
  columns: BoardColumn[]
}

async function allBoards(token: string): Promise<RawBoard[]> {
  const out: RawBoard[] = []
  // Twenty-five a page rather than fifty since columns carry their settings:
  // the step rule needs each status column's done labels, and settings on
  // every column of fifty boards is a heavy query to ask for at once.
  const LIMIT = 25
  for (let page = 1; page <= 80; page++) {
    const d = await gql<{ boards: RawBoard[] }>(token, `
      query ($page: Int!, $limit: Int!) {
        boards(limit: $limit, page: $page, order_by: created_at) {
          id name state board_kind items_count updated_at
          workspace { id name }
          columns { id title type settings_str }
        }
      }`, { page, limit: LIMIT })
    const got = d.boards ?? []
    out.push(...got)
    if (got.length < LIMIT) break
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
    board_updated_at: b.updated_at,
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

  // Migration 086 adds board_updated_at. Until it is run the rest is written
  // and no hidden board is read again, which is how the sync behaved before it.
  const withoutUpdated = (row: (typeof boardRows)[number]) => {
    const copy: Record<string, unknown> = { ...row }
    delete copy.board_updated_at
    return copy
  }
  for (let i = 0; i < boardRows.length; i += 200) {
    const chunk = boardRows.slice(i, i + 200)
    let { error } = await supabase.from('monday_boards').upsert(chunk, { onConflict: 'id' })
    if (missingColumn(error, 'board_updated_at')) {
      ;({ error } = await supabase.from('monday_boards').upsert(chunk.map(withoutUpdated) as TablesInsert<'monday_boards'>[], { onConflict: 'id' }))
    }
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
  // Every row, a page at a time: past 1,000 rows a single read stops short, and a
  // reviewed step missing from this set would be re-seeded as a guess.
  const { data: existing, error: existingErr } = await selectAllPages((from, to) => supabase
    .from('monday_board_steps').select('board_id, people_col, source').order('board_id').order('people_col').range(from, to))
  if (existingErr) throw new Error(`monday_board_steps read: ${existingErr.message}`)
  const reviewed = new Set(
    ((existing ?? []) as { board_id: number; people_col: string; source: string }[])
      .filter(r => r.source !== 'guess')
      .map(r => `${r.board_id}:${r.people_col}`))

  const seeded: Record<string, unknown>[] = []
  let withDeadline = 0
  for (const b of withPeople) {
    for (const st of seedSteps(b.columns ?? [])) {
      if (reviewed.has(`${b.id}:${st.peopleCol}`)) continue
      if (st.stages.length) withDeadline++
      seeded.push({
        board_id: Number(b.id),
        people_col: st.peopleCol,
        people_title: st.peopleTitle,
        status_col: st.statusCol,
        step_name: st.stepName,
        position: st.position,
        // Written for every people column, steps or not. An empty list is an
        // answer ("owns no status with a deadline") that the page and the
        // review screen both read; leaving the row out would look the same as
        // a board nobody has read yet.
        stages: st.stages,
        source: 'guess',
        updated_at: now,
      })
    }
  }
  const withoutStages = (r: Record<string, unknown>) => {
    const copy = { ...r }
    delete copy.stages
    return copy
  }
  let writeStages = true
  for (let i = 0; i < seeded.length; i += 200) {
    const chunk = seeded.slice(i, i + 200)
    let { error } = await supabase
      .from('monday_board_steps')
      .upsert((writeStages ? chunk : chunk.map(withoutStages)) as TablesInsert<'monday_board_steps'>[], { onConflict: 'board_id,people_col' })
    // Migration 082 not run yet: keep the old pairing working rather than
    // failing the whole sync, and say so where the cron's log will show it.
    if (writeStages && error?.message?.includes('stages')) {
      writeStages = false
      console.warn('[monday-discover] monday_board_steps.stages is missing: run migration 082')
      ;({ error } = await supabase
        .from('monday_board_steps')
        .upsert(chunk.map(withoutStages) as TablesInsert<'monday_board_steps'>[], { onConflict: 'board_id,people_col' }))
    }
    if (error) throw new Error(`monday_board_steps upsert: ${error.message}`)
  }

  const gone = await markGoneBoards(supabase, new Set(boards.map(b => Number(b.id))))

  return {
    boards: boards.length,
    withPeople: withPeople.length,
    stepsSeeded: seeded.length,
    stepsWithDeadline: withDeadline,
    stepsKept: reviewed.size,
    gone: gone.gone,
    back: gone.back,
    ...(gone.refused ? { goneRefused: gone.refused } : {}),
  }
}

/**
 * Boards Monday no longer lists (archived or deleted) are marked gone and not
 * read again; one that comes back is read as usual. A gone board's rows are
 * cleared without history events: the board went, nobody's work changed hands.
 * The rule, and its refusal when the listing looks cut short, is goneBoards.
 * Before migration 091 there is no gone_at, and nothing changes.
 */
async function markGoneBoards(supabase: Client, activeIds: Set<number>): Promise<{ gone: number; back: number; refused?: string }> {
  const { data, error } = await selectAllPages<{ id: number; gone_at: string | null }>((from, to) => supabase
    .from('monday_boards').select('id, gone_at').order('id').range(from, to))
  if (missingColumn(error, 'gone_at')) return { gone: 0, back: 0 }
  if (error) throw new Error(`monday_boards read: ${error.message}`)

  const r = goneBoards(data.map(b => ({ id: Number(b.id), goneAt: b.gone_at })), activeIds)
  if (r.refused) console.warn(`[monday-discover] ${r.refused}`)
  const now = new Date().toISOString()
  for (let i = 0; i < r.gone.length; i += 200) {
    const ids = r.gone.slice(i, i + 200)
    const { error: markErr } = await supabase.from('monday_boards').update({ gone_at: now }).in('id', ids)
    if (markErr) throw new Error(`mark gone boards: ${markErr.message}`)
    const { error: clearErr } = await supabase.from('monday_assignments').delete().in('board_id', ids)
    if (clearErr) throw new Error(`clear gone boards: ${clearErr.message}`)
  }
  for (let i = 0; i < r.back.length; i += 200) {
    await supabase.from('monday_boards').update({ gone_at: null }).in('id', r.back.slice(i, i + 200))
  }
  if (r.gone.length || r.back.length) console.log(`[monday-discover] boards gone: ${r.gone.length}, back: ${r.back.length}`)
  return { gone: r.gone.length, back: r.back.length, refused: r.refused }
}
