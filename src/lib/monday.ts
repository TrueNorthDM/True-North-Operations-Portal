/**
 * monday.ts — Read-only Monday.com API client (MVP)
 *
 * Monday uses a GraphQL API. We only read items that are
 * at the "Href Links" step in the workflow.
 *
 * Docs: https://developer.monday.com/api-reference/reference/items
 */

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Shape of an item returned from Monday
export interface MondayItem {
  id: string
  name: string
  column_values: MondayColumnValue[]
}

export interface MondayColumnValue {
  id: string
  text: string
  value: string | null
}

async function mondayFetch<T>(query: string): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN
  if (!token) throw new Error('MONDAY_API_TOKEN is not set')

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query }),
    // Next.js cache: revalidate Monday data every 5 minutes
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Monday API error: ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data as T
}

/**
 * Fetches all items from a Monday board.
 * Caller is responsible for filtering by status column.
 *
 * @param boardId  Monday.com board ID (numeric string)
 * @param limit    Max items to fetch (default 100)
 */
export async function getBoardItems(
  boardId: string,
  limit = 100,
): Promise<MondayItem[]> {
  const query = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: ${limit}) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `

  const data = await mondayFetch<{
    boards: Array<{ items_page: { items: MondayItem[] } }>
  }>(query)

  return data.boards[0]?.items_page?.items ?? []
}

/**
 * Extracts the text value of a specific column from an item.
 */
export function getColumnText(item: MondayItem, columnId: string): string {
  return item.column_values.find(c => c.id === columnId)?.text ?? ''
}
