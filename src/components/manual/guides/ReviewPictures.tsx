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
  CYCLE, REVIEW_TODAY, agreeSample, approvalSample, goalsSample, historySample, managerReviewSample, myGoalsSample, pastGoalsSample,
  prioritiesPageSample, prioritiesSample, reviewCardSample, reviewListSample, selfReviewSample, startChecksSample, teamGoalsSample,
} from '@/lib/manual/samples/review'

const EXAMPLE = { ok: true as const, toast: 'This is an example.' }
const noop = async () => EXAMPLE
const none = () => {}

const API: ReviewApi = {
  saveGoal: noop, removeGoal: noop, saveAnswer: noop, copyJobDescription: noop, undoCopyJob: noop, addGoal: noop, markGoal: noop,
  submitSelf: noop, sendBack: noop, finishReview: noop, linkMeeting: noop, saveMeetingNotes: noop, agreeReview: noop, approveReview: noop,
  retryReviewDrive: noop, savePriority: noop, removePriority: noop, sendTeamPriorities: noop,
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
        <PriorityBlock id="pri" label="Company Priorities for 2027" items={prioritiesSample()} showGoals open onToggle={none} />
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

export function ReviewListPicture() {
  return (
    <Colours>
      <ReviewList year={2026} years={[2026, 2025]} intro="Annual performance reviews. The 2026 cycle opened on Mon, Nov 2; self-reviews are due Nov 30."
        rows={reviewListSample()} imports={null} canPriorities suggestions={1} start={null} />
    </Colours>
  )
}

export function StartCyclePicture() {
  return (
    <Colours>
      <ReviewList year={2026} years={[2026, 2025]} intro="The 2026 cycle has not started. Check what it needs, then start it." rows={[]} imports={null} canPriorities suggestions={0}
        start={{ checks: startChecksSample(), leaders: 3, noLeader: 1, teamsOpenBy: CYCLE.teams_open_by, canStart: true, canSettings: true, warn: null }} onStart={noop} />
    </Colours>
  )
}

export function PrioritiesPicture() {
  const p = prioritiesPageSample()
  return (
    <Colours>
      <PrioritiesPage cycleId={1} year={2026} intro="Step 0 of the review. The VP of Operations and the CISO write the whole-company priorities before the Team Leaders start. Each Team Leader writes their team's in their own self-review, and you approve them. A person sees the whole-company priorities and their own team's."
        notice="Team Leaders' self-reviews are open until Fri, Nov 13. A team's self-reviews open when you approve its priorities, or on Mon, Nov 16 at the latest." editors={['Chris Taylor', 'Priya Nair']} company={p.company} teams={p.teams} noLeader={['Graphics']} log={[]}
        api={{ savePriority: noop, removePriority: noop, approveTeamPriorities: noop, returnTeamPriorities: noop }} />
    </Colours>
  )
}
