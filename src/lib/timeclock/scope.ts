/**
 * Who may see, change and approve whose hours in Clocky (design handoff of
 * 16 October 2026, README "Who sees what"):
 *
 *   Level        Time entries        Change hours                Approvals
 *   Super Admin  own + everyone      anything, anyone            corrections + time off, everyone
 *   Admin        own + everyone      anything, anyone            corrections, everyone
 *   Team Leader  own + own team      anything, own team          corrections, own team
 *   User         own only            shorten own entries only    hidden
 *
 * A Team Leader is a person with the Lead position in a team; "own team" is
 * the people on the teams they lead. Only Super Admins decide time off and
 * reopen submitted periods; corrections are approved by the person's Team
 * Lead, an Admin or a Super Admin, never by the person.
 *
 * The levels are the access catalogue's starting answers (lib/access/
 * catalogue.ts, module Clocky), so a Super Admin can still move a tick on
 * Admin > Access levels, as everywhere else in the portal:
 *
 *   clocky-hours       Time entries and the clock: their own hours
 *   ck-team            see and change the hours of the teams they lead
 *   ck-all             see and change everyone's hours
 *   clocky-approvals   Approvals: decide time corrections in their scope
 *   ck-timeoff         decide time off (Super Admin only)
 *   ck-reopen          reopen a submitted period (Super Admin only)
 *   ck-whos-working    Who's working, in their scope
 *   ck-clock-out-for   "Clock out for them" (Super Admin only)
 *   ck-safety          Clock safety (read only below Super Admin)
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

/** Team Leader and up: adds time, uses the week grid and the timeline, lengthens. */
export const isLeader = (v: ScopeViewer): boolean =>
  v.can(CLOCKY_KEYS.entries) && (v.can(CLOCKY_KEYS.all) || (v.can(CLOCKY_KEYS.team) && v.ledTeamIds.size > 0))

/** Whose hours the viewer may see. */
export function canView(v: ScopeViewer, t: ScopeTarget): boolean {
  if (!v.can(CLOCKY_KEYS.entries)) return false
  return own(v, t) || seesEveryone(v) || leadsTeamOf(v, t)
}

export type ChangeRight = 'full' | 'shorten' | 'none'

/**
 * What the viewer may do to the person's entries: anything (with a reason),
 * only make their own shorter (a User), or nothing. Locks are a separate rule.
 */
export function changeRight(v: ScopeViewer, t: ScopeTarget): ChangeRight {
  if (!canView(v, t)) return 'none'
  if (own(v, t)) return isLeader(v) ? 'full' : 'shorten'
  return 'full'
}

/** "Add time" and the week grid: Team Leaders (own team, themselves included), Admins and Super Admins. */
export const canAddFor = (v: ScopeViewer, t: ScopeTarget): boolean => changeRight(v, t) === 'full'

/** Approve or deny a time correction: the person's Team Lead, an Admin or a Super Admin, never the person. */
export function canApproveCorrection(v: ScopeViewer, t: ScopeTarget): boolean {
  if (own(v, t) || !v.can(CLOCKY_KEYS.approvals)) return false
  return seesEveryone(v) || leadsTeamOf(v, t)
}

/** Approve or deny time off: Super Admins, never for themselves. */
export const canDecideTimeOff = (v: ScopeViewer, t: ScopeTarget): boolean =>
  !own(v, t) && v.can(CLOCKY_KEYS.timeOff)

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

/** Clock safety: Admin and up; only a Super Admin has it in full, an Admin reads it. */
export const safetyAccess = (v: ScopeViewer): 'full' | 'read' | 'none' =>
  !v.can(CLOCKY_KEYS.safety) ? 'none' : v.isSuperAdmin ? 'full' : 'read'

/** Timesheet periods in Company settings: who sees them, and who changes them (Super Admins). */
export const periodsAccess = (v: ScopeViewer): 'edit' | 'read' | 'none' =>
  v.can(CLOCKY_KEYS.periodsEdit) ? 'edit' : v.can(CLOCKY_KEYS.periods) ? 'read' : 'none'

/** "My | All" for the viewer: "My team" for a Team Leader, nothing for a User. */
export function whoChoice(v: ScopeViewer): 'all' | 'team' | null {
  if (seesEveryone(v)) return 'all'
  if (v.can(CLOCKY_KEYS.entries) && v.can(CLOCKY_KEYS.team) && v.ledTeamIds.size > 0) return 'team'
  return null
}

// ── Users only shorten ──────────────────────────────────────────────────────

/** The red line in 3E when a User forces a longer time (exact copy). */
export const SHORTEN_ONLY = 'You can shorten this entry, not lengthen it. To add time, ask your Team Leader.'

export interface Span {
  /** Recorded start and end; null end while running; both null for a duration-only entry. */
  start: string | null
  end: string | null
  seconds: number
}

/**
 * Whether a change keeps the entry inside what was recorded: a later start, an
 * earlier end, a shorter duration. A running entry stays running.
 */
export function onlyShorter(before: Span, after: Span): boolean {
  if (before.start === null) return after.start === null && after.seconds <= before.seconds
  if (after.start === null) return false
  if (Date.parse(after.start) < Date.parse(before.start)) return false
  if (before.end === null) return after.end === null
  if (after.end === null) return false
  return Date.parse(after.end) <= Date.parse(before.end)
}
