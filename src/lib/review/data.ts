/**
 * The annual review on the server: settings, the year, the reviews, who sees
 * what (design handoff, 3 November 2026). Every read goes through the
 * privileged client and is narrowed here, in app code, never by RLS: the
 * tables give nothing to the signed-in role (migration 148).
 *
 * Who sees a review:
 *   - the person;
 *   - the one they report to now (their reviewer, worked out from the
 *     Directory every time, so a former manager stops seeing it);
 *   - the VP of Operations, the CISO and HR, picked in Company settings;
 *   - a Super Admin.
 * "For leadership" never exists here: every part of a review is the person's.
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { localDate } from '@/lib/timeclock/format'
import {
  participants, rolesFromTitles, teamOpens, type CycleDates, type GoalResult, type GoalStatus, type Participant, type Roles, type RosterMembership,
  type RosterPerson, type RosterTeam, type Step,
} from './rules'

export const REVIEW_ZONE = 'America/New_York'
export const reviewToday = (now = new Date()) => localDate(now, REVIEW_ZONE)

// The new tables are not in the generated types until they are regenerated
// after the migration; the loose client keeps this file honest about shapes
// through the row interfaces below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rdb = (): any => createAdminClient()

const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return (r.data ?? ([] as unknown)) as T
}
// A single-row read: no row stays null (must's [] would pass for a row).
const one = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T | null => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data ?? null
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface HrSettings {
  vpId: string | null; cisoId: string | null; hrId: string | null; extra: string[]
  driveFolderId: string | null; driveFolderName: string | null; driveFolderPath: string | null
}

export const loadHrSettings = cache(async (): Promise<HrSettings> => {
  const r = await rdb().from('hr_settings').select('*').eq('singleton_id', 1).maybeSingle()
  const s = one<Record<string, unknown>>(r, 'Human Resources settings could not be read')
  const picked = { vpId: (s?.vp_operations_id as string) ?? null, cisoId: (s?.ciso_id as string) ?? null, hrId: (s?.hr_id as string) ?? null }
  const roles = picked.vpId && picked.cisoId && picked.hrId ? picked : rolesFromTitles([...(await loadRoster()).people.values()], picked)
  return {
    ...roles,
    extra: (s?.extra_people as string[]) ?? [],
    driveFolderId: (s?.drive_folder_id as string) ?? null,
    driveFolderName: (s?.drive_folder_name as string) ?? null,
    driveFolderPath: (s?.drive_folder_path as string) ?? null,
  }
})

export const rolesOf = (s: HrSettings): Roles => ({ vpId: s.vpId, cisoId: s.cisoId, hrId: s.hrId })

// ── The year ───────────────────────────────────────────────────────────────

export interface Cycle extends CycleDates { id: number; year: number; started_at: string | null; started_by: string | null }

export const CYCLE_COLUMNS = 'id, year, leaders_open_on, leaders_due, teams_open_by, self_due, review_due, meeting_due, approval_due, checkins_by, started_at, started_by'

/** The latest year's cycle (the one being set up or run), or null before the first. */
export const loadCurrentCycle = cache(async (): Promise<Cycle | null> => {
  const r = await rdb().from('review_cycles').select(CYCLE_COLUMNS).order('year', { ascending: false }).limit(1).maybeSingle()
  return one<Cycle>(r, 'The review year could not be read')
})

/**
 * The year being prepared, created empty (no dates, not started) when there is
 * none yet: the Company Priorities are step 0 and come before any date.
 */
export async function ensureCurrentCycle(): Promise<Cycle> {
  const c = await loadCurrentCycle()
  if (c) return c
  const r = await rdb().from('review_cycles').upsert({ year: defaultYear() }, { onConflict: 'year', ignoreDuplicates: true }).select(CYCLE_COLUMNS).maybeSingle()
  return one<Cycle>(r, 'The review year could not be made') ?? (await loadCycle(defaultYear()))!
}

export async function loadCycle(year: number): Promise<Cycle | null> {
  const r = await rdb().from('review_cycles').select(CYCLE_COLUMNS).eq('year', year).maybeSingle()
  return one<Cycle>(r, 'The review year could not be read')
}

export async function loadCycles(): Promise<Cycle[]> {
  const r = await rdb().from('review_cycles').select(CYCLE_COLUMNS).order('year', { ascending: false })
  return must<Cycle[]>(r, 'The review years could not be read')
}

/** The year a new cycle is for: the calendar year in DC. Reviews run in November and December. */
export const defaultYear = (now = new Date()) => Number(reviewToday(now).slice(0, 4))

// ── The roster ─────────────────────────────────────────────────────────────

export interface RosterRow extends RosterPerson { avatarUrl: string | null; emails: string[] }
export interface Roster { people: Map<string, RosterRow>; members: RosterMembership[]; teams: Map<string, RosterTeam & { color: string | null }> }

