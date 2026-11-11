import { describe, expect, it } from 'vitest'
import {
  addDays, cardShows, cardState, checkinsOpenOn, dueOf, dueWords, matchFile, monthEnd, monthLabel, nameInFile, participants, pdfName,
  reminderToday, reviewerFor, rolesFromTitles, decidesTeam, secondReviewerFor, statusSummary, stepBack, takesPart, waitsFor,
  type RosterMembership, type RosterPerson,
} from './rules'

const person = (id: string, over: Partial<RosterPerson> = {}): RosterPerson => ({
  id, name: id.toUpperCase(), active: true, employmentType: 'us', managerId: null, title: null, hireDate: null, ...over,
})

describe('who decides a team\'s priorities', () => {
  const members: RosterMembership[] = [{ personId: 'vp', teamId: 'ops', position: 'lead', isPrimary: true }, { personId: 'x', teamId: 'web', position: 'lead', isPrimary: true }]
  it('lets the VP or the CISO decide, but never for a team they lead', () => {
    expect(decidesTeam('vp', true, 'web', members)).toBe(true)
    expect(decidesTeam('vp', true, 'ops', members)).toBe(false)
    expect(decidesTeam('x', false, 'ops', members)).toBe(false)
  })
  it('gives a team both of them lead to the CISO', () => {
    const both: RosterMembership[] = [{ personId: 'vp', teamId: 'lead', position: 'lead', isPrimary: true }, { personId: 'ciso', teamId: 'lead', position: 'lead', isPrimary: true }, { personId: 'ciso', teamId: 'sec', position: 'lead', isPrimary: false }]
    const roles = { vpId: 'vp', cisoId: 'ciso' }
    expect(decidesTeam('ciso', true, 'lead', both, roles)).toBe(true)
    expect(decidesTeam('vp', true, 'lead', both, roles)).toBe(false)
    // A team only the CISO leads is still the VP's.
    expect(decidesTeam('ciso', true, 'sec', both, roles)).toBe(false)
    expect(decidesTeam('vp', true, 'sec', both, roles)).toBe(true)
  })
})

describe('roles from the Directory', () => {
  const none = { vpId: null, cisoId: null, hrId: null }
  it('reads each role from one active title, and keeps a role picked by hand', () => {
    const people = [person('a', { title: 'VPO' }), person('d', { title: 'CISO - Chief Innovation & Strategy Officer' }), person('t', { title: 'Executive Assistant' })]
    expect(rolesFromTitles(people, none)).toEqual({ vpId: 'a', cisoId: 'd', hrId: null })
    expect(rolesFromTitles(people, { ...none, vpId: 'x', hrId: 't' })).toEqual({ vpId: 'x', cisoId: 'd', hrId: 't' })
  })
  it('leaves a role empty when two titles name it or the person left', () => {
    expect(rolesFromTitles([person('a', { title: 'HR Manager' }), person('b', { title: 'Human Resources' })], none).hrId).toBeNull()
    expect(rolesFromTitles([person('a', { title: 'CISO', active: false })], none).cisoId).toBeNull()
    expect(rolesFromTitles([person('a', { title: 'Chris Lead' })], none).hrId).toBeNull()
  })
})

describe('who takes part', () => {
  it('takes every active employee, and a contractor only when added', () => {
    expect(takesPart(person('a'), new Set())).toBe(true)
    expect(takesPart(person('a', { employmentType: 'contractor' }), new Set())).toBe(false)
    expect(takesPart(person('a', { employmentType: 'contractor' }), new Set(['a']))).toBe(true)
    expect(takesPart(person('a', { active: false }), new Set(['a']))).toBe(false)
  })
})

