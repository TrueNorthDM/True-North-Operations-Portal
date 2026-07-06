// TSheets (QuickBooks Time) REST API v1 — response shapes.
//
// The API wraps all results in a keyed object (not an array):
//   { results: { timesheets: { "12345": { id: 12345, ... } } }, more: boolean, ... }
// Pagination is manual: if `more === true`, fetch `page=N+1` with the same params.

export interface TsheetsUser {
  id: number
  first_name: string
  last_name: string
  active: boolean
  email: string
}

export interface TsheetsJobcode {
  id: number
  name: string
  active: boolean
  parent_id: number | null
  // type: 'regular' | 'pto' | 'paid_holiday' | 'unpaid_holiday' | 'break'
  type: string
}

export interface TsheetsTimesheet {
  id: number
  user_id: number
  jobcode_id: number
  // duration in seconds (for manual entries and approved entries)
  duration: number
  date: string // YYYY-MM-DD
  // type: 'regular' | 'manual'
  type: string
  on_the_clock: boolean
  locked: number
  // Per-entry custom fields keyed by customfield id (as string). For i7:
  //   '129628' = "1 - i7 Code"  (e.g. "WM-MKTG" → project + job code)
  //   '19156'  = "3 Activity"   (e.g. "Content: Writing")
  customfields?: Record<string, string>
}

// ── i7 Budget Usage Report — Project → Job code → Activity tree ──────────────
export interface I7Activity { activity: string; hours: number; cost: number }
export interface I7Jobcode { code: string; hours: number; cost: number; activities: I7Activity[] }
export interface I7Project { project: string; hours: number; cost: number; jobcodes: I7Jobcode[] }
export interface I7Report {
  month: string
  startDate: string
  endDate: string
  projects: I7Project[]
  totalHours: number
  totalCost: number
  hasRates: boolean
}

// Generic paginated response wrapper
export interface TsheetsPage<T> {
  results: T
  more: boolean
  error?: { code: number; message: string }
}
