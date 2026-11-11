'use client'

// The annual review guides' pictures: the real review card, review page, its
// goal and priority parts, My reviews, My goals, My team's goals, the year's
// list and the Priorities page, fed the manual's made-up data
// (lib/manual/samples/review.ts). Every action answers "This is an example."
// and nothing saves; the picture around them (GuideParts) makes them inert.

import { ReviewCard, ReviewHistory, MyGoals, TeamGoals } from '@/components/review/HrParts'
import { ReviewPage, type ReviewApi } from '@/components/review/ReviewPage'
import { GoalList, PastGoal, PriorityBlock, Section } from '@/components/review/parts'
import { ReviewList } from '@/components/review/ReviewList'
import { PrioritiesPage } from '@/components/review/PrioritiesPage'
import { APR_COLORS } from '@/lib/review/colors'
import {
  REVIEW_TODAY, agreeSample, approvalSample, goalsSample, historySample, kickoffSample, managerReviewSample, myGoalsSample, pastGoalsSample,
  prioritiesPageSample, prioritiesSample, progressSample, reviewCardSample, reviewListSample, selfReviewSample, teamGoalsSample,
} from '@/lib/manual/samples/review'

const EXAMPLE = { ok: true as const, toast: 'This is an example.' }
const noop = async () => EXAMPLE
const none = () => {}

const API: ReviewApi = {
  saveGoal: noop, removeGoal: noop, saveAnswer: noop, copyJobDescription: noop, undoCopyJob: noop, addGoal: noop, markGoal: noop,
  submitSelf: noop, sendBack: noop, finishReview: noop, linkMeeting: noop, saveMeetingNotes: noop, agreeReview: noop, approveReview: noop,
  retryReviewDrive: noop, markApprovedSeen: noop, savePriority: noop, removePriority: noop,
}

const VIEWS = { self: selfReviewSample, review: managerReviewSample, agree: agreeSample, approval: approvalSample } as const

/** Human Resources draws every review page inside its colours (app/(app)/human-resources/layout.tsx). */
const Colours = ({ children }: { children: React.ReactNode }) => <div className="contents" style={APR_COLORS}>{children}</div>

export function ReviewCardPicture({ state }: { state: 'progress' | 'agree' }) {
  return <ReviewCard c={reviewCardSample(state)} />
}

export function ReviewPagePicture({ step }: { step: keyof typeof VIEWS }) {
  return <Colours><ReviewPage v={VIEWS[step]()} api={API} booking={null} drawerApi={null} today={REVIEW_TODAY} /></Colours>
}

/** "Your 2026 goals: how they went", as Alex marks them. */
export function PastGoalsPicture() {
  const past = pastGoalsSample()
  return (
    <Colours>
      <Section id="past" title="Your 2026 goals: how they went" sub="The goals you agreed for 2026 in your 2025 review. Mark how each one went and say why in a sentence.">
        <div className="flex flex-col">{past.map(g => <PastGoal key={g.id} g={g} year={2026} editable api={API} onSaved={none} onError={none} />)}</div>
      </Section>
    </Colours>
  )
}

/** The Company Priorities and "Your goals for 2027", as Alex writes them. */
export function GoalsPicture() {
  return (
    <Colours>
      <div className="flex flex-col gap-4">
        <PriorityBlock id="pri" label="Priorities for 2027" items={prioritiesSample()} showGoals open onToggle={none} />
        <Section id="goals" title="Your goals for 2027" sub="One item each: what, how it is measured, by when (month and year), the term, and which of the priorities above it serves.">
          <GoalList goals={goalsSample().slice(0, 1)} priorities={prioritiesSample()} api={API} editable mode="person" who="Alex Rivera"
            onSaved={none} onError={none} onChanged={none} editingId={null} setEditingId={none} />
        </Section>
      </div>
    </Colours>
  )
}

export function HistoryRowsPicture() {
  return <Colours><ReviewHistory rows={historySample()} intro="Only you, the person you report to and HR see these." /></Colours>
}

export function MyGoalsPicture() {
  return <Colours><MyGoals v={myGoalsSample()} api={{ updateGoal: noop }} /></Colours>
}

export function TeamGoalsPicture() {
  return <Colours><TeamGoals rows={teamGoalsSample()} /></Colours>
}

const LIST_API = { startCycle: noop, moveDatesUp: noop, saveReviewDates: noop, approveAll: noop, remindNow: noop }

export function ReviewListPicture() {
  return (
    <Colours>
      <ReviewList year={2026} years={[2026, 2025]} intro="Annual performance reviews. The 2026 reviews started on Mon, Nov 9; everything is due by Tue, Dec 15."
        rows={reviewListSample()} imports={null} canPriorities kickoff={null} progress={progressSample()} dates={null} approvals={null} api={LIST_API} />
    </Colours>
  )
}

export function StartCyclePicture() {
  return (
    <Colours>
      <ReviewList year={2026} years={[2026, 2025]} intro="The 2026 reviews have not started." rows={[]} imports={null} canPriorities
        kickoff={kickoffSample()} progress={null} dates={null} approvals={null} api={LIST_API} />
    </Colours>
  )
}

export function PrioritiesPicture() {
  const p = prioritiesPageSample()
  return (
    <Colours>
      <PrioritiesPage cycleId={1} year={2026} intro="The CISO writes the Company Priorities, the VP of Operations adds theirs, and each Team Leader writes their team's first thing in their self-review. Every review shows the Company Priorities and the VP's; a person also sees their own team's."
        notice="The 2026 reviews started Mon, Nov 9. The goals for 2027 open in every self-review when both are marked ready, or after Fri, Nov 13." blocks={p.blocks} teams={p.teams} noLeader={['Graphics']} log={[]}
        api={{ savePriority: noop, removePriority: noop, markPrioritiesReady: noop }} />
    </Colours>
  )
}