describe('who reviews', () => {
  const roles = { vpId: 'vp', cisoId: 'ciso', hrId: 'hr' }
  it('is the CISO for the VP, nobody for the CISO, else the Team Leader, then Reports to', () => {
    expect(reviewerFor('amy', 'laura', 'vp', roles)).toBe('laura')
    expect(reviewerFor('laura', null, 'vp', roles)).toBe('vp')
    expect(reviewerFor('vp', null, null, roles)).toBe('ciso')
    expect(reviewerFor('ciso', null, null, roles)).toBeNull()
    // The CISO reviews the VP even when the VP has a Team Leader or reports to someone.
    expect(reviewerFor('vp', 'laura', 'x', roles)).toBe('ciso')
    expect(reviewerFor('ciso', 'laura', 'vp', roles)).toBeNull()
    expect(reviewerFor('x', null, null, roles)).toBeNull()
    expect(reviewerFor('x', 'x', 'x', roles)).toBeNull()
  })

  it('puts Team Leaders and people with no Team Leader in phase 1', () => {
    const people = [person('amy', { managerId: 'laura' }), person('laura', { managerId: 'vp' }), person('vp'), person('marcus', { managerId: 'vp' })]
    const members: RosterMembership[] = [
      { personId: 'amy', teamId: 'w', position: 'member', isPrimary: true },
      { personId: 'laura', teamId: 'w', position: 'lead', isPrimary: true },
      { personId: 'marcus', teamId: 'ops', position: 'member', isPrimary: true },
    ]
    const teams = [{ id: 'w', name: 'Writing Team' }, { id: 'ops', name: 'Operations' }]
    const got = new Map(participants(people, members, teams, roles, new Set()).map(p => [p.personId, p]))
    expect(got.get('amy')).toMatchObject({ teamLeaderId: 'laura', reviewerId: 'laura', phase: 2, teamId: 'w' })
    expect(got.get('laura')).toMatchObject({ teamLeaderId: null, reviewerId: 'vp', phase: 1, leads: ['w'] })
    expect(got.get('marcus')).toMatchObject({ teamLeaderId: null, reviewerId: 'vp', phase: 1 })
    expect(got.get('vp')).toMatchObject({ reviewerId: 'ciso', phase: 1 })
    expect(got.get('amy')).toMatchObject({ area: 'Writing Team', secondReviewerId: null })
  })
})

describe('two reviewers', () => {
  // Kathleen leads Social Media and works in SEO under Jeannette; she reports to Arnaldo (owner, 10 November 2026).
  const roles = { vpId: 'vp', cisoId: 'ciso', hrId: null }
  const members: RosterMembership[] = [
    { personId: 'kathleen', teamId: 'social', position: 'lead', isPrimary: true },
    { personId: 'kathleen', teamId: 'seo', position: 'member', isPrimary: false },
    { personId: 'jeannette', teamId: 'seo', position: 'lead', isPrimary: true },
    { personId: 'cheyenne', teamId: 'writers', position: 'member', isPrimary: true },
    { personId: 'cheyenne', teamId: 'seo', position: 'member', isPrimary: false },
    { personId: 'vp', teamId: 'ops', position: 'lead', isPrimary: true },
    { personId: 'vp', teamId: 'seo', position: 'member', isPrimary: false },
  ]
  const teams = new Map([['social', { id: 'social', name: 'Social Media' }], ['seo', { id: 'seo', name: 'SEO' }], ['writers', { id: 'writers', name: 'Writers' }], ['ops', { id: 'ops', name: 'Operations' }]])
  const active = new Set(['kathleen', 'jeannette', 'cheyenne', 'vp', 'arnaldo'])

  it('gives a Team Leader who works in another team that team\'s leader as a second reviewer', () => {
    expect(secondReviewerFor('kathleen', 'arnaldo', members, teams, roles, active)).toEqual({ reviewerId: 'jeannette', area: 'SEO' })
  })
  it('gives none to a plain member of two teams, to the VP and the CISO, or when it is the first reviewer again', () => {
    expect(secondReviewerFor('cheyenne', 'x', members, teams, roles, active)).toBeNull()
    expect(secondReviewerFor('vp', 'ciso', members, teams, roles, active)).toBeNull()
    expect(secondReviewerFor('kathleen', 'jeannette', members, teams, roles, active)).toBeNull()
  })
  it('follows a choice made by hand', () => {
    expect(secondReviewerFor('kathleen', 'arnaldo', members, teams, roles, active, { kathleen: false })).toBeNull()
    expect(secondReviewerFor('cheyenne', 'x', members, teams, roles, active, { cheyenne: { reviewerId: 'jeannette', area: 'SEO' } })).toEqual({ reviewerId: 'jeannette', area: 'SEO' })
    // Someone who left is never a reviewer.
    expect(secondReviewerFor('cheyenne', 'x', members, teams, roles, active, { cheyenne: { reviewerId: 'gone', area: 'SEO' } })).toBeNull()
  })
  it('puts the second reviewer on the participant', () => {
    const people = [person('kathleen', { managerId: 'arnaldo' }), person('jeannette', { managerId: 'arnaldo' }), person('arnaldo')]
    const got = participants(people, members, [...teams.values()], roles, new Set()).find(p => p.personId === 'kathleen')
    expect(got).toMatchObject({ reviewerId: 'arnaldo', phase: 1, area: 'Social Media', secondReviewerId: 'jeannette', secondArea: 'SEO' })
  })
})

