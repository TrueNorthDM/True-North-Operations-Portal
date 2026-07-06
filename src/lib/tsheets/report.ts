// Date helpers for the i7 Budget Usage Report. (The report tree itself is built
// in i7report.ts.)

// Returns the YYYY-MM-DD start/end for a given "YYYY-MM" string
export function monthBounds(ym: string): { startDate: string; endDate: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate: start, endDate: end }
}

// Default to current month in YYYY-MM format
export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
