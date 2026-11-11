// The 6-month check-in lives in the review itself since 10 November 2026
// (its "6-month check-in" part). This address, used by older emails and
// links, sends the person's reviewer there.

import { notFound, redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadGoalsView } from '@/lib/review/mine'
import { reviewToday } from '@/lib/review/data'

export const dynamic = 'force-dynamic'

export default async function CheckinRoute({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const { viewer, roster } = await reviewContext(await requireSurface('human-resources'))
  if (!viewer.reports.has(personId)) notFound()
  const v = await loadGoalsView(personId, roster, reviewToday(), viewer.personId)
  if (!v) notFound()
  redirect(await previewHref(`/human-resources/reviews/${v.reviewId}?tab=checkin`))
}
