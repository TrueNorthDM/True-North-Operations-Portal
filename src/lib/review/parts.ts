/**
 * A review's parts (two reviewers, owner, 10 November 2026). Every review has
 * the person's self-review and one part per reviewer: the reviewer's
 * feedback, the meeting, the read-and-agree and the approval.
 *
 * Part 0 is the first reviewer's and lives on the review row itself, as it
 * always did (most reviews have one reviewer and nothing about them changed).
 * Part 1, the second reviewer's, is a review_parts row (migration 164). The
 * review row's step is the person's self-review until it is sent, then the
 * first reviewer's part; a first part approved while the second is not keeps
 * the review at "approval" with approved_at set, and the review is approved
 * (step "approved") only when every part is.
 *
 * Pure: the shapes and the rules. The writes are in the actions.
 */

import type { Step } from './rules'

export type PartStep = 'waiting' | 'review' | 'meeting' | 'approval' | 'approved'
export type PartNo = 0 | 1

/** A review_parts row. */
export interface PartRow {
  id: number; review_id: number; part: 1; reviewer_id: string | null; area: string; step: PartStep
  review_sent_at: string | null; meeting_event_id: string | null; meeting_starts_at: string | null; meeting_ends_at: string | null; meeting_notes: string
  agreed_at: string | null; approved_at: string | null; approved_by: string | null
  sent_back_at: string | null; sent_back_by: string | null; sent_back_reason: string | null; sent_back_from: string | null
  updated_at: string
}

/** The review row's fields a part reads (ReviewRow has them all). */
export interface ReviewPartFields {
  id: number; person_id: string; reviewer_id: string | null; phase: 1 | 2; step: Step
  review_sent_at: string | null; meeting_event_id: string | null; meeting_starts_at: string | null; meeting_ends_at: string | null; meeting_notes: string
  agreed_at: string | null; approved_at: string | null; approved_by: string | null
  sent_back_at: string | null; sent_back_by: string | null; sent_back_reason: string | null; sent_back_from: string | null
}

export interface Part {
  no: PartNo
  reviewerId: string | null
  /** What this reviewer reviews them for: "Social Media", "SEO". Empty with one reviewer. */
  area: string
  /** 1 the leaders' lane, 2 the teams' (the due dates). A second reviewer is always a Team Leader. */
  lane: 1 | 2
  step: PartStep
  reviewSentAt: string | null
  meetingEventId: string | null; meetingStartsAt: string | null; meetingEndsAt: string | null; meetingNotes: string
  agreedAt: string | null; approvedAt: string | null; approvedBy: string | null
  sentBack: { at: string; by: string | null; reason: string; from: string | null } | null
}

/** The first part's step, from the review row. */
export function firstPartStep(r: Pick<ReviewPartFields, 'step' | 'approved_at'>): PartStep {
  if (r.step === 'waiting' || r.step === 'self') return 'waiting'
  if (r.step === 'approval' && r.approved_at) return 'approved'
  return r.step
}

const sentBack = (at: string | null, by: string | null, reason: string | null, from: string | null) => (at && reason ? { at, by, reason, from } : null)

/** Every part of a review, the first one first. */
export function partsOf(r: ReviewPartFields, extra: PartRow[], firstArea = ''): Part[] {
  const out: Part[] = [{
    no: 0, reviewerId: r.reviewer_id, area: extra.length ? firstArea : '', lane: r.phase, step: firstPartStep(r),
    reviewSentAt: r.review_sent_at, meetingEventId: r.meeting_event_id, meetingStartsAt: r.meeting_starts_at, meetingEndsAt: r.meeting_ends_at, meetingNotes: r.meeting_notes,
    agreedAt: r.agreed_at, approvedAt: r.approved_at, approvedBy: r.approved_by,
    sentBack: sentBack(r.sent_back_at, r.sent_back_by, r.sent_back_reason, r.sent_back_from),
  }]
  for (const x of extra.filter(e => e.review_id === r.id).sort((a, b) => a.part - b.part)) {
    out.push({
      no: 1, reviewerId: x.reviewer_id, area: x.area, lane: 2, step: x.step,
      reviewSentAt: x.review_sent_at, meetingEventId: x.meeting_event_id, meetingStartsAt: x.meeting_starts_at, meetingEndsAt: x.meeting_ends_at, meetingNotes: x.meeting_notes,
      agreedAt: x.agreed_at, approvedAt: x.approved_at, approvedBy: x.approved_by,
      sentBack: sentBack(x.sent_back_at, x.sent_back_by, x.sent_back_reason, x.sent_back_from),
    })
  }
  return out
}

/** Who a part waits for: the reviewer reviews, books and approves; the person agrees after the meeting. */
export function partWaitsFor(p: Pick<Part, 'step' | 'reviewerId' | 'meetingEndsAt' | 'agreedAt'>, personId: string, now: Date): string | null {
  switch (p.step) {
    case 'review': return p.reviewerId
    case 'meeting': return p.meetingEndsAt && new Date(p.meetingEndsAt) <= now && !p.agreedAt ? personId : p.reviewerId
    case 'approval': return p.reviewerId
    default: return null
  }
}

/** The part back one step, with a reason: from the review to the self-review, from the meeting to the review, from approval to the meeting. */
export function partBack(step: PartStep): PartStep | 'self' | null {
  return step === 'review' ? 'self' : step === 'meeting' ? 'review' : step === 'approval' ? 'meeting' : null
}

/** The review is approved when every part is. */
export const everyPartApproved = (parts: Pick<Part, 'step'>[]) => parts.length > 0 && parts.every(p => p.step === 'approved')

/** The parts of a review this person reviews. */
export const partsFor = (parts: Part[], personId: string | null) => (personId ? parts.filter(p => p.reviewerId === personId) : [])