export const loadRoster = cache(async (): Promise<Roster> => {
  const c = rdb()
  const [p, m, t] = await Promise.all([
    c.from('people').select('id, full_name, status, employment_type, manager_id, title, hire_date, avatar_url, email_true_north, email_personal').order('full_name').limit(2000),
    c.from('team_members').select('person_id, team_id, position, is_primary').limit(5000),
    c.from('teams').select('id, name, color').order('sort_order'),
  ])
  const people = must<{ id: string; full_name: string; status: string | null; employment_type: string | null; manager_id: string | null; title: string | null; hire_date: string | null; avatar_url: string | null; email_true_north: string | null; email_personal: string | null }[]>(p, 'People could not be read')
  const members = must<{ person_id: string; team_id: string; position: string | null; is_primary: boolean }[]>(m, 'Teams could not be read')
  const teams = must<{ id: string; name: string; color: string | null }[]>(t, 'Teams could not be read')
  return {
    people: new Map(people.map(x => [x.id, {
      id: x.id, name: x.full_name, active: !x.status || x.status === 'active', employmentType: x.employment_type, managerId: x.manager_id,
      title: x.title, hireDate: x.hire_date, avatarUrl: x.avatar_url, emails: [x.email_true_north, x.email_personal].filter((e): e is string => !!e),
    }])),
    members: members.map(x => ({ personId: x.person_id, teamId: x.team_id, position: x.position, isPrimary: x.is_primary })),
    teams: new Map(teams.map(x => [x.id, { id: x.id, name: x.name, color: x.color }])),
  }
})

export const nameIn = (roster: Roster, id: string | null | undefined) => (id ? roster.people.get(id)?.name ?? 'Someone' : '')

export function rosterParticipants(roster: Roster, settings: HrSettings): Participant[] {
  return participants([...roster.people.values()], roster.members, [...roster.teams.values()], rolesOf(settings), new Set(settings.extra))
}

/** Who someone reports to now, for the review: their reviewer worked out today. */
export function currentReviewerOf(roster: Roster, settings: HrSettings, personId: string): string | null {
  return rosterParticipants(roster, settings).find(p => p.personId === personId)?.reviewerId ?? null
}

// ── The viewer ─────────────────────────────────────────────────────────────

export interface ReviewViewer {
  personId: string | null
  isSuperAdmin: boolean
  isVp: boolean; isCiso: boolean; isHr: boolean
  /** VP of Operations or CISO: the Company Priorities and the team approvals. */
  leads: boolean
  /** Sees every review: HR and Super Admins. The VP and the CISO see only the people who report to them (handoff, Who sees what). */
  seesAll: boolean
  /** The people who report to them now (their reviewees). */
  reports: Set<string>
}

export function viewerOf(access: { personId: string | null; isSuperAdmin: boolean }, settings: HrSettings, parts: Participant[]): ReviewViewer {
  const id = access.personId
  const isVp = !!id && id === settings.vpId
  const isCiso = !!id && id === settings.cisoId
  const isHr = !!id && id === settings.hrId
  return {
    personId: id, isSuperAdmin: access.isSuperAdmin, isVp, isCiso, isHr,
    leads: isVp || isCiso || access.isSuperAdmin,
    seesAll: isHr || access.isSuperAdmin,
    reports: new Set(id ? parts.filter(p => p.reviewerId === id).map(p => p.personId) : []),
  }
}

export const canSeePerson = (v: ReviewViewer, personId: string) => v.seesAll || v.personId === personId || v.reports.has(personId)

// ── Reviews ────────────────────────────────────────────────────────────────

export interface ReviewRow {
  id: number; cycle_id: number; person_id: string; reviewer_id: string | null; team_id: string | null; phase: 1 | 2; step: Step
  opened_at: string | null; self_sent_at: string | null; review_sent_at: string | null
  meeting_event_id: string | null; meeting_starts_at: string | null; meeting_ends_at: string | null; meeting_notes: string
  agreed_at: string | null; approved_at: string | null; approved_by: string | null
  sent_back_at: string | null; sent_back_by: string | null; sent_back_reason: string | null; sent_back_from: string | null
  pdf_path: string | null; pdf_name: string | null; drive_status: 'waiting' | 'saved' | 'failed' | null; drive_file_id: string | null; drive_error: string | null
  updated_at: string
}

export async function loadReviews(cycleId: number): Promise<ReviewRow[]> {
  const r = await rdb().from('reviews').select('*').eq('cycle_id', cycleId).limit(2000)
  return must<ReviewRow[]>(r, 'The reviews could not be read')
}

export async function loadReview(id: number): Promise<ReviewRow | null> {
  const r = await rdb().from('reviews').select('*').eq('id', id).maybeSingle()
  return one<ReviewRow>(r, 'The review could not be read')
}

