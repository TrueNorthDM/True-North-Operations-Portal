// Rolling data-retention window for the cached i7 timesheets.
//
// The user asked to keep TSheets data for a rolling 2 years, but never earlier
// than January 2026 (the first month we ever pulled). So the earliest kept month
// is the LATER of Jan 2026 and (current month − 23):
//   Jul 2026 → floor Jan 2026 (rolling would be Aug 2024, but that predates our data)
//   Dec 2027 → floor Jan 2026 (24 months: Jan 26 … Dec 27)
//   Jan 2028 → floor Feb 2026 (24 months: Feb 26 … Jan 28)
//
// Both the month dropdown (what the user can pick) and the sync's prune step
// (what we keep in the cache) derive from this single rule.

// The first month we have any data for, never keep/offer anything before this.
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
