/**
 * The annual review's rules (design handoff, 3 November 2026), pure so they
 * can be tested without a database.
 *
 * A review is always between two levels: the person and the one they report
 * to. That is their Team Leader (who leads their main team) or, with none,
 * the person they report to in the Directory (people.manager_id). The VP of
 * Operations and the CISO, picked in Company settings, stand apart: the CISO
 * reviews the VP, and nobody reviews the CISO, who has no review.
 *
 * Phase 1: the Team Leaders and everyone with no Team Leader go first, when
 * the cycle starts. Phase 2: each team's people open when the team's
 * priorities are approved, or on "Teams open by", whichever comes first.
 */

import { isLeadPosition } from '@/lib/access/catalogue'

// ── Who takes part, and who reviews them ───────────────────────────────────

export interface RosterPerson { id: string; name: string; active: boolean; employmentType: string | null; managerId: string | null; title: string | null; hireDate: string | null }
export interface RosterMembership { personId: string; teamId: string; position: string | null; isPrimary: boolean }
export interface RosterTeam { id: string; name: string }
export interface Roles { vpId: string | null; cisoId: string | null; hrId: string | null }

export interface Participant {
  personId: string
  teamId: string | null
  /** Who leads their main team, when that is not themselves. */
  teamLeaderId: string | null
  reviewerId: string | null
  phase: 1 | 2
  leads: string[]
}

/** Employees always; anyone else only when added in "Who takes part". */
// The roles read from the Directory titles, for any role not picked by hand in
// Company settings: one active person whose title names it, or nobody when no
// title or more than one does.
const ROLE_TITLES: Record<keyof Roles, RegExp> = {
  vpId: /\b(VPO|VP of Operations|Vice President of Operations)\b/i,
  cisoId: /\bCISO\b/i,
  hrId: /\b(HR|Human Resources)\b/i,
}
export function rolesFromTitles(people: RosterPerson[], picked: Roles): Roles {
  const find = (k: keyof Roles) => {
    if (picked[k]) return picked[k]
    const hits = people.filter(p => p.active && p.title && ROLE_TITLES[k].test(p.title))
    return hits.length === 1 ? hits[0].id : null
  }
  return { vpId: find('vpId'), cisoId: find('cisoId'), hrId: find('hrId') }
}

export function takesPart(p: RosterPerson, extra: ReadonlySet<string>): boolean {
  if (!p.active) return false
  return p.employmentType !== 'contractor' || extra.has(p.id)
}

/** Each person's main team: the primary flag, else the first team by name. */
export function mainTeamOf(personId: string, members: RosterMembership[], teams: Map<string, RosterTeam>): string | null {
  const mine = members.filter(m => m.personId === personId && teams.has(m.teamId))
  if (!mine.length) return null
  mine.sort((a, b) => (a.isPrimary !== b.isPrimary ? (a.isPrimary ? -1 : 1) : teams.get(a.teamId)!.name.localeCompare(teams.get(b.teamId)!.name)))
  return mine[0].teamId
}

/** The people who lead a team (their membership position is a lead one). */
export function leadersOf(teamId: string, members: RosterMembership[]): string[] {
  return members.filter(m => m.teamId === teamId && isLeadPosition(m.position)).map(m => m.personId)
}

/**
 * Who may approve or send back a team's priorities: the VP of Operations or
 * the CISO, never for a team they lead themselves (the other one decides).
 * A team both of them lead (Leadership: owner, 4 November 2026) is the
 * CISO's to decide, as the CISO is the one nobody reviews.
 */
export function decidesTeam(personId: string | null, isVpOrCiso: boolean, teamId: string, members: RosterMembership[], roles?: Pick<Roles, 'vpId' | 'cisoId'>): boolean {
  if (!personId || !isVpOrCiso) return false
  const leaders = leadersOf(teamId, members)
  if (!leaders.includes(personId)) return true
  return !!roles && personId === roles.cisoId && !!roles.vpId && leaders.includes(roles.vpId)
}

/**
 * Who reviews this person (owner, 4 November 2026): the CISO reviews the VP
 * of Operations and nobody reviews the CISO; everyone else, their Team
 * Leader, else who they report to.
 */
export function reviewerFor(personId: string, teamLeaderId: string | null, managerId: string | null, roles: Roles): string | null {
  if (personId === roles.cisoId) return null
  if (personId === roles.vpId) return roles.cisoId
  if (teamLeaderId && teamLeaderId !== personId) return teamLeaderId
  if (managerId && managerId !== personId) return managerId
  return null
}

