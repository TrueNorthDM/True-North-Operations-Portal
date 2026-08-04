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

/**
 * The months from `fromYm` up to but NOT including `toYm`, in order.
 *
 * Used to accumulate the carryover balance across the whole history rather
 * than restarting it every January. Exclusive at the end because the caller
 * always wants "everything before the month I am showing".
 *
 * Returns [] when `toYm` is at or before `fromYm`, so the first month of all
 * has an opening balance of zero without a special case.
 */
export function monthsBetween(fromYm: string, toYm: string): string[] {
  const out: string[] = []
  let [y, m] = fromYm.split('-').map(Number)
  while (`${y}-${String(m).padStart(2, '0')}` < toYm) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}
