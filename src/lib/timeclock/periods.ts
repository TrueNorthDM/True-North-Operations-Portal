// Pay periods, and the state a person's month is in.
//
// The account runs monthly, so a period is a calendar month in the company's
// timezone. Kept as its own module because two screens ask the same questions
// of it: My Hours, to know whether the month can still be edited, and the
// approvals list, to know whose month is waiting.

export type SubmissionState = 'draft' | 'submitted' | 'approved' | 'returned'

/** The month an ISO date falls in, as a period. */
export function periodFor(dateISO: string): { month: string; start: string; end: string } {
  const month = dateISO.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  return {
    month,
    start: `${month}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  }
}

/** Step a month back or forward: '2026-01' shifted by -1 is '2025-12'. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

/** 'August 2026', for a heading. */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * What a person may do with a month, given where it is.
 *
 * One function rather than conditions spread across the screens, so the button
 * that appears and the action that runs cannot disagree about whether a month
 * is still open.
 */
export function whatCanIDo(state: SubmissionState | null): {
  canEdit: boolean
  canSubmit: boolean
  label: string
  hint: string
} {
  switch (state) {
    case 'submitted':
      return {
        canEdit: false, canSubmit: false,
        label: 'Waiting for approval',
        hint: 'Sent. It cannot be edited while somebody is looking at it. Ask to have it handed back if something is wrong.',
      }
    case 'approved':
      return {
        canEdit: false, canSubmit: false,
        label: 'Approved',
        hint: 'Signed off. Changing it now needs an admin, on purpose: somebody has already acted on these hours.',
      }
    case 'returned':
      return {
        canEdit: true, canSubmit: true,
        label: 'Handed back',
        hint: 'It came back to you with a note. Fix what is flagged and send it again.',
      }
    default:
      return {
        canEdit: true, canSubmit: true,
        label: 'Open',
        hint: 'Still yours to edit. Submit it when the month is done.',
      }
  }
}
