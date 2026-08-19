/**
 * GET /api/admin/monday-inventory, a read-only survey of the Monday account.
 *
 * Same reasoning as the TSheets one next door: the token lives in app_settings
 * and should stay there, so the survey runs server-side inside the trust
 * boundary that already holds it rather than on somebody's laptop. Every call
 * is a query. It writes nothing.
 *
 * This exists because "pull everything from all workspaces" is a sentence, not
 * a design. Four boards are configured by hand today, each with its stages and
 * owner columns written out by a person. Whether that approach scales, or has
 * to be replaced by discovery, depends on numbers nobody has looked at: how
 * many boards there are, how many carry people columns, how many items sit
 * behind them, and whether Monday will hand back one item's history on demand.
 *
 * Parts:
 *   ?part=overview (default)  workspaces, board counts, the totals that decide the shape
 *   ?part=boards              every board: workspace, items, and its people/status columns
 *   ?part=board&id=X          one board in full: every column, and a sample item's values
 *   ?part=history&id=X        can activity_logs be asked for a single item? (capability probe)
 *   ?part=people              the Monday user list, to match against the portal directory
 */

import { isSecurityAdmin } from '@/lib/auth/role'
import { getMondayToken } from '@/lib/monday/snapshot'
import { createAdminClient } from '@/lib/supabase/admin'
import { BOARDS } from '@/lib/boards/config'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const API = 'https://api.monday.com/v2'

async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '))
  if (!json.data) throw new Error(`empty response (status ${res.status})`)
  return json.data
}

type Col = { id: string; title: string; type: string }
type Board = {
  id: string; name: string; state: string; board_kind: string
  items_count: number | null
  workspace: { id: string; name: string } | null
  columns: Col[]
}

/** Every board, paged. Monday caps page size, so this walks until a short page. */
async function allBoards(token: string, withColumns: boolean): Promise<Board[]> {
  const out: Board[] = []
  const cols = withColumns ? 'columns { id title type }' : ''
  for (let page = 1; ; page++) {
    const d = await gql<{ boards: Board[] }>(token, `
      query ($page: Int!) {
        boards(limit: 50, page: $page, order_by: created_at) {
          id name state board_kind items_count
          workspace { id name }
          ${cols}
        }
      }`, { page })
    const got = d.boards ?? []
    out.push(...got.map(b => ({ ...b, columns: b.columns ?? [] })))
    if (got.length < 50) break
    if (page > 40) break            // 2000 boards is not a thing; stop rather than loop
  }
  return out
}

const PEOPLE_TYPES = new Set(['people', 'person', 'multiple-person'])
const STATE_TYPES = new Set(['status', 'color', 'dropdown'])

