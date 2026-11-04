// The approved review's print page: the document the PDF is printed from
// (components/review/ReviewDoc.tsx), for whoever may see the review.

import { notFound } from 'next/navigation'
import { ReviewDoc } from '@/components/review/ReviewDoc'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadReviewView } from '@/lib/review/view'
import { reviewToday } from '@/lib/review/data'

export const dynamic = 'force-dynamic'

export default async function ReviewPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const ctx = await reviewContext(await requireSurface('human-resources'))
  const v = await loadReviewView(Number(id), ctx.viewer, ctx.roster)
  if (!v || v.step !== 'approved') notFound()
  return <ReviewDoc v={v} today={reviewToday()} />
}
