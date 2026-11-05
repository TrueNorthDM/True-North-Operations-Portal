import { describe, expect, it } from 'vitest'
import {
  addDays, cardShows, cardState, checkinsOpenOn, dueOf, dueWords, matchFile, monthEnd, monthLabel, nameInFile, participants, pdfName,
  reminderToday, reviewerFor, rolesFromTitles, decidesTeam, startRowShows, statusSummary, stepBack, takesPart, teamOpens, waitsFor,
  type RosterMembership, type RosterPerson,
} from './rules'

const person = (id: string, over: Partial<RosterPerson> = {}): RosterPerson => ({
  id, name: id.toUpperCase(), active: true, employmentType: 'us', managerId: null, title: null, hireDate: null, ...over,
})

describe('the start row in Needs you', () => {
  it('shows from a week before Team Leaders open until the cycle starts', () => {
    expect(startRowShows('2026-11-01', '2026-11-09', false)).toBe(false)
    expect(startRowShows('2026-11-02', '2026-11-09', false)).toBe(true)
    expect(startRowShows('2026-11-12', '2026-11-09', false)).toBe(true)
    expect(startRowShows('2026-11-04', '2026-11-09', true)).toBe(false)
    expect(startRowShows('2026-11-04', null, false)).toBe(false)
  })
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

  it('takes the phase 1 date for Team Leaders', () => {
    const d = { leaders_open_on: '2026-11-09', leaders_due: '2026-11-15', teams_open_by: '2026-11-16', self_due: '2026-11-30', review_due: '2026-12-04', meeting_due: '2026-12-18', approval_due: '2026-12-23', checkins_by: '2027-06-30' }
    expect(dueOf('self', 1, d)).toBe('2026-11-15')
    expect(dueOf('self', 2, d)).toBe('2026-11-30')
    expect(dueOf('approval', 2, d)).toBe('2026-12-23')
    expect(dueOf('approved', 2, d)).toBeNull()
  })

  it('waits for the person to agree once the meeting is over', () => {
    const now = new Date('2026-12-14T16:00:00Z')
    const base = { personId: 'amy', reviewerId: 'laura', agreedAt: null }
    expect(waitsFor({ ...base, step: 'meeting', meetingEndsAt: null }, now)).toBe('laura')
    expect(waitsFor({ ...base, step: 'meeting', meetingEndsAt: '2026-12-14T15:45:00Z' }, now)).toBe('amy')
    expect(waitsFor({ ...base, step: 'self', meetingEndsAt: null }, now)).toBe('amy')
    expect(waitsFor({ ...base, step: 'approved', meetingEndsAt: null }, now)).toBeNull()
  })

  it('opens a team on approval or on the date', () => {
    expect(teamOpens({ approved: true }, '2026-11-16', '2026-11-10')).toBe(true)
    expect(teamOpens(null, '2026-11-16', '2026-11-15')).toBe(false)
    expect(teamOpens(null, '2026-11-16', '2026-11-16')).toBe(true)
    expect(teamOpens(null, null, '2026-11-16')).toBe(false)
  })
})

describe('days', () => {
  it('words a due date', () => {
    expect(dueWords('2026-11-30', '2026-11-26')).toBe('4 days left')
    expect(dueWords('2026-11-30', '2026-11-29')).toBe('tomorrow')
    expect(dueWords('2026-11-30', '2026-11-30')).toBe('today')
    expect(dueWords('2026-11-30', '2026-12-02')).toBe('2 days late')
  })

  it('reminds 1 week, 3 days and on the day', () => {
    expect(reminderToday('2026-11-30', '2026-11-23')).toBe(7)
    expect(reminderToday('2026-11-30', '2026-11-27')).toBe(3)
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
