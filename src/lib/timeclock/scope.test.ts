import { describe, it, expect } from 'vitest'
import { canAs } from '@/lib/access/simulate'
import type { AccessLevel } from '@/lib/access/catalogue'
import {
  SHORTEN_ONLY, canAddFor, canApproveCorrection, canClockOutFor, canDecideTimeOff, canReopen, canSeeWorking, canView,
  changeRight, isLeader, onlyShorter, periodsAccess, safetyAccess, whoChoice, type ScopeTarget, type ScopeViewer,
} from './scope'

// README "Who sees what", with the access catalogue's starting answers (no
// rule changed on Admin > Access levels): the four levels, a Team Leader of
// the Web team, and people on Web and on SEO.

const WEB = 'team-web'
const SEO = 'team-seo'

function viewer(level: AccessLevel, personId: string, leads: string[] = [], member: string[] = []): ScopeViewer {
  const teams: [string, boolean][] = [...leads.map(t => [t, true] as [string, boolean]), ...member.map(t => [t, false] as [string, boolean])]
  return { personId, can: canAs(level, { teams }), isSuperAdmin: level === 'super_admin', ledTeamIds: new Set(leads) }
}

const superAdmin = viewer('super_admin', 'arnaldo')
const admin = viewer('admin', 'dave')
const lead = viewer('team_leader', 'wendy', [WEB])
const user = viewer('user', 'samuel', [], [WEB])

const wendy: ScopeTarget = { personId: 'wendy', teamIds: [WEB] }
const samuel: ScopeTarget = { personId: 'samuel', teamIds: [WEB] }
const saheed: ScopeTarget = { personId: 'saheed', teamIds: [SEO] }
const arnaldo: ScopeTarget = { personId: 'arnaldo', teamIds: [] }

describe('Time entries: whose hours each level sees', () => {
  it('Super Admin and Admin: their own and everyone', () => {
    for (const v of [superAdmin, admin]) {
      expect(canView(v, samuel)).toBe(true)
      expect(canView(v, saheed)).toBe(true)
      expect(whoChoice(v)).toBe('all')
    }
  })

  it('Team Leader: their own and their team only ("My | My team")', () => {
    expect(canView(lead, wendy)).toBe(true)
    expect(canView(lead, samuel)).toBe(true)
    expect(canView(lead, saheed)).toBe(false)
    expect(whoChoice(lead)).toBe('team')
  })

  it('User: their own only, with no "My | All"', () => {
    expect(canView(user, samuel)).toBe(true)
    expect(canView(user, wendy)).toBe(false)
    expect(canView(user, saheed)).toBe(false)
    expect(whoChoice(user)).toBeNull()
  })
})

describe('changing hours', () => {
  it('Super Admin and Admin change anything, for anyone', () => {
    for (const v of [superAdmin, admin]) {
      expect(changeRight(v, saheed)).toBe('full')
      expect(changeRight(v, { personId: v.personId, teamIds: [] })).toBe('full')
      expect(canAddFor(v, saheed)).toBe(true)
    }
  })

  it('Team Leader changes anything for their team, themselves included, and nothing outside it', () => {
    expect(changeRight(lead, samuel)).toBe('full')
    expect(changeRight(lead, wendy)).toBe('full')
    expect(changeRight(lead, saheed)).toBe('none')
    expect(canAddFor(lead, samuel)).toBe(true)
    expect(canAddFor(lead, saheed)).toBe(false)
    expect(isLeader(lead)).toBe(true)
  })

  it('User only shortens their own entries, and never adds time', () => {
    expect(changeRight(user, samuel)).toBe('shorten')
    expect(changeRight(user, wendy)).toBe('none')
    expect(canAddFor(user, samuel)).toBe(false)
    expect(isLeader(user)).toBe(false)
  })
})

