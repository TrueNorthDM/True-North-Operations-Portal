// TSheets (QuickBooks Time) REST API v1, response shapes.
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

// A flattened i7 timesheet entry, the shape the report is built from, matching
// the cache table (tsheets_timesheets). i7Code/activity come from the two custom
// fields; duration stays in seconds.
export interface I7Entry {
  user_id: number
  duration: number
  date: string       // YYYY-MM-DD
  i7Code: string
  activity: string
}

// ── i7 Budget Usage Report, Project → Job code → Activity tree ──────────────
// People are no longer a row level: each node carries a name→hours map so the
// table can show one HOURS column per person. `people` on the report is the
// ordered union of everyone with hours in the period (the column headers).
export type PersonHours = Record<string, number>   // display name → hours
export interface I7Activity { activity: string; hours: number; cost: number; byPerson: PersonHours }
export interface I7Jobcode { code: string; hours: number; cost: number; activities: I7Activity[]; byPerson: PersonHours }
export interface I7Project { project: string; hours: number; cost: number; jobcodes: I7Jobcode[]; byPerson: PersonHours }
export interface I7Report {
  month: string
  startDate: string
  endDate: string
  projects: I7Project[]
  people: string[]           // person columns (union of everyone with hours), sorted
  totalHours: number
  totalCost: number
  hasRates: boolean
}

// One month of the trend series (January → selected month), for the charts.
export interface I7TrendPoint {
  month: string      // YYYY-MM
  hours: number      // i7 hours used that month
  cost: number       // actual $ cost that month
  budget: number     // that month's $ budget (base + extra)
  balance: number    // running balance through that month (Σ budget − Σ cost)
}

// Bank-account style running balance for the i7 $ budget.
export interface I7Carryover {
  opening: number         // balance carried in (Σ budget − Σ cost, Jan … prev month)
  monthBudget: number     // this month's budget ($ base + extra)
  monthUsed: number       // this month's cost
  totalAvailable: number  // opening + monthBudget
  totalLeft: number       // totalAvailable − monthUsed (this month's closing balance)
}

// Generic paginated response wrapper
export interface TsheetsPage<T> {
  results: T
  more: boolean
  error?: { code: number; message: string }
}
