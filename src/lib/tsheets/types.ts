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
}

// Generic paginated response wrapper
export interface TsheetsPage<T> {
  results: T
  more: boolean
  error?: { code: number; message: string }
}

// The pivot matrix built from raw data
export interface TimeReportMatrix {
  month: string              // "June 2026"
  startDate: string          // "2026-06-01"
  endDate: string            // "2026-06-30"
  employees: { id: number; name: string }[]   // sorted alphabetically by first name
  jobcodes: { id: number; name: string }[]    // sorted alphabetically
  // hours[jobcodeId][employeeId] = total hours (already rounded to 2dp)
  hours: Record<number, Record<number, number>>
  rowTotals: Record<number, number>   // total hours per jobcode
  colTotals: Record<number, number>   // total hours per employee
  grandTotal: number
}
