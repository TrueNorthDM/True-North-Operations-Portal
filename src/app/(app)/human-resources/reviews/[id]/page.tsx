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
  addGoal, agreeReview, approveReview, checkinAddGoal, checkinAdjustGoal, checkinGoalDone, copyJobDescription, finishCheckin, finishReview, linkCheckin, linkMeeting,
  markApprovedSeen, markGoal, removeGoal, removePriority, retryReviewDrive, saveAnswer, saveCheckinNote, saveGoal, saveMeetingNotes, savePriority, sendBack, submitSelf, undoCopyJob,
} from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Annual review' }

export default async function ReviewRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ approved?: string; tab?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const showApproved = sp.approved === '1'
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
  // The 6-month check-in's booking, for the reviewer whose part has none yet (the other reviewer invited too).
  const ckPart = v.checkin?.parts.find(p => p.no === mp?.no)
  const ckOther = v.checkin && mp ? v.parts.find(p => p !== mp && !v.checkin!.parts.find(c => c.no === p.no)?.startsAt && p.reviewer.id) : null
  const checkinBooking = v.checkin && mp && ckPart && !ckPart.startsAt && !ckPart.finishedAt
    ? await bookingFor(ctx.access, {
      personId: v.person.id, today, minutes: 30, title: `6-month check-in: ${v.person.name}`, others: ckOther ? [ckOther.reviewer.id!] : [],
      note: `Booked from ${v.person.name}'s ${v.year} review, so it is already filled in. Once it is saved, the check-in shows on the review, on the Agendas and on the Google Calendars.`,
      description: `Your 6-month check-in. We go through each of your goals for ${v.year + 1}: tick what is done, adjust what needs adjusting, and agree the rest of the year.`,
    })
    : null
  const mine = v.role === 'person'
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb parents={mine ? ['/human-resources'] : ['/human-resources', '/human-resources/reviews']} now={mine ? `Your ${v.year} review` : v.person.name} />
      <ReviewPage v={v} today={today} booking={booking} showApproved={showApproved} checkinBooking={checkinBooking} openCheckin={sp.tab === 'checkin'}
        drawerApi={booking || checkinBooking ? { create: createDrawerEvent, update: updateDrawerEvent, remove: deleteDrawerEvent, findTime: findTimeData } : null}
        api={{ saveAnswer, copyJobDescription, undoCopyJob, addGoal, saveGoal, removeGoal, markGoal, submitSelf, sendBack, finishReview, linkMeeting, saveMeetingNotes, agreeReview, approveReview, retryReviewDrive, markApprovedSeen, savePriority, removePriority, checkinGoalDone, checkinAdjustGoal, checkinAddGoal, saveCheckinNote, linkCheckin, finishCheckin }} />
    </div>
  )
}
