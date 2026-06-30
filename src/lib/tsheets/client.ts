// TSheets (QuickBooks Time) REST API v1 client.
//
// Pure fetch wrapper — no Supabase, no Next.js imports. The token is passed
// by the caller (read from app_settings server-side) so this module stays
// independently testable by stubbing global.fetch.
//
// All endpoints paginate: if `more === true` in the response, we fetch the
// next page automatically. Duration values from the API are in SECONDS.

import type {
  TsheetsUser,
  TsheetsJobcode,
  TsheetsTimesheet,
  TsheetsPage,
} from './types'

const BASE = 'https://rest.tsheets.com/api/v1'

async function tsGet<T>(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<TsheetsPage<T>> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Always fetch fresh — report data must reflect current approvals
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`TSheets API ${path}: HTTP ${res.status}`)
  }
  const json = await res.json()
  if (json.error) {
    throw new Error(`TSheets API ${path}: ${json.error.message} (code ${json.error.code})`)
  }
  return json as TsheetsPage<T>
}

// Collect all pages for a paginated endpoint.
// `extract` pulls the keyed-object results from the response and converts
// to an array, since the API returns { "123": {...}, "456": {...} } not [].
async function fetchAll<TResult, TItem>(
  token: string,
  path: string,
  baseParams: Record<string, string>,
  extract: (results: TResult) => TItem[],
): Promise<TItem[]> {
  const items: TItem[] = []
  let page = 1
  while (true) {
    const resp = await tsGet<TResult>(token, path, { ...baseParams, page: String(page) })
    items.push(...extract(resp.results))
    if (!resp.more) break
    page++
  }
  return items
}

export async function fetchUsers(token: string): Promise<TsheetsUser[]> {
  return fetchAll<{ users: Record<string, TsheetsUser> }, TsheetsUser>(
    token,
    '/users',
    { active: 'yes', per_page: '200' },
    r => Object.values(r.users),
  )
}

export async function fetchJobcodes(token: string): Promise<TsheetsJobcode[]> {
  return fetchAll<{ jobcodes: Record<string, TsheetsJobcode> }, TsheetsJobcode>(
    token,
    '/jobcodes',
    { active: 'yes', type: 'regular', per_page: '200' },
    r => Object.values(r.jobcodes),
  )
}

// Fetches all approved/submitted timesheets for a date range.
// `on_the_clock=no` excludes currently-running entries (not yet saved).
export async function fetchTimesheets(
  token: string,
  startDate: string,
  endDate: string,
): Promise<TsheetsTimesheet[]> {
  return fetchAll<{ timesheets: Record<string, TsheetsTimesheet> }, TsheetsTimesheet>(
    token,
    '/timesheets',
    {
      start_date: startDate,
      end_date: endDate,
      on_the_clock: 'no',
      per_page: '200',
    },
    r => Object.values(r.timesheets),
  )
}
