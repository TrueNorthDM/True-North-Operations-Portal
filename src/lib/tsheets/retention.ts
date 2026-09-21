// Rolling window for the client report's month picker.
//
// It began as a retention rule for the old tsheets_timesheets cache: keep a
// rolling two years, never earlier than January 2026, the first month we ever
// pulled. The report no longer reads that cache, so the rule now decides one
// thing only: which months the picker offers.
//
// WHY IT STILL STOPS AT JANUARY 2026, decided in August 2026 after checking
// rather than assuming. Clocky holds i7 hours back to 2022, 25,543 of
// them. But i7_monthly_budget holds twelve rows, all 2026, and every one of the
// forty rate assignments starts on 2026-01-01 or later. So an earlier month
// would render real hours beside a budget of zero, a cost of zero and a
// per-person cost of zero, and zero is not the same as unknown: it states that
// 650 hours of work cost nothing.
//
// The carryover itself would survive, which was my first guess and it was
// wrong. It accumulates budget minus cost, and before 2026 both sides are zero,
// so the balance would read exactly as it does now.
//
// Opening it up therefore needs one of two things first: rates and budgets
// backfilled for 2022-2025, or the money columns taught to say "no rate on
// file" instead of a number. Neither was worth doing for months nobody asked
// to see.
//
// The earliest offered month is the LATER of Jan 2026 and (current month − 23):
//   Jul 2026 → floor Jan 2026 (rolling would be Aug 2024, but that predates our data)
//   Dec 2027 → floor Jan 2026 (24 months: Jan 26 … Dec 27)
//   Jan 2028 → floor Feb 2026 (24 months: Feb 26 … Jan 28)
//
// Both the month dropdown (what the user can pick) and the sync's prune step
// (what we keep in the cache) derive from this single rule.

// The first month with rates and budgets behind it, which is what makes a month
// worth offering. Not the first month with hours: that is 2022.
export const DATA_START = '2026-01'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM' for `monthsBack` months before `now` (0 = current month). */
function ymBack(now: Date, monthsBack: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** Earliest retained month as 'YYYY-MM', max(DATA_START, current − 23 months). */
export function retentionFloor(now: Date): string {
  const rolling = ymBack(now, 23)          // 24-month window inclusive of current
  return rolling > DATA_START ? rolling : DATA_START
}

/** Earliest retained date as 'YYYY-MM-01' (for SQL range / prune bounds). */
export function retentionFloorDate(now: Date): string {
  return `${retentionFloor(now)}-01`
}

/** Months to offer in the dropdown, floor … current month, newest first. */
export function availableMonths(now: Date): string[] {
  const floor = retentionFloor(now)
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  while (true) {
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    if (ym < floor) break
    out.push(ym)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

/** The editable window for the budget/hours grids, current month + next 5. */
export function editableMonths(now: Date, count = 6): string[] {
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

/** Past months within the retention window, floor … previous month, oldest first. */
export function pastMonths(now: Date): string[] {
  const floor = retentionFloor(now)
  const cur = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  d.setMonth(d.getMonth() - 1)                       // start at previous month
  while (true) {
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    if (ym < floor || ym >= cur) break
    out.unshift(ym)                                  // oldest first
    d.setMonth(d.getMonth() - 1)
  }
  return out
}