export async function loadPersonReviews(personId: string): Promise<(ReviewRow & { year: number })[]> {
  const r = await rdb().from('reviews').select('*, review_cycles(year)').eq('person_id', personId).limit(100)
  const rows = must<(ReviewRow & { review_cycles: { year: number } | null })[]>(r, 'The reviews could not be read')
  return rows.map(x => ({ ...x, year: x.review_cycles?.year ?? 0 })).sort((a, b) => b.year - a.year)
}

// ── Team priorities ────────────────────────────────────────────────────────

export interface Priority { id: number; cycle_id: number; team_id: string | null; position: number; title: string; body: string; supports_id: number | null; created_by: string | null; updated_by: string | null; updated_at: string }
export interface TeamPriorityState { cycle_id: number; team_id: string; state: 'draft' | 'sent' | 'approved' | 'returned'; sent_at: string | null; sent_by: string | null; decided_at: string | null; decided_by: string | null; return_reason: string | null; opened_at: string | null }

export async function loadPriorities(cycleId: number): Promise<Priority[]> {
  const r = await rdb().from('review_priorities').select('*').eq('cycle_id', cycleId).order('position').order('id')
  return must<Priority[]>(r, 'The priorities could not be read')
}

export async function loadTeamStates(cycleId: number): Promise<Map<string, TeamPriorityState>> {
  const r = await rdb().from('review_team_priorities').select('*').eq('cycle_id', cycleId)
  return new Map(must<TeamPriorityState[]>(r, 'The team priorities could not be read').map(t => [t.team_id, t]))
}

/** What a person sees: the Company Priorities and their own team's once approved, numbered in that order. */
export function prioritiesFor(all: Priority[], teamId: string | null, states: Map<string, TeamPriorityState>): Priority[] {
  const company = all.filter(p => !p.team_id)
  const team = teamId && states.get(teamId)?.state === 'approved' ? all.filter(p => p.team_id === teamId) : []
  return [...company, ...team]
}

// ── Opening reviews ────────────────────────────────────────────────────────

/**
 * Brings a started year up to date: a review for everyone who takes part,
 * phase 1 open, each team open once its priorities are approved or "Teams
 * open by" has come, and each open review's reviewer taken from the Directory
 * as it is now. Returns the reviews it just opened (for the "is open" email).
 * Safe to run any number of times: the page, the actions and the daily job
 * all call it.
 */
export async function syncCycle(cycle: Cycle, now = new Date()): Promise<{ opened: number[] }> {
  if (!cycle.started_at) return { opened: [] }
  const [settings, roster, reviews, states] = await Promise.all([loadHrSettings(), loadRoster(), loadReviews(cycle.id), loadTeamStates(cycle.id)])
  const today = reviewToday(now)
  const parts = rosterParticipants(roster, settings)
  const byPerson = new Map(reviews.map(r => [r.person_id, r]))
  const openNow = (p: Participant) => p.phase === 1 || (p.teamId ? teamOpens({ approved: states.get(p.teamId)?.state === 'approved' }, cycle.teams_open_by, today) : true)
  const stamp = now.toISOString()
  const c = rdb()

  const inserts = parts.filter(p => !byPerson.has(p.personId)).map(p => ({
    cycle_id: cycle.id, person_id: p.personId, reviewer_id: p.reviewerId, team_id: p.teamId, phase: p.phase,
    step: openNow(p) ? 'self' : 'waiting', opened_at: openNow(p) ? stamp : null,
  }))
  const opened: number[] = []
  if (inserts.length) {
    const r = await c.from('reviews').upsert(inserts, { onConflict: 'cycle_id,person_id', ignoreDuplicates: true }).select('id, step')
    for (const x of must<{ id: number; step: Step }[]>(r, 'The reviews could not be made')) if (x.step === 'self') opened.push(x.id)
  }
  for (const p of parts) {
    const r = byPerson.get(p.personId)
    if (!r) continue
    const patch: Record<string, unknown> = {}
    if (r.step === 'waiting' && openNow(p)) { patch.step = 'self'; patch.opened_at = stamp; opened.push(r.id) }
    if (r.step !== 'approved' && r.reviewer_id !== p.reviewerId) patch.reviewer_id = p.reviewerId
    if (r.step !== 'approved' && r.team_id !== p.teamId) patch.team_id = p.teamId
    if (r.step === 'waiting' && r.phase !== p.phase) patch.phase = p.phase
    if (Object.keys(patch).length) {
      const u = await c.from('reviews').update({ ...patch, updated_at: stamp }).eq('id', r.id).eq('step', r.step)
      if (u.error) throw new Error(`A review could not be opened: ${u.error.message}`)
    }
  }
  // Stamp the teams whose people just opened.
  const openedTeams = new Set(parts.filter(p => p.phase === 2 && p.teamId && openNow(p)).map(p => p.teamId!))
  for (const teamId of openedTeams) {
    if (states.get(teamId)?.opened_at) continue
    await c.from('review_team_priorities').upsert({ cycle_id: cycle.id, team_id: teamId, opened_at: stamp, state: states.get(teamId)?.state ?? 'draft' }, { onConflict: 'cycle_id,team_id' })
  }
  return { opened }
}

