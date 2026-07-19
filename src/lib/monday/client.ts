/**
 * Minimal Monday GraphQL client.
 *
 * Only does what our webhook handlers actually need: fetch an item with a
 * few columns, write a status column value. Skipping fancy abstractions
 * (DataLoader, retries, etc.) until we have evidence we need them.
 *
 * The token is read from app_settings.monday_api_token via the caller,
 * we don't reach into Supabase from here, so this module stays a pure
 * fetch wrapper that's easy to test by stubbing global.fetch.
 */

const MONDAY_API = 'https://api.monday.com/v2'

interface GqlInput {
  token: string
  query: string
  variables?: Record<string, unknown>
}

async function gql<T>({ token, query, variables }: GqlInput): Promise<T> {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  })
  // Monday returns 200 with {errors: [...]} on validation errors, check both.
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(`Monday API: ${json.errors.map(e => e.message).join('; ')}`)
  }
  if (!json.data) {
    throw new Error(`Monday API: empty response (status ${res.status})`)
  }
  return json.data
}

export interface MondayColumnValue {
  id: string
  text: string | null
  value: string | null
}

export interface MondayItem {
  id: string
  name: string
  board: { id: string }
  column_values: MondayColumnValue[]
}

/**
 * Fetch a single item plus the column values we care about.
 * Pass the column IDs you actually need, keeps the response small and
 * forces the caller to be explicit about its dependency on a column.
 */
export async function fetchItem(opts: {
  token: string
  itemId: string
  columnIds: string[]
}): Promise<MondayItem | null> {
  const { token, itemId, columnIds } = opts
  const data = await gql<{ items: MondayItem[] }>({
    token,
    query: `
      query ($ids: [ID!]!, $cols: [String!]!) {
        items(ids: $ids) {
          id
          name
          board { id }
          column_values(ids: $cols) { id text value }
        }
      }
    `,
    variables: { ids: [itemId], cols: columnIds },
  })
  return data.items[0] ?? null
}

/**
 * Set a status column on an item to a specific label.
 * Used to flip "Href Links" to "Apply Link" once all language URLs land.
 */
export async function setStatusLabel(opts: {
  token: string
  boardId: string
  itemId: string
  columnId: string
  label: string
}): Promise<void> {
  const { token, boardId, itemId, columnId, label } = opts
  await gql({
    token,
    query: `
      mutation ($board: ID!, $item: ID!, $col: String!, $val: String!) {
        change_simple_column_value(
          board_id: $board,
          item_id: $item,
          column_id: $col,
          value: $val
        ) { id }
      }
    `,
    // change_simple_column_value takes the label name itself for status columns.
    // (Setting via index would require change_column_value with a JSON value.)
    variables: { board: boardId, item: itemId, col: columnId, val: label },
  })
}