describe('steps', () => {
  it('goes back one step only from review, meeting and approval', () => {
    expect(stepBack('review')).toBe('self')
    expect(stepBack('meeting')).toBe('review')
    expect(stepBack('approval')).toBe('meeting')
    expect(stepBack('self')).toBeNull()
    expect(stepBack('approved')).toBeNull()
  })

  it('takes the phase 1 date for Team Leaders in a year from before the new workflow', () => {
    const d = { leaders_open_on: '2026-11-09', leaders_due: '2026-11-15', teams_open_by: '2026-11-16', self_due: '2026-11-30', review_due: '2026-12-04', meeting_due: '2026-12-18', approval_due: '2026-12-23', checkins_by: '2027-06-30' }
    expect(dueOf('self', 1, d)).toBe('2026-11-15')
    expect(dueOf('self', 2, d)).toBe('2026-11-30')
    expect(dueOf('approval', 2, d)).toBe('2026-12-23')
    expect(dueOf('approval', 1, d)).toBe('2026-12-23')
    expect(dueOf('approved', 2, d)).toBeNull()
  })

  it('gives each lane its own meeting and approval date', () => {
    const d = { leaders_open_on: '2026-11-09', leaders_due: null, teams_open_by: null, self_due: '2026-11-20', review_due: '2026-11-25', meeting_due: '2026-12-09', approval_due: '2026-12-15', checkins_by: '2027-05-10', leaders_meeting_due: '2026-12-04', leaders_approval_due: '2026-12-11' }
    expect(dueOf('self', 1, d)).toBe('2026-11-20')
    expect(dueOf('meeting', 1, d)).toBe('2026-12-04')
    expect(dueOf('meeting', 2, d)).toBe('2026-12-09')
    expect(dueOf('approval', 1, d)).toBe('2026-12-11')
    expect(dueOf('approval', 2, d)).toBe('2026-12-15')
  })

  it('waits for the person to agree once the meeting is over', () => {
    const now = new Date('2026-12-14T16:00:00Z')
    const base = { personId: 'amy', reviewerId: 'laura', agreedAt: null }
    expect(waitsFor({ ...base, step: 'meeting', meetingEndsAt: null }, now)).toBe('laura')
    expect(waitsFor({ ...base, step: 'meeting', meetingEndsAt: '2026-12-14T15:45:00Z' }, now)).toBe('amy')
    expect(waitsFor({ ...base, step: 'self', meetingEndsAt: null }, now)).toBe('amy')
    expect(waitsFor({ ...base, step: 'approved', meetingEndsAt: null }, now)).toBeNull()
  })

})

