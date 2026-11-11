// One annual review (design handoff, 3 November 2026, C3 to E5): open to the
// person, the one they report to now, HR, the VP of Operations, the CISO and
// Super Admins (lib/review/data.ts). Anyone else gets "not found", the same
// as a review that is not there.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ReviewPage } from '@/components/review/ReviewPage'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadReviewView } from '@/lib/review/view'
import { reviewToday } from '@/lib/review/data'
import { bookingFor } from '@/lib/review/booking'
import { createDrawerEvent, deleteDrawerEvent, findTimeData, updateDrawerEvent } from '@/app/(app)/agenda/drawer-actions'
import {
  addGoal, agreeReview, approveReview, copyJobDescription, finishReview, linkMeeting, markApprovedSeen, markGoal, removeGoal, removePriority, retryReviewDrive,
  saveAnswer, saveGoal, saveMeetingNotes, savePriority, sendBack, submitSelf, undoCopyJob,
} from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Annual review' }

export default async function ReviewRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ approved?: string }> }) {
  const { id } = await params
  const showApproved = (await searchParams).approved === '1'
  if (!/^\d+$/.test(id)) notFound()
  const ctx = await reviewContext(await requireSurface('human-resources'))
  const v = await loadReviewView(Number(id), ctx.viewer, ctx.roster)
  if (!v) notFound()
  const today = reviewToday()
  // The reviewer's own part at the meeting step; the other reviewer is invited too while theirs waits for one.
  const mp = v.parts.find(p => p.mine)
  const other = v.parts.find(p => p !== mp && p.step === 'meeting' && !p.meeting.startsAt && p.reviewer.id)
  const booking = v.role === 'reviewer' && mp?.step === 'meeting' && !mp.meeting.held
    ? await bookingFor(ctx.access, {
      personId: v.person.id, today, title: `${v.year} review: ${v.person.name}`, others: other ? [other.reviewer.id!] : [],
      note: `Booked from ${v.person.name}'s ${v.year} review, so it is already filled in. Once it is saved, the meeting shows on the review, on both Agendas and on both Google Calendars.`,
      description: `Your ${v.year} annual performance review. We go through your self-review, your goals for ${v.year + 1} and my feedback, and agree the goals. Before we meet: open your review in Human Resources and read my feedback.`,
    })
    : null
  const mine = v.role === 'person'
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb parents={mine ? ['/human-resources'] : ['/human-resources', '/human-resources/reviews']} now={mine ? `Your ${v.year} review` : v.person.name} />
      <ReviewPage v={v} today={today} booking={booking} showApproved={showApproved}
        drawerApi={booking ? { create: createDrawerEvent, update: updateDrawerEvent, remove: deleteDrawerEvent, findTime: findTimeData } : null}
        api={{ saveAnswer, copyJobDescription, undoCopyJob, addGoal, saveGoal, removeGoal, markGoal, submitSelf, sendBack, finishReview, linkMeeting, saveMeetingNotes, agreeReview, approveReview, retryReviewDrive, markApprovedSeen, savePriority, removePriority }} />
    </div>
  )
}
