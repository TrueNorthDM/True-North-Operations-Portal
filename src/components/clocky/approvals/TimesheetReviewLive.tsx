'use client'

/** The 6C page on the live site: the page over approvals/actions.ts. */

import { approveTimesheet, decideInvoice, reopenTimesheet, retryRippling, returnTimesheet } from '@/app/(app)/clocky-hours/approvals/actions'
import type { TimesheetReview } from '@/lib/timeclock/timesheet-review'
import { TimesheetReviewPage, type ReviewApi } from './TimesheetReviewPage'

export function TimesheetReviewLive({ review }: { review: TimesheetReview }) {
  const api: ReviewApi = review.kind === 'invoice'
    ? {
      approve: note => decideInvoice({ id: review.id, decision: 'approve', note }),
      return: reason => decideInvoice({ id: review.id, decision: 'return', note: reason }),
      reopen: async () => ({ ok: false, error: 'Nothing to reopen here.' }),
      retry: async () => ({ ok: false, error: 'Nothing to send.' }),
    }
    : {
      approve: note => approveTimesheet({ id: review.id, note }),
      return: reason => returnTimesheet({ id: review.id, reason }),
      reopen: reason => reopenTimesheet({ id: review.id, reason }),
      retry: () => retryRippling({ submissionId: review.id }),
    }
  return <TimesheetReviewPage review={review} api={api} />
}