describe('days', () => {
  it('words a due date', () => {
    expect(dueWords('2026-11-30', '2026-11-26')).toBe('4 days left')
    expect(dueWords('2026-11-30', '2026-11-29')).toBe('tomorrow')
    expect(dueWords('2026-11-30', '2026-11-30')).toBe('today')
    expect(dueWords('2026-11-30', '2026-12-02')).toBe('2 days late')
  })

  it('reminds 3 days before, the day before and on the day', () => {
    expect(reminderToday('2026-11-30', '2026-11-23')).toBeNull()
    expect(reminderToday('2026-11-30', '2026-11-27')).toBe(3)
    expect(reminderToday('2026-11-30', '2026-11-29')).toBe(1)
    expect(reminderToday('2026-11-30', '2026-11-30')).toBe(0)
    expect(reminderToday('2026-11-30', '2026-11-28')).toBeNull()
    expect(reminderToday(null, '2026-11-28')).toBeNull()
  })

  it('works out month ends and the check-in opening', () => {
    expect(monthEnd('2027-05-01')).toBe('2027-05-31')
    expect(monthEnd('2028-02-01')).toBe('2028-02-29')
    expect(checkinsOpenOn('2027-06-30')).toBe('2027-05-30')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(monthLabel('2027-07-01')).toBe('July 2027')
  })
})

describe('goals', () => {
  it('sums the statuses in the design order', () => {
    expect(statusSummary(['not_started', 'on_track', 'done', 'at_risk'])).toBe('1 on track · 1 at risk · 1 done · 1 not started')
    expect(statusSummary(['on_track', 'on_track'])).toBe('2 on track')
  })
})

describe('the card', () => {
  const now = new Date('2026-11-26T15:00:00Z')
  const base = { answered: 0, goals: 0, due: '2026-11-30', meetingStartsAt: null, meetingEndsAt: null, agreedAt: null }
  it('reads each state', () => {
    expect(cardState({ ...base, step: 'waiting' }, '2026-11-26', now)).toBe('soon')
    expect(cardState({ ...base, step: 'self' }, '2026-11-26', now)).toBe('open')
    expect(cardState({ ...base, step: 'self', answered: 7 }, '2026-11-26', now)).toBe('progress')
    expect(cardState({ ...base, step: 'self' }, '2026-12-02', now)).toBe('late')
    expect(cardState({ ...base, step: 'review' }, '2026-11-26', now)).toBe('with_reviewer')
    expect(cardState({ ...base, step: 'meeting', meetingStartsAt: '2026-12-14T15:00:00Z', meetingEndsAt: '2026-12-14T15:45:00Z' }, '2026-11-26', now)).toBe('booked')
    expect(cardState({ ...base, step: 'meeting', meetingStartsAt: '2026-11-26T13:00:00Z', meetingEndsAt: '2026-11-26T13:45:00Z' }, '2026-11-26', now)).toBe('agree')
    expect(cardState({ ...base, step: 'approved' }, '2026-11-26', now)).toBe('approved')
  })
  it('stays 30 days after approval', () => {
    expect(cardShows({ step: 'approved', approvedAt: '2026-12-18T14:00:00Z' }, '2027-01-17')).toBe(true)
    expect(cardShows({ step: 'approved', approvedAt: '2026-12-18T14:00:00Z' }, '2027-01-18')).toBe(false)
    expect(cardShows({ step: 'self', approvedAt: null }, '2027-01-18')).toBe(true)
  })
})

describe("last year's files", () => {
  const people = [{ id: 'amy', name: 'Amy Prindle', active: true }, { id: 'grace', name: 'Grace Hill', active: true }, { id: 'paul', name: 'Paul Grant', active: false }]
  it('matches by the name in the file', () => {
    expect(nameInFile('2025.11 - Amy Prindle.pdf')).toBe('Amy Prindle')
    expect(matchFile('2025.11 - Amy Prindle.pdf', people)).toEqual({ personId: 'amy', match: 'matched' })
    expect(matchFile('2025.11 - Gracie Hill.pdf', people)).toEqual({ personId: 'grace', match: 'check' })
    expect(matchFile('2025 review - Marcus.docx', people)).toEqual({ personId: null, match: 'none' })
    expect(matchFile('2025.11 - Paul Grant.pdf', people)).toEqual({ personId: 'paul', match: 'skipped' })
    expect(matchFile('notes.pdf', people)).toEqual({ personId: null, match: 'none' })
  })
  it('names the approved PDF', () => {
    expect(pdfName(2026, '11', 'Amy Prindle')).toBe('2026.11 - Amy Prindle.pdf')
  })
})
