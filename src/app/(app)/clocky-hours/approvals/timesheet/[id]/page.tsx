// The 6C page (Clocky part 2, Approvals.dc.html): a timesheet and its invoice
// or payroll summary side by side with its steps, opened from Approvals. Who
// may open it and what they see (never money for a Team Leader) is
// lib/timeclock/timesheet-review.ts.

import { notFound } from 'next/navigation'
import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadReview } from '@/lib/timeclock/timesheet-review'
import { TimesheetReviewLive } from '@/components/clocky/approvals/TimesheetReviewLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Approvals' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireSurface('clocky-approvals')
  if (!/^\d+$/.test(id)) notFound()
  const access = await loadAccess()
  const v = await viewerFor(access)
  if (!v) notFound()
  const review = await loadReview(v, 'timesheet', Number(id))
  // Closed and missing look the same.
  if (!review) notFound()
  return <TimesheetReviewLive review={review} />
}
