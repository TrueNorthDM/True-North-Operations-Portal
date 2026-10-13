// Reading QuickBooks Time for the migration.
//
// Separate from lib/tsheets/client.ts on purpose. That client exists to feed the
// client reports and filters hard: active users only, active regular job codes
// only, and only the i7 branch of the tree. Those filters are right for a report
// and wrong for a migration, where 519 of the 545 job codes are deactivated and
// 44 of the 70 people are former employees who own a decade of the history.
//
// Everything here is a GET. Nothing writes to QuickBooks Time, ever.

const BASE = 'https://rest.tsheets.com/api/v1'

/**
 * How long one page may take before it counts as no answer (audit, 13 October
 * 2026). A page is 200 rows, which QuickBooks Time answers in a second or two;
 * without a limit a call it never answers held the import until the platform
 * killed it, with nothing in the log to say why.
 */
const CALL_TIMEOUT_MS = 30_000

export interface SourceJobcode {
  id: number
  parent_id: number
  name: string
  type: string            // 'regular' | 'pto' | 'unpaid_time_off' | 'break'
  billable: boolean
  active: boolean
}

export interface SourceUser {
  id: number
  first_name: string
  last_name: string
  active: boolean
  email?: string
  hire_date?: string
  term_date?: string
}

export interface SourceField {
  id: number
  name: string
  required: boolean
  active: boolean
  short_code?: string
}

export interface SourceFieldOption {
  id: number
  customfield_id: number
  name: string
  active: boolean
}

export interface SourceTimesheet {
  id: number
  user_id: number
  jobcode_id: number
  start: string
  end: string
  duration: number
  date: string
  type: string            // 'regular' | 'manual'
  state?: string          // 'APPROVED' | 'SUBMITTED' | ...
  locked: number
  on_the_clock: boolean
  notes?: string
  customfields?: Record<string, string>
  created_by_user_id?: number
  last_modified?: string
}

interface Page {
  results?: Record<string, Record<string, unknown>>
  more?: boolean
}

/**
 * An instant in the only shape TSheets accepts as a watermark.
 *
 * It answers 417 to any fractional seconds, which rules out both obvious
 * sources: Postgres hands back microseconds ('...T17:12:33.123456+00:00') and
 * toISOString() gives milliseconds ('...T17:12:33.123Z'). Whole seconds with a
 * Z is accepted, and so is +00:00.
 *
 * Here rather than at the call sites because this is the one place a timestamp
 * turns into a query parameter, and a rule enforced anywhere else is a rule
 * somebody will route around by accident.
 */
export function watermark(instant: string): string {
  const t = Date.parse(instant)
  if (Number.isNaN(t)) return new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  return new Date(t).toISOString().replace(/\.\d+Z$/, 'Z')
}

async function get(token: string, path: string, params: Record<string, string>): Promise<Page> {
  const qs = new URLSearchParams(params).toString()
  let json
  try {
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`TSheets ${path}: HTTP ${res.status}`)
    // The limit covers the body too: a page that stops halfway is no answer.
    json = await res.json()
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      throw new Error(`TSheets ${path}: QuickBooks Time did not answer within ${CALL_TIMEOUT_MS / 1000} seconds`)
    }
    throw e
  }
  if (json.error) throw new Error(`TSheets ${path}: ${json.error.message}`)
  return json as Page
}

async function all<T>(token: string, path: string, params: Record<string, string>, key: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page < 500; page++) {
    const r = await get(token, path, { ...params, page: String(page), per_page: '200' })
    out.push(...(Object.values(r.results?.[key] ?? {}) as T[]))
    if (!r.more) break
  }
  return out
}

/** Every job code: inactive ones too, and every type, because that is the history. */
export function fetchAllJobcodes(token: string): Promise<SourceJobcode[]> {
  return all<SourceJobcode>(token, '/jobcodes', { active: 'both', type: 'all' }, 'jobcodes')
}

/** Every user, including the 44 who have left. */
export function fetchAllUsers(token: string): Promise<SourceUser[]> {
  return all<SourceUser>(token, '/users', { active: 'both' }, 'users')
}

export function fetchFields(token: string): Promise<SourceField[]> {
  return all<SourceField>(token, '/customfields', { active: 'both' }, 'customfields')
}

/** Options come one field at a time: the endpoint 404s when asked for all of them. */
export function fetchFieldOptions(token: string, fieldId: number): Promise<SourceFieldOption[]> {
  return all<SourceFieldOption>(
    token, '/customfielditems',
    { customfield_id: String(fieldId), active: 'both' },
    'customfielditems',
  )
}

/**
 * A date range of timesheets. No jobcode filter, so this returns everything the
 * account has for those days, which is the point.
 */
export function fetchTimesheetRange(
  token: string,
  startDate: string,
  endDate: string,
  modifiedSince?: string,
): Promise<SourceTimesheet[]> {
  const params: Record<string, string> = { start_date: startDate, end_date: endDate }
  if (modifiedSince) params.modified_since = watermark(modifiedSince)
  return all<SourceTimesheet>(token, '/timesheets', params, 'timesheets')
}

/**
 * Ids deleted upstream since a watermark.
 *
 * An upsert-only import cannot see these: a deleted entry simply stops coming
 * back, so it would sit in our tables forever as an hour that no longer exists.
 */
export async function fetchDeletedIds(token: string, modifiedSince: string): Promise<number[]> {
  const rows = await all<{ id: number }>(
    token, '/timesheets_deleted', { modified_since: watermark(modifiedSince) }, 'timesheets_deleted',
  )
  return rows.map(r => r.id).filter(Boolean)
}
