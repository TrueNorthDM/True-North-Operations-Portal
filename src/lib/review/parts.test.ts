import { describe, expect, it } from 'vitest'
import { everyPartApproved, firstPartStep, partBack, partsOf, partWaitsFor, type PartRow } from './parts'

const review = (over: Partial<Parameters<typeof partsOf>[0]> = {}) => ({
  id: 1, person_id: 'kathleen', reviewer_id: 'arnaldo', phase: 1 as const, step: 'review' as const,
  review_sent_at: null, meeting_event_id: null, meeting_starts_at: null, meeting_ends_at: null, meeting_notes: '',
  agreed_at: null, approved_at: null, approved_by: null, sent_back_at: null, sent_back_by: null, sent_back_reason: null, sent_back_from: null, ...over,
})
const second = (over: Partial<PartRow> = {}): PartRow => ({
  id: 9, review_id: 1, part: 1, reviewer_id: 'jeannette', area: 'SEO', step: 'review', review_sent_at: null, meeting_event_id: null, meeting_starts_at: null,
  meeting_ends_at: null, meeting_notes: '', agreed_at: null, approved_at: null, approved_by: null, sent_back_at: null, sent_back_by: null, sent_back_reason: null,
  sent_back_from: null, updated_at: '2026-11-20T00:00:00Z', ...over,
})

describe('the parts of a review', () => {
  it('reads the first part from the review row, the second from its own row', () => {
    const parts = partsOf(review(), [second()], 'Social Media')
    expect(parts.map(p => [p.no, p.reviewerId, p.area, p.lane, p.step])).toEqual([[0, 'arnaldo', 'Social Media', 1, 'review'], [1, 'jeannette', 'SEO', 2, 'review']])
    // With one reviewer the part is not named after a team.
    expect(partsOf(review(), [], 'Social Media')[0].area).toBe('')
  })
  it('keeps the first part waiting during the self-review, and approved once its approval is stamped', () => {
    expect(firstPartStep({ step: 'self', approved_at: null })).toBe('waiting')
    expect(firstPartStep({ step: 'approval', approved_at: null })).toBe('approval')
    expect(firstPartStep({ step: 'approval', approved_at: '2026-12-10T15:00:00Z' })).toBe('approved')
  })
  it('is approved only when every part is', () => {
    const half = partsOf(review({ step: 'approval', approved_at: '2026-12-10T15:00:00Z' }), [second({ step: 'approval' })])
    expect(everyPartApproved(half)).toBe(false)
    const all = partsOf(review({ step: 'approval', approved_at: '2026-12-10T15:00:00Z' }), [second({ step: 'approved' })])
    expect(everyPartApproved(all)).toBe(true)
  })
  it('waits for the reviewer, then for the person after the meeting', () => {
    const now = new Date('2026-12-04T16:00:00Z')
    const p = partsOf(review({ step: 'meeting', meeting_starts_at: '2026-12-04T15:00:00Z', meeting_ends_at: '2026-12-04T15:45:00Z' }), [])[0]
    expect(partWaitsFor(p, 'kathleen', now)).toBe('kathleen')
    expect(partWaitsFor({ ...p, meetingEndsAt: '2026-12-05T15:45:00Z' }, 'kathleen', now)).toBe('arnaldo')
    expect(partWaitsFor({ ...p, step: 'approval' }, 'kathleen', now)).toBe('arnaldo')
    expect(partWaitsFor({ ...p, step: 'approved' }, 'kathleen', now)).toBeNull()
  })
  it('goes back one step, from the review to the self-review', () => {
    expect(partBack('review')).toBe('self')
    expect(partBack('meeting')).toBe('review')
    expect(partBack('approval')).toBe('meeting')
    expect(partBack('approved')).toBeNull()
  })
})
