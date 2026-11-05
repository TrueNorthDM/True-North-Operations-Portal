/**
 * Who may see, change and approve whose hours in Clocky (design handoff of
 * 16 October 2026, README "Who sees what"; Team Leaders' own hours, owner, 25
 * October 2026):
 *
 *   Level        Time entries        Change hours
 *   Super Admin  own + everyone      anything, anyone, themselves too
 *   Admin        own + everyone      anything, anyone, themselves too
 *   Team Leader  own + own team      anything, own team and their own
 *   User         own only            anything on their own entries
 *
 * Everyone adds and changes their own hours (leadership, 4 November 2026,
 * David's answers to the rules: "we have always allowed people to adjust their
 * own timesheets... we run on trust"), as in TSheets. Every change still needs
 * a reason and stays in the entry's history, the allowance still applies, and
 * a sent timesheet is still locked. This replaces the 25 October rule that a
 * User or a Team Leader could only shorten their own entries, and Request to
 * add time is retired with it (owner, 5 November 2026); requests sent before
 * stay in the history, and one still pending can be decided (canApproveCorrection).
 *
 * A Team Leader is a person with the Lead position in a team; "own team" is
 * the people on the teams they lead. Only Super Admins reopen an approved
 * timesheet (ck-reopen). Who decides each approval is the routing
 * (routing.ts, Company settings > Invoices, Who approves what), not here.
 *
 * The levels are the access catalogue's starting answers (lib/access/
 * catalogue.ts, module Clocky), so a Super Admin can still move a tick on
 * Admin > Access levels, as everywhere else in the portal:
 *
 *   clocky-hours       Time entries and the clock: their own hours
 *   ck-team            see and change the hours of the teams they lead
 *   ck-all             see and change everyone's hours
 *   ck-grid            the Week grid tab
 *   ck-timeline        the Day timeline tab
 *   clocky-approvals   Approvals: the decisions that are theirs
 *   ck-reopen          reopen an approved timesheet (Super Admin only)
 *   ck-whos-working    Who's working, in their scope
 *   ck-clock-out-for   "Clock out for them" (Super Admin only)
 *   ck-safety          Clock safety (reading only, for everyone who opens it)
 *   cs-periods         Company settings > Timesheet periods
 *   cs-periods-edit    change the pay period start, the default and who
 *                      submits how (Super Admin only)
 *
 * Pure: the actions decide with it, the loaders filter with it, and the tests
 * hold it to the table above.
 */

export const CLOCKY_KEYS = {
  entries: 'clocky-hours',
  team: 'ck-team',
  all: 'ck-all',
  approvals: 'clocky-approvals',
  timeOff: 'ck-timeoff',
  reopen: 'ck-reopen',
  whosWorking: 'ck-whos-working',
  clockOutFor: 'ck-clock-out-for',
  safety: 'ck-safety',
  periods: 'cs-periods',
  periodsEdit: 'cs-periods-edit',
} as const

export interface ScopeViewer {
  personId: string
  /** The access rule's answer for a catalogue key. */
  can: (key: string) => boolean
  isSuperAdmin: boolean
  /** The teams this person leads (Lead position). */
  ledTeamIds: ReadonlySet<string>
}

export interface ScopeTarget {
  personId: string
  /** Every team the person is on. */
  teamIds: readonly string[]
}

const own = (v: ScopeViewer, t: ScopeTarget) => v.personId === t.personId

/** Sees and changes everyone's hours (Admin and Super Admin, by default). */
export const seesEveryone = (v: ScopeViewer): boolean => v.can(CLOCKY_KEYS.entries) && v.can(CLOCKY_KEYS.all)

/** Leads a team the person is on, and may act on the teams they lead. */
export const leadsTeamOf = (v: ScopeViewer, t: ScopeTarget): boolean =>
  v.can(CLOCKY_KEYS.entries) && v.can(CLOCKY_KEYS.team) && t.teamIds.some(id => v.ledTeamIds.has(id))

/** Team Leader and up: adds time, uses the week grid and the timeline, lengthens (a Team Leader for their team only). */
export const isLeader = (v: ScopeViewer): boolean =>
  v.can(CLOCKY_KEYS.entries) && (v.can(CLOCKY_KEYS.all) || (v.can(CLOCKY_KEYS.team) && v.ledTeamIds.size > 0))

/** Whose hours the viewer may see. */
export function canView(v: ScopeViewer, t: ScopeTarget): boolean {
  if (!v.can(CLOCKY_KEYS.entries)) return false
  return own(v, t) || seesEveryone(v) || leadsTeamOf(v, t)
}

export type ChangeRight = 'full' | 'none'

/**
 * What the viewer may do to the person's entries: anything, with a reason
 * kept in the history (everyone on their own since 4 November 2026), or
 * nothing. Locks are a separate rule.
 */
export function changeRight(v: ScopeViewer, t: ScopeTarget): ChangeRight {
  return canView(v, t) ? 'full' : 'none'
}

/** "Add time": everyone for themselves; Team Leaders for their team too, Admins and Super Admins for anyone. */
export const canAddFor = (v: ScopeViewer, t: ScopeTarget): boolean => changeRight(v, t) === 'full'

/** Approve or deny a time correction: the person's Team Lead, an Admin or a Super Admin, never the person. */
export function canApproveCorrection(v: ScopeViewer, t: ScopeTarget): boolean {
  if (own(v, t) || !v.can(CLOCKY_KEYS.approvals)) return false
  return seesEveryone(v) || leadsTeamOf(v, t)
}

/** Reopen a submitted or approved period: Super Admins. */
export const canReopen = (v: ScopeViewer): boolean => v.can(CLOCKY_KEYS.reopen)

/** Who's working: Team Leaders see their teams, Admins and Super Admins everyone. */
export function canSeeWorking(v: ScopeViewer, t: ScopeTarget): boolean {
  if (!v.can(CLOCKY_KEYS.whosWorking)) return false
  return own(v, t) || seesEveryone(v) || leadsTeamOf(v, t)
}

/** "Clock out for them..." (2E): Super Admins, for anyone they see on the clock. */
export const canClockOutFor = (v: ScopeViewer, t: ScopeTarget): boolean =>
  v.can(CLOCKY_KEYS.clockOutFor) && canSeeWorking(v, t)

/** Timesheet periods in Company settings: who sees them, and who changes them (Super Admins). */
export const periodsAccess = (v: ScopeViewer): 'edit' | 'read' | 'none' =>
  v.can(CLOCKY_KEYS.periodsEdit) ? 'edit' : v.can(CLOCKY_KEYS.periods) ? 'read' : 'none'

/** "My | All" for the viewer: "My team" for a Team Leader, nothing for a User. */
export function whoChoice(v: ScopeViewer): 'all' | 'team' | null {
  if (seesEveryone(v)) return 'all'
  if (v.can(CLOCKY_KEYS.entries) && v.can(CLOCKY_KEYS.team) && v.ledTeamIds.size > 0) return 'team'
  return null
}