export function participants(people: RosterPerson[], members: RosterMembership[], teams: RosterTeam[], roles: Roles, extra: ReadonlySet<string>): Participant[] {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const active = new Set(people.filter(p => p.active).map(p => p.id))
  // The CISO has no review of their own: nobody reviews them (owner, 4 November 2026).
  return people.filter(p => takesPart(p, extra) && p.id !== roles.cisoId).map(p => {
    const teamId = mainTeamOf(p.id, members, teamMap)
    const leaders = teamId ? leadersOf(teamId, members).filter(id => id !== p.id && active.has(id)) : []
    const iLead = teamId ? leadersOf(teamId, members).includes(p.id) : false
    const teamLeaderId = iLead ? null : (leaders[0] ?? null)
    const leads = members.filter(m => m.personId === p.id && isLeadPosition(m.position) && teamMap.has(m.teamId)).map(m => m.teamId)
    return {
      personId: p.id,
      teamId,
      teamLeaderId,
      reviewerId: reviewerFor(p.id, teamLeaderId, p.managerId, roles),
      phase: teamLeaderId ? 2 : 1,
      leads,
    }
  })
}

// ── The steps ──────────────────────────────────────────────────────────────

export type Step = 'waiting' | 'self' | 'review' | 'meeting' | 'approval' | 'approved'
export const STEPS: Exclude<Step, 'waiting' | 'approved'>[] = ['self', 'review', 'meeting', 'approval']
export const STEP_LABEL: Record<Step, string> = {
  waiting: 'Not open yet', self: 'Self-review', review: 'Review', meeting: 'Meeting', approval: 'Approval', approved: 'Approved',
}

/** One step back, with a reason: only from review, meeting and approval. */
export function stepBack(step: Step): Step | null {
  return step === 'review' ? 'self' : step === 'meeting' ? 'review' : step === 'approval' ? 'meeting' : null
}

export interface CycleDates {
  leaders_open_on: string | null; leaders_due: string | null; teams_open_by: string | null
  self_due: string | null; review_due: string | null; meeting_due: string | null; approval_due: string | null; checkins_by: string | null
}

/** The due date of the step a review is on. Phase 1 self-reviews are due earlier. */
export function dueOf(step: Step, phase: 1 | 2, d: CycleDates): string | null {
  switch (step) {
    case 'self': return phase === 1 ? (d.leaders_due ?? d.self_due) : d.self_due
    case 'review': return d.review_due
    case 'meeting': return d.meeting_due
    case 'approval': return d.approval_due
    default: return null
  }
}

/** Who has to act now: the person writes and agrees; the reviewer reviews, books and approves. */
export function waitsFor(r: { step: Step; personId: string; reviewerId: string | null; meetingEndsAt: string | null; agreedAt: string | null }, now: Date): string | null {
  switch (r.step) {
    case 'self': return r.personId
    case 'review': return r.reviewerId
    case 'meeting':
      if (r.meetingEndsAt && new Date(r.meetingEndsAt) <= now && !r.agreedAt) return r.personId
      return r.reviewerId
    case 'approval': return r.reviewerId
    default: return null
  }
}

/** A team opens when its priorities are approved, or on "Teams open by" at the latest. */
export function teamOpens(state: { approved: boolean } | null, teamsOpenBy: string | null, today: string): boolean {
  if (state?.approved) return true
  return !!teamsOpenBy && today >= teamsOpenBy
}

// ── Days ───────────────────────────────────────────────────────────────────

export const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * When a Super Admin's Home asks them to start the year's cycle: from a week
 * before "Team Leaders open on" until someone starts it (late stays shown).
 */
export const START_NOTICE_DAYS = 7
export function startRowShows(today: string, leadersOpenOn: string | null, started: boolean): boolean {
  return !started && !!leadersOpenOn && dayDiff(today, leadersOpenOn) <= START_NOTICE_DAYS
}

/** "4 days left", "tomorrow", "today", "2 days late". */
export function dueWords(due: string, today: string): string {
  const n = dayDiff(today, due)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n > 1) return `${n} days left`
  return n === -1 ? '1 day late' : `${-n} days late`
}

/** The reminder days for a due date: 1 week before, 3 days before and on the day. */
export const REMINDER_OFFSETS = [7, 3, 0] as const
export function reminderToday(due: string | null, today: string): 7 | 3 | 0 | null {
  if (!due) return null
  const n = dayDiff(today, due)
  return (REMINDER_OFFSETS as readonly number[]).includes(n) ? (n as 7 | 3 | 0) : null
}

/** The last day of a goal's month (its "by when"), as YYYY-MM-DD. */
export function monthEnd(byMonth: string): string {
  const [y, m] = byMonth.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** The check-ins open a month before "Check-ins by". */
export const checkinsOpenOn = (by: string) => {
  const [y, m, d] = by.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 2, d))
  return t.toISOString().slice(0, 10)
}

// ── Goals ──────────────────────────────────────────────────────────────────

