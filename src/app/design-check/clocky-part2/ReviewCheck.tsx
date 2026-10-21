'use client'

// The 6C frames (Approvals.dc.html): the real page with the prototype's data,
// built on the server (review-sample.ts). Decisions answer as the prototype's
// toasts; nothing saves.

import { TimesheetReviewPage, type ReviewApi } from '@/components/clocky/approvals/TimesheetReviewPage'
import type { TimesheetReview } from '@/lib/timeclock/timesheet-review'

export function ReviewCheck({ frame, review, tab, day, modal }: { frame: string; review: TimesheetReview; tab?: 'sum' | 'entries' | 'both'; day?: string; modal?: 'return' | 'pdf' }) {
  const api: ReviewApi = {
    approve: async () => ({ ok: true, toast: review.act.kind === 'hours' ? 'Hours approved. Arnaldo Oliveira finishes the approval.' : review.isContractor ? `Approved both. October is locked and ${review.invoice?.number ?? 'the invoice'} is Approved for Finance.` : 'Approved and sent to Rippling.' }),
    return: async () => ({ ok: true, toast: `Returned to ${review.who}. They see your reason.` }),
    reopen: async () => ({ ok: true, toast: `October is open again for ${review.who.split(' ')[0]}.` }),
    retry: async () => ({ ok: true, toast: 'Sent to Rippling, Nov 3, 2026, 9:41 AM.' }),
  }
  return <TimesheetReviewPage key={frame} review={review} api={api} initial={{ tab, day, modal }} />
}