describe('shorten only (3E)', () => {
  const was = { start: '2026-10-15T12:00:00Z', end: '2026-10-15T17:00:00Z', seconds: 5 * 3600 }

  it('lets the start move later and the end earlier', () => {
    expect(onlyShorter(was, { start: '2026-10-15T12:15:00Z', end: '2026-10-15T16:00:00Z', seconds: 3.75 * 3600 })).toBe(true)
    expect(onlyShorter(was, was)).toBe(true)
  })

  it('refuses an earlier start, a later end, or a change of kind', () => {
    expect(onlyShorter(was, { start: '2026-10-15T11:45:00Z', end: was.end, seconds: 0 })).toBe(false)
    expect(onlyShorter(was, { start: was.start, end: '2026-10-15T17:15:00Z', seconds: 0 })).toBe(false)
    expect(onlyShorter(was, { start: null, end: null, seconds: 3600 })).toBe(false)
  })

  it('keeps a duration-only entry to a shorter duration, and a running entry running', () => {
    expect(onlyShorter({ start: null, end: null, seconds: 7200 }, { start: null, end: null, seconds: 3600 })).toBe(true)
    expect(onlyShorter({ start: null, end: null, seconds: 7200 }, { start: null, end: null, seconds: 9000 })).toBe(false)
    const running = { start: '2026-10-15T12:00:00Z', end: null, seconds: 0 }
    expect(onlyShorter(running, { start: '2026-10-15T12:30:00Z', end: null, seconds: 0 })).toBe(true)
    expect(onlyShorter(running, { start: '2026-10-15T12:30:00Z', end: '2026-10-15T13:00:00Z', seconds: 0 })).toBe(false)
  })

  it('says so in the words of the design', () => {
    expect(SHORTEN_ONLY).toBe('You can shorten this entry, not lengthen it. To add time, ask your Team Leader.')
  })
})

describe('who approves a time correction', () => {
  it('the person\'s Team Lead, an Admin or a Super Admin', () => {
    expect(canApproveCorrection(lead, samuel)).toBe(true)
    expect(canApproveCorrection(admin, samuel)).toBe(true)
    expect(canApproveCorrection(superAdmin, samuel)).toBe(true)
  })

  it('never the person, a User, or a Team Leader of another team', () => {
    expect(canApproveCorrection(user, samuel)).toBe(false)
    expect(canApproveCorrection(lead, wendy)).toBe(false)
    expect(canApproveCorrection(lead, saheed)).toBe(false)
    expect(canApproveCorrection(admin, { personId: 'dave', teamIds: [] })).toBe(false)
  })
})

describe('only Super Admins decide time off and reopen periods', () => {
  it('time off', () => {
    expect(canDecideTimeOff(superAdmin, samuel)).toBe(true)
    expect(canDecideTimeOff(superAdmin, arnaldo)).toBe(false)
    expect(canDecideTimeOff(admin, samuel)).toBe(false)
    expect(canDecideTimeOff(lead, samuel)).toBe(false)
  })

  it('reopening', () => {
    expect(canReopen(superAdmin)).toBe(true)
    expect(canReopen(admin)).toBe(false)
    expect(canReopen(lead)).toBe(false)
    expect(canReopen(user)).toBe(false)
  })
})

describe("Who's working, Clock safety and Timesheet periods", () => {
  it("Who's working: everyone for Admins, their team for a Team Leader, hidden for a User", () => {
    expect(canSeeWorking(admin, saheed)).toBe(true)
    expect(canSeeWorking(lead, samuel)).toBe(true)
    expect(canSeeWorking(lead, saheed)).toBe(false)
    expect(canSeeWorking(user, samuel)).toBe(false)
  })

  it('"Clock out for them" is a Super Admin\'s', () => {
    expect(canClockOutFor(superAdmin, samuel)).toBe(true)
    expect(canClockOutFor(admin, samuel)).toBe(false)
    expect(canClockOutFor(lead, samuel)).toBe(false)
  })

  it('Clock safety: full for a Super Admin, read only for an Admin, closed below', () => {
    expect(safetyAccess(superAdmin)).toBe('full')
    expect(safetyAccess(admin)).toBe('read')
    expect(safetyAccess(lead)).toBe('none')
    expect(safetyAccess(user)).toBe('none')
  })

  it('Timesheet periods: Super Admins change them, Admins read them', () => {
    expect(periodsAccess(superAdmin)).toBe('edit')
    expect(periodsAccess(admin)).toBe('read')
    expect(periodsAccess(lead)).toBe('none')
  })
})
