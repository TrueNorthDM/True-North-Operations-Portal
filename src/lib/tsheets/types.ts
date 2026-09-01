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

// A flattened i7 timesheet entry, the shape the report is built from. It began
// as the row shape of a cache table that no longer exists, and is now just the
// contract between report-source.ts and buildI7Report: the seam that let the
// source move to tc_entries without touching the tree, the charts or the
// exports. i7Code/activity come from the two custom fields; duration stays in
// seconds.
export interface I7Entry {
  /**
   * The directory person, not the TSheets account.
   *
   * A TSheets id was the key while everybody who billed hours had one. It
   * stopped being an identity the first time a contractor's hours were added
   * by hand from an invoice: no account, no key, and the entry was dropped on
   * its way into the report.
   */
  personId: string
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
  /** Balance carried in: Σ budget − Σ cost from `openingFrom` to the previous month. */
  opening: number
  monthBudget: number     // this month's budget ($ base + extra)
  monthUsed: number       // this month's cost
  totalAvailable: number  // opening + monthBudget
  totalLeft: number       // totalAvailable − monthUsed (this month's closing balance)
  /** First month the opening balance accumulates from ('YYYY-MM'). */
  openingFrom: string
  /**
   * False once the 24-month retention window no longer reaches `openingFrom`,
   * which happens from January 2028: the hours behind the earliest months are
   * pruned, so the balance would read higher than it should. The UI says so
   * instead of presenting an incomplete figure as a complete one.
   */
  openingComplete: boolean
}

// Generic paginated response wrapper
export interface TsheetsPage<T> {
  results: T
  more: boolean
  error?: { code: number; message: string }
}