// ── Answers, goals, log ────────────────────────────────────────────────────

export interface Answer { key: string; body: string; copied: boolean; updated_at: string }
export async function loadAnswers(reviewId: number): Promise<Map<string, Answer>> {
  const r = await rdb().from('review_answers').select('key, body, copied, updated_at').eq('review_id', reviewId)
  return new Map(must<Answer[]>(r, 'The answers could not be read').map(a => [a.key, a]))
}

export interface Goal {
  id: number; person_id: string; review_id: number | null; goal_year: number; position: number
  what: string; how: string; by_month: string | null; term: '6m' | '1y' | null; priority_id: number | null
  added_by: string | null; added_by_reviewer: boolean; changed_by: string | null; original: { what?: string; how?: string; by_month?: string | null; term?: string | null; priority_id?: number | null } | null
  status: GoalStatus; marked_in: number | null; result: GoalResult | null; result_comment: string; updated_at: string
}

export async function loadGoals(filter: { personId: string; years?: number[] } | { reviewId: number }): Promise<Goal[]> {
  let q = rdb().from('review_goals').select('*')
  if ('reviewId' in filter) q = q.eq('review_id', filter.reviewId)
  else {
    q = q.eq('person_id', filter.personId)
    if (filter.years?.length) q = q.in('goal_year', filter.years)
  }
  const r = await q.order('position').order('id').limit(500)
  return must<Goal[]>(r, 'The goals could not be read')
}

export interface GoalUpdate { id: number; goal_id: number; author_id: string | null; kind: 'update' | 'comment' | 'checkin'; status: GoalStatus | null; body: string; created_at: string }
export async function loadGoalUpdates(goalIds: number[]): Promise<GoalUpdate[]> {
  if (!goalIds.length) return []
  const r = await rdb().from('review_goal_updates').select('*').in('goal_id', goalIds).order('created_at', { ascending: false }).limit(2000)
  return must<GoalUpdate[]>(r, 'The goal updates could not be read')
}

export interface LogRow { id: number; cycle_id: number | null; review_id: number | null; actor_id: string | null; kind: string; text: string; created_at: string }
export async function addLog(row: { cycle_id: number | null; review_id?: number | null; actor_id: string | null; kind: string; text: string }) {
  const r = await rdb().from('review_log').insert({ review_id: null, ...row })
  if (r.error) console.error('[review] log:', r.error.message)
}
export async function loadLog(filter: { cycleId: number; kinds?: string[] } | { reviewId: number }, limit = 50): Promise<LogRow[]> {
  let q = rdb().from('review_log').select('*')
  if ('reviewId' in filter) q = q.eq('review_id', filter.reviewId)
  else {
    q = q.eq('cycle_id', filter.cycleId)
    if (filter.kinds) q = q.in('kind', filter.kinds)
  }
  const r = await q.order('created_at', { ascending: false }).limit(limit)
  return must<LogRow[]>(r, 'The history could not be read')
}

// ── Last year's files ──────────────────────────────────────────────────────

export interface ImportRow { id: number; year: number; person_id: string | null; drive_file_id: string; file_name: string; mime_type: string | null; web_link: string | null; match: 'matched' | 'check' | 'none' | 'skipped'; imported_at: string | null; created_at: string
  /** What the file said when it was read (migration 150): the Job Description answers and how many goals. */
  found: { read: boolean; job: Partial<Record<string, string>>; goals: number } | null
}
export async function loadImports(filter: { year?: number; personId?: string } = {}): Promise<ImportRow[]> {
  let q = rdb().from('review_imports').select('*')
  if (filter.year) q = q.eq('year', filter.year)
  if (filter.personId) q = q.eq('person_id', filter.personId).not('imported_at', 'is', null)
  const r = await q.order('file_name').limit(1000)
  return must<ImportRow[]>(r, "Last year's reviews could not be read")
}

export interface Checkin { id: number; cycle_id: number; person_id: string; manager_id: string | null; event_id: string | null; starts_at: string | null; finished_at: string | null }
export async function loadCheckins(cycleId: number, personIds?: string[]): Promise<Map<string, Checkin>> {
  let q = rdb().from('review_checkins').select('*').eq('cycle_id', cycleId)
  if (personIds) q = q.in('person_id', personIds.length ? personIds : ['00000000-0000-0000-0000-000000000000'])
  const r = await q
  return new Map(must<Checkin[]>(r, 'The check-ins could not be read').map(x => [x.person_id, x]))
}

