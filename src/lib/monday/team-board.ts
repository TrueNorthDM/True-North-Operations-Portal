/**
 * Fetch the "True North Team" Monday board (2547376221) live and shape it for a
 * faithful render: the board's groups, its columns (with status-label colours),
 * and every item's column values. Uses the shared Monday token (getMondayToken).
 *
 * Generic on purpose — it mirrors whatever structure the board has (groups →
 * sections, columns → table headers, items → rows), so it keeps working if the
 * board changes. Status cells carry the label's colour; people cells carry names.
 */

import { getMondayToken } from './snapshot'

const MONDAY_API = 'https://api.monday.com/v2'
const BOARD_ID = '2547376221'

async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '))
  if (!json.data) throw new Error(`empty response (HTTP ${res.status})`)
  return json.data
}

export interface TeamBoardColumn { id: string; title: string; type: string }
export interface TeamBoardCell { text: string; type: string; color?: string | null; names?: string[] }
export interface TeamBoardItem { id: string; name: string; cells: Record<string, TeamBoardCell> }
export interface TeamBoardGroup { id: string; title: string; color: string; items: TeamBoardItem[] }
export interface TeamBoard {
  ok: boolean
  error?: string
  name: string
  columns: TeamBoardColumn[]
  groups: TeamBoardGroup[]
  itemCount: number
}

interface RawCol { id: string; title: string; type: string; settings_str: string | null }
interface RawCV { id: string; text: string | null; value: string | null; type: string }
interface RawItem { id: string; name: string; group: { id: string }; column_values: RawCV[] }
interface RawPage { cursor: string | null; items: RawItem[] }

const ITEM_FIELDS = `id name group { id } column_values { id text value type }`

// status/color settings → { index → hex colour }, so a status cell renders in its
// real board colour. Monday's settings_str shape varies; read it defensively.
function statusColors(settings: string | null): Record<string, string> {
  if (!settings) return {}
  try {
    const s = JSON.parse(settings) as { labels_colors?: Record<string, { color?: string }> }
    const out: Record<string, string> = {}
    for (const [idx, c] of Object.entries(s.labels_colors ?? {})) if (c?.color) out[idx] = c.color
    return out
  } catch { return {} }
}

export async function fetchTeamBoard(): Promise<TeamBoard> {
  const empty = (error: string): TeamBoard => ({ ok: false, error, name: '', columns: [], groups: [], itemCount: 0 })
  const token = await getMondayToken()
  if (!token) return empty('No Monday API token is configured. Add it in Settings → APIs & tokens.')

  try {
    const meta = await gql<{ boards: { name: string; columns: RawCol[]; groups: { id: string; title: string; color: string }[]; items_page: RawPage }[] }>(
      token,
      `query ($board: [ID!]) {
        boards(ids: $board) {
          name
          columns { id title type settings_str }
          groups { id title color }
          items_page(limit: 100) { cursor items { ${ITEM_FIELDS} } }
        }
      }`,
      { board: [BOARD_ID] },
    )
    const board = meta.boards?.[0]
    if (!board) return empty('Board not found, or this Monday token can’t access it.')

    // Paginate the rest of the items.
    const items: RawItem[] = [...board.items_page.items]
    let cursor = board.items_page.cursor
    while (cursor) {
      const page = await gql<{ next_items_page: RawPage }>(
        token,
        `query ($cursor: String!) { next_items_page(limit: 100, cursor: $cursor) { cursor items { ${ITEM_FIELDS} } } }`,
        { cursor },
      )
      items.push(...page.next_items_page.items)
      cursor = page.next_items_page.cursor
    }

    // Columns to show as table headers — drop the item-name column (rendered first).
    const columns: TeamBoardColumn[] = board.columns
      .filter(c => c.type !== 'name')
      .map(c => ({ id: c.id, title: c.title, type: c.type }))
    const colorMaps: Record<string, Record<string, string>> = {}
    for (const c of board.columns) if (c.type === 'status' || c.type === 'color') colorMaps[c.id] = statusColors(c.settings_str)

    const shape = (it: RawItem): TeamBoardItem => ({
      id: it.id,
      name: it.name,
      cells: Object.fromEntries(it.column_values.map(cv => {
        const cell: TeamBoardCell = { text: cv.text ?? '', type: cv.type }
        if ((cv.type === 'status' || cv.type === 'color') && cv.value) {
          try { const idx = (JSON.parse(cv.value) as { index?: number }).index; if (idx != null) cell.color = colorMaps[cv.id]?.[String(idx)] ?? null } catch { /* ignore */ }
        }
        if ((cv.type === 'people' || cv.type === 'person') && cv.text) cell.names = cv.text.split(',').map(s => s.trim()).filter(Boolean)
        return [cv.id, cell]
      })),
    })

    const groups: TeamBoardGroup[] = board.groups.map(g => ({
      id: g.id,
      title: g.title,
      color: g.color,
      items: items.filter(it => it.group.id === g.id).map(shape),
    }))

    return { ok: true, name: board.name, columns, groups, itemCount: items.length }
  } catch (e) {
    return empty(e instanceof Error ? `Monday API: ${e.message}` : 'Failed to load the board.')
  }
}
