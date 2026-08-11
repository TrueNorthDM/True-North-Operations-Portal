// Time off: the arithmetic, separate from the database and the screen.
//
// The one thing worth knowing before reading this: the account tracks no
// balances. All 26 active people carry a PTO balance of zero for every type,
// which means nobody maintains them. So a balance here is something to show,
// never something to check a request against: blocking a holiday request on a
// number nobody keeps would stop the feature working on its first day.

export type AbsenceState = 'pending' | 'approved' | 'denied' | 'cancelled'

export interface AbsenceDraft {
  jobcodeId: number | null
  startDate: string
  endDate: string
  hoursPerDay: number
  reason: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The days a request actually covers, weekends left out.
 *
 * Somebody asking for Friday to Monday is asking for two days off, not four,
 * and generating Saturday and Sunday would put hours on days nobody worked and
 * inflate the month. Public holidays are not handled here because they are
 * their own job code in this account: a holiday is logged, not skipped.
 */
export function workingDays(startISO: string, endISO: string): string[] {
  if (!ISO_DATE.test(startISO) || !ISO_DATE.test(endISO)) return []
  const start = Date.parse(`${startISO}T00:00:00Z`)
  const end = Date.parse(`${endISO}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []

  const out: string[] = []
  for (const d = new Date(start); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    // A year of leave is not a request, it is a mistake, and the loop should
    // not be the thing that discovers it.
    if (out.length > 366) break
  }
  return out
}

/** Total hours a request comes to, which is what the approver is deciding on. */
export function requestHours(draft: AbsenceDraft): number {
  return workingDays(draft.startDate, draft.endDate).length * draft.hoursPerDay
}

/**
 * What is wrong with a request, in a sentence, or null.
 *
 * Deliberately says nothing about balances. See the note at the top of the file.
 */
export function validateAbsence(draft: AbsenceDraft): string | null {
  if (!draft.jobcodeId) return 'Pick a kind of time off.'
  if (!ISO_DATE.test(draft.startDate) || !ISO_DATE.test(draft.endDate)) return 'Pick both dates.'
  if (Date.parse(draft.endDate) < Date.parse(draft.startDate)) {
    return 'The last day cannot be before the first.'
  }
  if (draft.hoursPerDay <= 0) return 'Hours per day has to be more than zero.'
  if (draft.hoursPerDay > 24) return 'That is more hours than a day has.'

  const days = workingDays(draft.startDate, draft.endDate)
  if (!days.length) return 'That range is only weekends, so there is nothing to book.'
  if (days.length > 90) return 'That is longer than three months. Split it up.'
  return null
}

/** Do two ranges of days off touch? Used to refuse booking the same day twice. */
export function absenceOverlaps(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

/** How a request reads, and what can still be done to it. */
export function absenceStatus(state: AbsenceState): { label: string; canCancel: boolean } {
  switch (state) {
    case 'approved': return { label: 'Approved', canCancel: true }
    case 'denied': return { label: 'Denied', canCancel: false }
    case 'cancelled': return { label: 'Cancelled', canCancel: false }
    default: return { label: 'Waiting', canCancel: true }
  }
}