export type GoalStatus = 'not_started' | 'on_track' | 'at_risk' | 'done' | 'dropped'
export type GoalResult = 'met' | 'partly' | 'not_met' | 'dropped'
export const GOAL_STATUS: { key: GoalStatus; label: string; tone: 'gray' | 'blue' | 'amber' | 'green' }[] = [
  { key: 'not_started', label: 'Not started', tone: 'gray' },
  { key: 'on_track', label: 'On track', tone: 'green' },
  { key: 'at_risk', label: 'At risk', tone: 'amber' },
  { key: 'done', label: 'Done', tone: 'green' },
  { key: 'dropped', label: 'No longer relevant', tone: 'gray' },
]
export const GOAL_RESULT: { key: GoalResult; label: string; tone: 'green' | 'amber' | 'red' | 'gray' }[] = [
  { key: 'met', label: 'Met', tone: 'green' },
  { key: 'partly', label: 'Partly met', tone: 'amber' },
  { key: 'not_met', label: 'Not met', tone: 'red' },
  { key: 'dropped', label: 'No longer relevant', tone: 'gray' },
]
export const statusLabel = (s: GoalStatus) => GOAL_STATUS.find(x => x.key === s)!.label

/** "1 on track · 1 at risk · 1 done · 1 not started", in that order, zeros left out. */
export function statusSummary(statuses: GoalStatus[]): string {
  const order: GoalStatus[] = ['on_track', 'at_risk', 'done', 'not_started', 'dropped']
  const parts = order.map(k => [k, statuses.filter(s => s === k).length] as const).filter(([, n]) => n > 0)
  return parts.map(([k, n]) => `${n} ${statusLabel(k).toLowerCase()}`).join(' · ')
}

export const TERM_LABEL = { '6m': '6 months', '1y': '1 year' } as const

/** "July 2027" from 2027-07-01. */
export function monthLabel(byMonth: string | null): string {
  if (!byMonth) return ''
  const [y, m] = byMonth.split('-').map(Number)
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`
}

// ── The card on Human Resources and Home ───────────────────────────────────

export type CardState = 'soon' | 'open' | 'progress' | 'late' | 'with_reviewer' | 'booked' | 'agree' | 'approved'

export function cardState(r: {
  step: Step; answered: number; goals: number; due: string | null; meetingStartsAt: string | null; meetingEndsAt: string | null; agreedAt: string | null
}, today: string, now: Date): CardState {
  switch (r.step) {
    case 'waiting': return 'soon'
    case 'self':
      if (r.due && today > r.due) return 'late'
      return r.answered + r.goals > 0 ? 'progress' : 'open'
    case 'review': return 'with_reviewer'
    case 'meeting':
      if (r.meetingEndsAt && new Date(r.meetingEndsAt) <= now && !r.agreedAt) return 'agree'
      return r.meetingStartsAt ? 'booked' : 'with_reviewer'
    case 'approval': return 'with_reviewer'
    case 'approved': return 'approved'
  }
}

/** The card shows from the moment the review exists until 30 days after approval. */
export function cardShows(r: { step: Step; approvedAt: string | null }, today: string): boolean {
  if (r.step !== 'approved') return true
  return !!r.approvedAt && dayDiff(r.approvedAt.slice(0, 10), today) <= 30
}

// ── Last year's files: match a file name to a person ───────────────────────

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Edit distance, for "Gracie Hill" against "Grace Hill". */
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** The name in "2025.11 - Amy Prindle.pdf": what follows the last " - ", without the extension. */
export function nameInFile(file: string): string {
  const base = file.replace(/\.[a-z0-9]{2,5}$/i, '')
  const i = base.lastIndexOf(' - ')
  return i >= 0 ? base.slice(i + 3) : ''
}

export type FileMatch = { personId: string | null; match: 'matched' | 'check' | 'none' | 'skipped' }

export function matchFile(file: string, people: { id: string; name: string; active: boolean }[]): FileMatch {
  const n = norm(nameInFile(file))
  if (!n) return { personId: null, match: 'none' }
  const exact = people.find(p => norm(p.name) === n)
  if (exact) return { personId: exact.id, match: exact.active ? 'matched' : 'skipped' }
  let best: { id: string; active: boolean; d: number } | null = null
  for (const p of people) {
    const d = lev(norm(p.name), n)
    if (!best || d < best.d) best = { id: p.id, active: p.active, d }
  }
  if (best && best.d <= Math.max(2, Math.floor(n.length / 6))) return { personId: best.id, match: best.active ? 'check' : 'skipped' }
  return { personId: null, match: 'none' }
}

/** "2026.11 - Amy Prindle.pdf", the approved PDF's name in Drive. */
export const pdfName = (year: number, month: string, name: string) => `${year}.${month} - ${name.replace(/[\\/:*?"<>|]/g, ' ').trim()}.pdf`
