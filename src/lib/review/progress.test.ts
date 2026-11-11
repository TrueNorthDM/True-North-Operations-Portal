import { describe, expect, it } from 'vitest'
import { computeCheckinProgress, computeProgress, type ProgressInput } from './progress'
import { planFrom } from './schedule'
import type { Part } from './parts'

const part = (no: 0 | 1, reviewer: string, lane: 1 | 2, step: Part['step'], meeting: string | null = null): Part & { reviewerName: string } => ({
  no, reviewerId: reviewer, reviewerName: reviewer, area: '', lane, step, reviewSentAt: null, meetingEventId: null, meetingStartsAt: meeting, meetingEndsAt: null, meetingNotes: '',
  agreedAt: null, approvedAt: null, approvedBy: null, sentBack: null,
})
const base = (today: string, over: Partial<ProgressInput> = {}): ProgressInput => ({
  today, now: new Date(`${today}T15:00:00Z`),
  cycle: { year: 2026, started_at: '2026-11-09T14:00:00Z', leaders_open_on: '2026-11-09', ...planFrom('2026-11-09'), company_done_at: '2026-11-10T00:00:00Z', vp_done_at: null },
  reviews: [
    { id: 1, personId: 'amy', name: 'Amy', step: 'self', selfSentAt: null, parts: [part(0, 'Lead', 2, 'waiting')] },
    { id: 2, personId: 'kathleen', name: 'Kathleen', step: 'review', selfSentAt: '2026-11-15T00:00:00Z', parts: [part(0, 'Arnaldo', 1, 'meeting', '2026-11-30T15:00:00Z'), part(1, 'Jeannette', 2, 'review')] },
  ],
  leaders: [{ personId: 'kathleen', name: 'Kathleen', reviewId: 2, teams: [{ id: 's', name: 'Social Media', written: 2 }] }],
  priorities: { company: 3, vp: 0 },
  fmt: d => d,
  ...over,
})

describe('the progress block', () => {
  it('counts each step, a second reviewer once more in the reviewers\' steps', () => {
    const p = computeProgress(base('2026-11-17'))
    const row = (k: string) => p.rows.find(r => r.key === k)!
    expect([row('company').done, row('vp').done]).toEqual([1, 0])
    expect([row('team').done, row('team').total]).toEqual([1, 1])
    expect([row('self').done, row('self').total]).toEqual([1, 2])
    // Three parts: Amy's, and Kathleen's two; only Arnaldo's meeting is booked.
    expect([row('review').done, row('review').total]).toEqual([1, 3])
    expect([row('meet1').total, row('meet2').total]).toEqual([1, 2])
  })
  it('marks the late, and the step under way', () => {
    const p = computeProgress(base('2026-11-23'))
    const self = p.rows.find(r => r.key === 'self')!
    expect(self.state).toBe('late')
    expect(self.items[0]).toMatchObject({ name: 'Amy', late: true, done: false })
    expect(p.lateCount).toBeGreaterThan(0)
    expect(p.rows.find(r => r.key === 'company')!.state).toBe('done')
  })
  it('offers to move the later dates up when a step is done before its date', () => {
    const p = computeProgress(base('2026-11-17', { reviews: [{ id: 2, personId: 'k', name: 'K', step: 'review', selfSentAt: '2026-11-15T00:00:00Z', parts: [part(0, 'A', 1, 'review')] }] }))
    expect(p.rows.find(r => r.key === 'self')!.moveUp).toBe(3)
    expect(p.rows.find(r => r.key === 'review')!.moveUp).toBeNull()
  })
  it('says the week and the share done', () => {
    const p = computeProgress(base('2026-11-17'))
    expect(p.week).toBe(2)
    expect(p.weeks).toBe(6)
    expect(p.pct).toBeGreaterThan(0)
    expect(p.pct).toBeLessThan(100)
  })
})

describe('the 6-month check-in block', () => {
  const items = [
    { reviewId: 1, personId: 'a', name: 'Amy', reviewer: 'Lead', area: '', part: 0 as const, booked: '2027-05-18T15:00:00Z', finished: null },
    { reviewId: 2, personId: 'k', name: 'Kathleen', reviewer: 'Arnaldo', area: 'Social Media', part: 0 as const, booked: null, finished: null },
    { reviewId: 2, personId: 'k', name: 'Kathleen', reviewer: 'Jeannette', area: 'SEO', part: 1 as const, booked: '2027-05-12T15:00:00Z', finished: '2027-05-12T16:00:00Z' },
  ]
  const cycle = { checkin_started_at: '2027-05-10T14:00:00Z', checkin_told_at: '2027-05-13T14:00:00Z', ck_priorities_due: '2027-05-14', ck_book_due: '2027-05-21', ck_done_due: '2027-06-04' }
  it('has four steps and counts each reviewer\'s part', () => {
    const p = computeCheckinProgress({ today: '2027-05-17', cycle, priorities: { total: 3, checked: 3 }, items, fmt: d => d })
    expect(p.rows.map(r => [r.key, r.done, r.total, r.state])).toEqual([
      ['ck-start', 1, 1, 'done'], ['ck-pri', 1, 1, 'done'], ['ck-book', 2, 3, 'now'], ['ck-done', 1, 3, 'now'],
    ])
    expect(p.rows[2].items[0]).toMatchObject({ name: 'Kathleen', reviewer: 'Arnaldo', done: false })
  })
  it('is late after the booking date', () => {
    const p = computeCheckinProgress({ today: '2027-05-24', cycle, priorities: { total: 3, checked: 3 }, items, fmt: d => d })
    expect(p.rows[2].state).toBe('late')
    expect(p.lateCount).toBe(1)
  })
})