export async function GET(request: Request) {
  if (!(await isSecurityAdmin())) return new Response('Admins only.', { status: 403 })

  const token = await getMondayToken()
  if (!token) return new Response('No Monday token configured in Settings.', { status: 400 })

  const url = new URL(request.url)
  const part = url.searchParams.get('part') ?? 'overview'
  const boardId = url.searchParams.get('id')

  const lines: string[] = []
  const say = (s = '') => lines.push(s)
  const done_ = () => new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })

  try {
    if (part === 'overview') {
      const me = await gql<{ me: { name: string; email: string }; account: { name: string; slug: string } }>(
        token, `query { me { name email } account { name slug } }`)
      say(`ACCOUNT  ${me.account.name} (${me.account.slug})`)
      say(`TOKEN OF ${me.me.name} <${me.me.email}>`)
      say()

      const ws = await gql<{ workspaces: { id: string; name: string; kind: string }[] }>(
        token, `query { workspaces(limit: 100) { id name kind } }`)
      say(`WORKSPACES  ${ws.workspaces?.length ?? 0}`)
      for (const w of ws.workspaces ?? []) say(`  ${String(w.id).padEnd(12)} ${w.name}  (${w.kind})`)
      say()

      const boards = await allBoards(token, true)
      const live = boards.filter(b => b.state === 'active')
      const withPeople = live.filter(b => b.columns.some(c => PEOPLE_TYPES.has(c.type)))
      const items = live.reduce((s, b) => s + (b.items_count ?? 0), 0)
      const peopleCols = withPeople.reduce((s, b) => s + b.columns.filter(c => PEOPLE_TYPES.has(c.type)).length, 0)

      say(`BOARDS         ${boards.length} total, ${live.length} active`)
      say(`  with people  ${withPeople.length} boards carry at least one people column`)
      say(`  people cols  ${peopleCols} across those boards`)
      say(`  items        ${items} on active boards`)
      say()
      say(`ROWS THIS WOULD PRODUCE, worst case: one per item per people column.`)
      say(`Assuming every people column on a board is filled on every item, that is`)
      say(`the number to design the storage and the page size against.`)
      say()
      const byWs = new Map<string, { boards: number; items: number; people: number }>()
      for (const b of live) {
        const k = b.workspace?.name ?? '(no workspace)'
        const cur = byWs.get(k) ?? { boards: 0, items: 0, people: 0 }
        cur.boards++
        cur.items += b.items_count ?? 0
        cur.people += b.columns.filter(c => PEOPLE_TYPES.has(c.type)).length
        byWs.set(k, cur)
      }
      say('BY WORKSPACE'.padEnd(34) + 'boards   items   people cols')
      for (const [name, v] of [...byWs].sort((a, b) => b[1].items - a[1].items)) {
        say(`  ${name.slice(0, 30).padEnd(32)}${String(v.boards).padStart(5)}${String(v.items).padStart(8)}${String(v.people).padStart(13)}`)
      }
      return done_()
    }

    if (part === 'boards') {
      const boards = (await allBoards(token, true))
        .filter(b => b.state === 'active')
        .sort((a, b) => (b.items_count ?? 0) - (a.items_count ?? 0))
      say(`${boards.length} active boards. p = people columns, s = status-like columns.`)
      say()
      // IN BOARD ORDER, not grouped by type. The first version of this grouped
      // people columns then status columns, which reads more tidily and throws
      // away the only strong signal there is: a board is laid out left to right
      // and whoever built the workflow put a step's status beside that step's
      // owner. Sorting output for legibility lost the structure of the data.
      for (const b of boards) {
        const ppl = b.columns.filter(c => PEOPLE_TYPES.has(c.type))
        const st = b.columns.filter(c => STATE_TYPES.has(c.type))
        say(`── ${b.name}`)
        say(`   id ${b.id}  ws ${b.workspace?.name ?? '-'}  kind ${b.board_kind}  items ${b.items_count ?? '?'}  p${ppl.length} s${st.length}`)
        for (const c of b.columns) {
          const mark = PEOPLE_TYPES.has(c.type) ? 'p' : STATE_TYPES.has(c.type) ? 's' : ' '
          say(`   ${mark}  ${c.id.padEnd(28)} ${c.type.padEnd(18)} ${c.title}`)
        }
        say()
      }
      return done_()
    }

    if (part === 'board') {
      if (!boardId) return new Response('Pass ?id=<board id>', { status: 400 })
      const d = await gql<{ boards: (Board & { groups: { id: string; title: string }[]; items_page: { items: { id: string; name: string; group: { title: string }; column_values: { id: string; text: string | null; type: string }[] }[] } })[] }>(
        token, `
        query ($id: [ID!]) {
          boards(ids: $id) {
            id name state board_kind items_count
            workspace { id name }
            groups { id title }
            columns { id title type }
            items_page(limit: 3) {
              items { id name group { title } column_values { id text type } }
            }
          }
        }`, { id: [boardId] })
      const b = d.boards?.[0]
      if (!b) return new Response('No such board.', { status: 404 })
      say(`BOARD ${b.name}  (${b.id})  ws ${b.workspace?.name ?? '-'}  items ${b.items_count ?? '?'}`)
      say()
      say('GROUPS'); for (const g of b.groups ?? []) say(`  ${g.title}`)
      say()
      say('COLUMNS'.padEnd(34) + 'type')
      for (const c of b.columns) say(`  ${c.id.padEnd(30)} ${c.type.padEnd(20)} ${c.title}`)
      say()
      say('SAMPLE ITEMS')
      for (const it of b.items_page?.items ?? []) {
        say(`  · ${it.name}   [${it.group?.title ?? '-'}]`)
        for (const cv of it.column_values ?? []) {
          if (!cv.text) continue
          say(`      ${cv.id.padEnd(28)} ${cv.type.padEnd(18)} ${cv.text.slice(0, 60)}`)
        }
        say()
      }
      return done_()
    }

    if (part === 'history') {
      if (!boardId) return new Response('Pass ?id=<board id>', { status: 400 })
      // The question: can one item's history be fetched on its own? If yes, the
      // task list does not have to store history for every board, it can fetch
      // it when somebody opens an item. If no, history has to be ingested.
      const first = await gql<{ boards: { items_page: { items: { id: string; name: string }[] } }[] }>(
        token, `query ($id: [ID!]) { boards(ids: $id) { items_page(limit: 1) { items { id name } } } }`,
        { id: [boardId] })
      const item = first.boards?.[0]?.items_page?.items?.[0]
      if (!item) return new Response('That board has no items.', { status: 404 })
      say(`Probing with item ${item.id} "${item.name}"`)
      say()
      try {
        const d = await gql<{ boards: { activity_logs: { id: string; event: string; data: string; created_at: string }[] }[] }>(
          token, `
          query ($id: [ID!], $item: [ID!]) {
            boards(ids: $id) {
              activity_logs(item_ids: $item, limit: 25) { id event data created_at }
            }
          }`, { id: [boardId], item: [item.id] })
        const logs = d.boards?.[0]?.activity_logs ?? []
        say(`YES: activity_logs accepts item_ids. ${logs.length} events came back.`)
        say('History can be fetched on demand, per item, instead of being stored.')
        say()
        for (const l of logs.slice(0, 12)) say(`  ${l.created_at}  ${l.event}\n      ${String(l.data).slice(0, 200)}`)
      } catch (e) {
        say(`NO: ${(e as Error).message}`)
        say('History would have to come from the board-wide activity log, which is')
        say('what the nightly ingest already stores for the four configured boards.')
      }
      return done_()
    }

    if (part === 'people') {
      const d = await gql<{ users: { id: string; name: string; email: string; enabled: boolean; is_guest: boolean }[] }>(
        token, `query { users(limit: 500) { id name email enabled is_guest } }`)
      const us = d.users ?? []
      say(`${us.length} Monday users (${us.filter(u => u.enabled).length} enabled, ${us.filter(u => u.is_guest).length} guests)`)
      say()
      say('id'.padEnd(12) + 'name'.padEnd(28) + 'email')
      for (const u of us.sort((a, b) => a.name.localeCompare(b.name))) {
        say(`${String(u.id).padEnd(12)}${u.name.slice(0, 26).padEnd(28)}${u.email}${u.enabled ? '' : '   (disabled)'}`)
      }
      return done_()
    }

    if (part === 'account') {
      // "Who was this" for an account with no name left. Monday cannot answer:
      // the account is gone and the id is all that survives. But the work it
      // is attached to is still here, and the shape of that work identifies a
      // person better than a name would: which boards, which steps, over which
      // years, beside whom.
      const id = Number(url.searchParams.get('id') ?? '')
      if (!Number.isFinite(id)) return new Response('Pass ?id=<monday user id>', { status: 400 })

      const supabase = createAdminClient()
      const [{ data: user }, { data: link }] = await Promise.all([
        supabase.from('monday_users').select('id, name, email, enabled, is_guest, is_external').eq('id', id).maybeSingle(),
        supabase.from('monday_user_links').select('person_id, linked_by').eq('monday_user_id', id).maybeSingle(),
      ])

      type A = {
        board_id: number; item_id: number; item_name: string; parent_item_name: string | null
        people_col: string; due_date: string | null; status_text: string | null; item_updated_at: string | null
      }
      const rows: A[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from('monday_assignments')
          .select('board_id, item_id, item_name, parent_item_name, people_col, due_date, status_text, item_updated_at')
          .eq('monday_user_id', id)
          .order('id', { ascending: true }).range(from, from + 999)
        const page = (data ?? []) as A[]
        rows.push(...page)
        if (page.length < 1000) break
      }

      const u = user as { id: number; name: string; email: string | null; enabled: boolean; is_guest: boolean; is_external: boolean } | null
      say(`ACCOUNT ${id}`)
      say(u ? `  name    ${u.name}${u.email ? `  <${u.email}>` : ''}` : '  no account record: the ingest found this id on work, discovery has not seen it')
      if (u) say(`  state   ${u.enabled ? 'enabled' : 'disabled'}${u.is_guest ? ', guest' : ''}${u.is_external ? ', marked outside True North' : ''}`)
      say(link ? `  linked  to a directory person (${(link as { linked_by: string }).linked_by})` : '  linked  to nobody')
      say(`  work    ${rows.length} assignments`)
      say()

      if (!rows.length) { say('No work under this account.'); return done_() }

      const { data: boardRows } = await supabase.from('monday_boards').select('id, name, workspace_name')
      const boards = new Map(((boardRows ?? []) as { id: number; name: string; workspace_name: string | null }[])
        .map(b => [b.id, b]))
      const { data: stepRows } = await supabase.from('monday_board_steps').select('board_id, people_col, step_name')
      const steps = new Map(((stepRows ?? []) as { board_id: number; people_col: string; step_name: string }[])
        .map(st => [`${st.board_id}:${st.people_col}`, st.step_name]))

      const tally = <K,>(get: (r: A) => K | null) => {
        const m = new Map<K, number>()
        for (const r of rows) { const k = get(r); if (k != null) m.set(k, (m.get(k) ?? 0) + 1) }
        return [...m.entries()].sort((a, b) => b[1] - a[1])
      }

      say('BOARDS')
      for (const [bid, n] of tally(r => r.board_id)) {
        const b = boards.get(bid as number)
        say(`  ${String(n).padStart(5)}  ${b?.name ?? bid}  ·  ${b?.workspace_name ?? '-'}`)
      }
      say()
      say('STEPS')
      for (const [k, n] of tally(r => steps.get(`${r.board_id}:${r.people_col}`) ?? r.people_col)) {
        say(`  ${String(n).padStart(5)}  ${k}`)
      }
      say()

      const dates = rows.map(r => r.due_date).filter(Boolean).sort() as string[]
      const touched = rows.map(r => r.item_updated_at).filter(Boolean).sort() as string[]
      if (dates.length) say(`DEADLINES  ${dates[0]} → ${dates[dates.length - 1]}`)
      if (touched.length) say(`LAST TOUCHED IN MONDAY  ${touched[touched.length - 1].slice(0, 10)}`)
      say()

      // Who else is on the same items. A person is recognisable by the company
      // they keep on a board, and this is often what settles it.
      const itemIds = [...new Set(rows.map(r => r.item_id))].slice(0, 400)
      const { data: mates } = await supabase
        .from('monday_assignments').select('monday_user_id').in('item_id', itemIds).neq('monday_user_id', id)
      const mateCount = new Map<number, number>()
      for (const m of (mates ?? []) as { monday_user_id: number }[]) {
        mateCount.set(m.monday_user_id, (mateCount.get(m.monday_user_id) ?? 0) + 1)
      }
      if (mateCount.size) {
        const ids = [...mateCount.keys()]
        const { data: names } = await supabase.from('monday_users').select('id, name').in('id', ids)
        const nameById = new Map(((names ?? []) as { id: number; name: string }[]).map(n => [n.id, n.name]))
        say('WORKED ALONGSIDE')
        for (const [uid, n] of [...mateCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
          say(`  ${String(n).padStart(5)}  ${nameById.get(uid) ?? `id ${uid}`}`)
        }
        say()
      }

      say('SAMPLE ITEMS')
      for (const r of rows.slice(0, 20)) {
        say(`  ${(r.parent_item_name ? `${r.parent_item_name} → ` : '')}${r.item_name}${r.due_date ? `   due ${r.due_date}` : ''}`)
      }
      return done_()
    }

    if (part === 'status') {
      // Reads our tables, not Monday. What landed, and what is still missing.
      const supabase = createAdminClient()
      const [{ data: boards }, { count: assignments }, { count: users }, { count: linked }] = await Promise.all([
        supabase.from('monday_boards').select('id, name, workspace_name, items_count, items_synced_at, included'),
        supabase.from('monday_assignments').select('id', { count: 'exact', head: true }),
        supabase.from('monday_users').select('id', { count: 'exact', head: true }),
        supabase.from('monday_user_links').select('monday_user_id', { count: 'exact', head: true }),
      ])
      type B = { id: number; name: string; workspace_name: string | null; items_count: number | null; items_synced_at: string | null; included: boolean }
      const bs = (boards ?? []) as B[]
      const { data: stepRows } = await supabase.from('monday_board_steps').select('board_id, source')
      const steps = (stepRows ?? []) as { board_id: number; source: string }[]
      const withSteps = new Set(steps.filter(s2 => s2.source !== 'off').map(s2 => s2.board_id))
      const queue = bs.filter(b => b.included && withSteps.has(b.id))
      const done = queue.filter(b => b.items_synced_at)

      say(`ASSIGNMENTS  ${assignments ?? 0}`)
      say(`USERS        ${users ?? 0} accounts, ${linked ?? 0} linked to a person`)
      say(`STEPS        ${steps.length} (${steps.filter(s2 => s2.source === 'confirmed').length} confirmed, ${steps.filter(s2 => s2.source === 'off').length} switched off)`)
      say(`BOARDS       ${done.length}/${queue.length} read` + (done.length < queue.length ? '  ← run the ingest again' : '  ← complete'))
      say()
      if (done.length < queue.length) {
        say('STILL TO READ')
        for (const b of queue.filter(b => !b.items_synced_at).sort((a2, b2) => (b2.items_count ?? 0) - (a2.items_count ?? 0)).slice(0, 20)) {
          say(`  ${String(b.items_count ?? 0).padStart(6)} items   ${b.name}`)
        }
        say()
      }
      const oldest = done.map(b => b.items_synced_at!).sort()[0]
      if (oldest) say(`Oldest board read at ${oldest}`)
      return done_()
    }

    if (part === 'guess') {
      // The four configured boards are an answer key: a person sat down and
      // wrote which status column each people column belongs to. Running the
      // heuristic against them turns "this probably works" into a number.
      const ids = Object.keys(BOARDS)
      const d = await gql<{ boards: (Board & { columns: Col[] })[] }>(token, `
        query ($ids: [ID!]) {
          boards(ids: $ids) { id name columns { id title type } }
        }`, { ids })

      // Truth: ownerCol → the stage column it belongs to, from config.ts.
      const truth = new Map<string, Map<string, string>>()
      for (const [bid, cfg] of Object.entries(BOARDS)) {
        const m = new Map<string, string>()
        for (const st of cfg.stages ?? []) if (st.ownerCol) m.set(st.ownerCol, st.col)
        for (const st of cfg.subitemPipeline?.stages ?? []) if (st.ownerCol) m.set(st.ownerCol, st.col)
        truth.set(bid, m)
      }

      const nearest = (cols: Col[], at: number, dir: -1 | 1): Col | null => {
        for (let i = at + dir; i >= 0 && i < cols.length; i += dir) {
          if (STATE_TYPES.has(cols[i].type)) return cols[i]
          if (PEOPLE_TYPES.has(cols[i].type)) return null   // another step's owner: stop
        }
        return null
      }

      let leftHits = 0, rightHits = 0, total = 0
      for (const b of d.boards ?? []) {
        const want = truth.get(String(b.id))
        // Subitem pipelines live on a different board id than the parent, so a
        // parent's map may name columns this board does not have. Only score
        // what is actually here.
        const cols = b.columns ?? []
        say(`── ${b.name} (${b.id})`)
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i]
          if (!PEOPLE_TYPES.has(c.type)) continue
          const expect = want?.get(c.id)
          const l = nearest(cols, i, -1)
          const r = nearest(cols, i, 1)
          if (!expect) {
            say(`   ?  ${c.title.padEnd(24)} not in the answer key   left=${l?.title ?? '-'}  right=${r?.title ?? '-'}`)
            continue
          }
          total++
          const okL = l?.id === expect
          const okR = r?.id === expect
          if (okL) leftHits++
          if (okR) rightHits++
          const mark = okL && okR ? 'both' : okL ? 'LEFT' : okR ? 'RIGHT' : 'MISS'
          say(`   ${mark.padEnd(6)} ${c.title.padEnd(24)} should be "${cols.find(x => x.id === expect)?.title ?? expect}"`)
          if (!okL && !okR) say(`          got left="${l?.title ?? '-'}"  right="${r?.title ?? '-'}"`)
        }
        say()
      }
      say(`SCORED ${total} owner columns that the answer key covers.`)
      say(`  nearest status to the LEFT   ${leftHits}/${total}`)
      say(`  nearest status to the RIGHT  ${rightHits}/${total}`)
      say()
      say('Whichever wins is the default the confirmation screen starts from.')
      say('A heuristic that needs correcting on a third of boards is still worth')
      say('having; one that needs correcting everywhere is just a worse blank form.')
      return done_()
    }

    if (part === 'match') {
      // Nothing is written here. The question is how much of the directory can
      // be joined to Monday without a person deciding, because everything the
      // task list does per team depends on that join existing. Today the board
      // code matches on the display name inside a people column, which is the
      // same shape of mistake that produced fifteen duplicated people on the
      // TSheets side: a name is what somebody typed, an id is who they are.
      const d = await gql<{ users: { id: string; name: string; email: string; enabled: boolean; is_guest: boolean }[] }>(
        token, `query { users(limit: 500) { id name email enabled is_guest } }`)
      const monday = (d.users ?? []).filter(u => !u.is_guest)

      const supabase = createAdminClient()
      const { data: peopleRows } = await supabase
        .from('people')
        .select('id, full_name, status, email_true_north, email_goodnews, email_coe, email_personal')
      type P = {
        id: string; full_name: string; status: string
        email_true_north: string | null; email_goodnews: string | null
        email_coe: string | null; email_personal: string | null
      }
      const people = (peopleRows ?? []) as P[]

      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
      const byEmail = new Map<string, P>()
      for (const p of people) {
        for (const e of [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]) {
          if (e) byEmail.set(norm(e), p)
        }
      }
      const byName = new Map<string, P[]>()
      for (const p of people) {
        const k = norm(p.full_name)
        byName.set(k, [...(byName.get(k) ?? []), p])
      }

      const email: string[] = []
      const name: string[] = []
      const ambiguous: string[] = []
      const none: string[] = []
      for (const u of monday.sort((a, b) => a.name.localeCompare(b.name))) {
        const tag = `${String(u.id).padEnd(11)} ${u.name.slice(0, 26).padEnd(28)} ${u.email}`
        const hitE = byEmail.get(norm(u.email ?? ''))
        if (hitE) { email.push(`  ${tag}  →  ${hitE.full_name}${hitE.status === 'inactive' ? ' (inactive)' : ''}`); continue }
        const hitN = byName.get(norm(u.name))
        if (hitN && hitN.length === 1) { name.push(`  ${tag}  →  ${hitN[0].full_name}${hitN[0].status === 'inactive' ? ' (inactive)' : ''}`); continue }
        if (hitN && hitN.length > 1) { ambiguous.push(`  ${tag}  →  ${hitN.length} people share that name`); continue }
        none.push(`  ${tag}`)
      }

      say(`${monday.length} Monday users (guests excluded), ${people.length} people in the directory.`)
      say()
      say(`MATCHED BY EMAIL   ${email.length}   the only join that is actually safe`)
      email.forEach(l => say(l))
      say()
      say(`MATCHED BY NAME    ${name.length}   works until somebody is typed differently`)
      name.forEach(l => say(l))
      say()
      say(`AMBIGUOUS          ${ambiguous.length}`)
      ambiguous.forEach(l => say(l))
      say()
      say(`NO MATCH           ${none.length}   these would vanish from a team filter, silently`)
      none.forEach(l => say(l))
      say()
      say('Nothing was written. This is a survey.')
      return done_()
    }

    return new Response(`Unknown part "${part}".`, { status: 400 })
  } catch (e) {
    say(`FAILED: ${(e as Error).message}`)
    return new Response(lines.join('\n'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
