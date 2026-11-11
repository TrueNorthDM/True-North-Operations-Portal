import { describe, expect, it } from 'vitest'
import { checkinPlanFrom, goalsOpen, kickoffReminderDay, kickoffRowShows, moveUp, orderProblems, planFrom, sixMonthsAfter, workday } from './schedule'

describe('the calendar from the kickoff', () => {
  it('ends by Tue, Dec 15 with the kickoff on Mon, Nov 9, 2026', () => {
    expect(planFrom('2026-11-09')).toEqual({
      company_due: '2026-11-11', vp_due: '2026-11-13', self_due: '2026-11-20', review_due: '2026-11-25',
      leaders_meeting_due: '2026-12-04', meeting_due: '2026-12-09', leaders_approval_due: '2026-12-11', approval_due: '2026-12-15',
    })
  })
  it('moves a weekend date to the Monday after', () => {
    expect(workday('2026-11-14')).toBe('2026-11-16')
    expect(workday('2026-11-15')).toBe('2026-11-16')
    expect(workday('2026-11-16')).toBe('2026-11-16')
    // A kickoff on a Thursday: K+2 is a Saturday.
    expect(planFrom('2026-11-12').company_due).toBe('2026-11-16')
  })
  it('puts the check-in six months after the kickoff, on a weekday', () => {
    expect(sixMonthsAfter('2026-11-09')).toBe('2027-05-10')
    expect(sixMonthsAfter('2026-08-31')).toBe('2027-03-01')
    expect(sixMonthsAfter('2026-05-11')).toBe('2026-11-11')
  })
  it('plans the check-in from its start', () => {
    expect(checkinPlanFrom('2027-05-10')).toEqual({ ck_priorities_due: '2027-05-14', ck_book_due: '2027-05-21', ck_done_due: '2027-06-04' })
  })
})

describe('the kickoff reminder', () => {
  it('is the second Monday of November', () => {
    expect(kickoffReminderDay(2026)).toBe('2026-11-09')
    expect(kickoffReminderDay(2027)).toBe('2027-11-08')
    expect(kickoffReminderDay(2025)).toBe('2025-11-10')
  })
  it('shows from that day until the year is started', () => {
    expect(kickoffRowShows('2026-11-08', 2026, false)).toBe(false)
    expect(kickoffRowShows('2026-11-09', 2026, false)).toBe(true)
    expect(kickoffRowShows('2026-12-20', 2026, false)).toBe(true)
    expect(kickoffRowShows('2026-11-10', 2026, true)).toBe(false)
    expect(kickoffRowShows('2027-01-05', 2026, false)).toBe(false)
  })
})

describe('the dates rule', () => {
  const dates = planFrom('2026-11-09')
  it('brings the later dates up by the days a step finished early', () => {
    // Every self-review in on Tue, Nov 17: 3 days before Fri, Nov 20.
    const m = moveUp(dates, 'self_due', '2026-11-17')!
    expect(m.days).toBe(3)
    expect(m.patch.review_due).toBe('2026-11-23')
    expect(m.patch.approval_due).toBe('2026-12-14')
    expect(m.patch.company_due).toBeUndefined()
  })
  it('never moves anything when the step is on its date or late', () => {
    expect(moveUp(dates, 'self_due', '2026-11-20')).toBeNull()
    expect(moveUp(dates, 'self_due', '2026-11-24')).toBeNull()
    expect(moveUp(dates, 'approval_due', '2026-12-01')).toBeNull()
  })
  it('names the dates out of order', () => {
    const fmt = (d: string) => d.slice(5)
    expect(orderProblems(dates, fmt)).toEqual([])
    expect(orderProblems({ ...dates, review_due: '2026-11-18' }, fmt)).toEqual(['Review written and meeting booked (11-18) is before Self-review (11-20). Move one of them.'])
  })
})

describe('the goals for next year', () => {
  it('open when both priorities are ready, or after the VP date', () => {
    const c = { vp_due: '2026-11-13', company_done_at: null, vp_done_at: null }
    expect(goalsOpen(c, '2026-11-12')).toBe(false)
    expect(goalsOpen({ ...c, company_done_at: 'x' }, '2026-11-12')).toBe(false)
    expect(goalsOpen({ ...c, company_done_at: 'x', vp_done_at: 'y' }, '2026-11-12')).toBe(true)
    expect(goalsOpen(c, '2026-11-14')).toBe(true)
    expect(goalsOpen({ vp_due: null }, '2026-11-01')).toBe(true)
  })
})
