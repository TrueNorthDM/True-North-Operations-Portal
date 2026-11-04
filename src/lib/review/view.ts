/**
 * One review, read for the page, the PDF and the Drive copy (design handoff,
 * 3 November 2026, C3 to F1). Plain data: names instead of ids, dates as
 * stored, what the viewer may do worked out here, once.
 */

import { templateFor, type Template } from './template'
import {
  dueOf, monthLabel, waitsFor, type GoalResult, type GoalStatus, type Step,
} from './rules'
import {
  canSeePerson, loadAnswers, loadCycle, loadGoals, loadImports, loadLog, loadPersonReviews, loadPriorities, loadReview, loadTeamStates,
  nameIn, prioritiesFor, type Cycle, type Goal, type ImportRow, type ReviewRow, type ReviewViewer, type Roster, type TeamPriorityState,
} from './data'
import { rdb } from './data'

export interface PriorityView { id: number; n: number; scope: string; teamId: string | null; title: string; body: string; goals: number }
export interface GoalView {
  id: number; n: number; what: string; how: string; byMonth: string | null; byLabel: string; term: '6m' | '1y' | null
  priorityId: number | null; priorityTitle: string | null
  addedByReviewer: boolean; addedByName: string | null; changedByName: string | null
  original: { what?: string; how?: string; by_month?: string | null; term?: string | null; priority_id?: number | null } | null
  status: GoalStatus; result: GoalResult | null; resultComment: string; fromLastReview: boolean
}
export interface TeamBlock { teamId: string; teamName: string; state: TeamPriorityState['state']; reason: string | null; sentAt: string | null; priorities: { id: number; title: string; body: string; supportsId: number | null }[] }

export interface ReviewView {
  id: number; year: number; cycle: Cycle; step: Step; phase: 1 | 2
  person: { id: string; name: string; title: string | null; teamName: string | null; hireDate: string | null; avatarUrl: string | null; teamLeaderName: string | null }
  reviewer: { id: string | null; name: string }
  role: 'person' | 'reviewer' | 'reader'
  waitsFor: string | null
  due: string | null
  template: Template
  answers: Record<string, { body: string; copied: boolean }>
  pastGoals: GoalView[]
  goals: GoalView[]
  priorities: PriorityView[]
  /** The Team Leader's own review: the teams they lead, with their priorities to write. */
  teamBlocks: TeamBlock[]
  lastImport: (ImportRow & { url: string }) | null
  canCopyJob: boolean
  dates: { selfSent: string | null; reviewSent: string | null; agreed: string | null; approved: string | null; approvedBy: string | null; opened: string | null }
  meeting: { eventId: string | null; startsAt: string | null; endsAt: string | null; notes: string; held: boolean }
  sentBack: { at: string; by: string; reason: string; from: string | null } | null
  pdf: { ready: boolean; name: string | null; drive: ReviewRow['drive_status']; driveError: string | null; driveLink: string | null }
  log: { text: string; at: string; who: string }[]
  updatedAt: string
}

const tidy = (g: Goal, n: number, pri: Map<number, string>, roster: Roster, fromLast: boolean): GoalView => ({
  id: g.id, n, what: g.what, how: g.how, byMonth: g.by_month, byLabel: monthLabel(g.by_month), term: g.term,
  priorityId: g.priority_id, priorityTitle: g.priority_id ? pri.get(g.priority_id) ?? null : null,
  addedByReviewer: g.added_by_reviewer, addedByName: g.added_by_reviewer ? nameIn(roster, g.added_by) : null,
  changedByName: g.changed_by ? nameIn(roster, g.changed_by) : null, original: g.original,
  status: g.status, result: g.result, resultComment: g.result_comment, fromLastReview: fromLast,
})

/** The review as `viewer` may see it, or null when it is not theirs to see. */
export async function loadReviewView(id: number, viewer: ReviewViewer | 'server', roster: Roster, now = new Date()): Promise<ReviewView | null> {
  const r = await loadReview(id)
  if (!r) return null
  if (viewer !== 'server' && !canSeePerson(viewer, r.person_id) && r.reviewer_id !== viewer.personId) return null
  const cycle = (await rdb().from('review_cycles').select('*').eq('id', r.cycle_id).maybeSingle()).data as Cycle | null
  if (!cycle) return null
  const [answers, nextGoals, pastGoalsAll, priorities, states, imports, history, log] = await Promise.all([
    loadAnswers(r.id),
    loadGoals({ reviewId: r.id }),
    loadGoals({ personId: r.person_id, years: [cycle.year] }),
    loadPriorities(cycle.id),
    loadTeamStates(cycle.id),
    loadImports({ personId: r.person_id }),
    loadPersonReviews(r.person_id),
    loadLog({ reviewId: r.id }, 30),
  ])
  const p = roster.people.get(r.person_id)
  const team = r.team_id ? roster.teams.get(r.team_id) : null
  const me = viewer === 'server' ? null : viewer.personId
  const role: ReviewView['role'] = me && me === r.person_id ? 'person' : me && me === r.reviewer_id ? 'reviewer' : 'reader'

  const visible = prioritiesFor(priorities, r.team_id, states)
  const priTitle = new Map(priorities.map(x => [x.id, x.title]))
  const goals = nextGoals.filter(g => g.goal_year === cycle.year + 1).map((g, i) => tidy(g, i + 1, priTitle, roster, false))
  const prev = history.find(h => h.year === cycle.year - 1) ?? null
  const pastGoals = pastGoalsAll.filter(g => g.review_id === null ? g.marked_in === r.id : true).map((g, i) => tidy(g, i + 1, priTitle, roster, g.review_id !== null))
  const served = (pid: number) => goals.filter(g => g.priorityId === pid).length
  const prioritiesView: PriorityView[] = visible.map((x, i) => ({
    id: x.id, n: i + 1, scope: x.team_id ? roster.teams.get(x.team_id)?.name ?? 'Team' : 'Whole company', teamId: x.team_id, title: x.title, body: x.body, goals: served(x.id),
  }))

  const leads = roster.members.filter(m => m.personId === r.person_id && ['lead', 'founder', 'manager', 'team_leader'].includes(m.position ?? '')).map(m => m.teamId)
  const teamBlocks: TeamBlock[] = leads.filter(t => roster.teams.has(t)).map(t => {
    const st = states.get(t)
    return {
      teamId: t, teamName: roster.teams.get(t)!.name, state: st?.state ?? 'draft', reason: st?.state === 'returned' ? st.return_reason : null, sentAt: st?.sent_at ?? null,
      priorities: priorities.filter(x => x.team_id === t).map(x => ({ id: x.id, title: x.title, body: x.body, supportsId: x.supports_id })),
    }
  })

  const lastImport = imports.filter(i => i.year === cycle.year - 1).sort((a, b) => (b.imported_at ?? '').localeCompare(a.imported_at ?? ''))[0] ?? null
  const ans: ReviewView['answers'] = {}
  for (const [k, a] of answers) ans[k] = { body: a.body, copied: a.copied }

  const teamLeader = r.phase === 2 ? nameIn(roster, r.reviewer_id) : null
  const held = !!r.meeting_ends_at && new Date(r.meeting_ends_at) <= now
  return {
    id: r.id, year: cycle.year, cycle, step: r.step, phase: r.phase,
    person: { id: r.person_id, name: p?.name ?? 'Someone', title: p?.title ?? null, teamName: team?.name ?? null, hireDate: p?.hireDate ?? null, avatarUrl: p?.avatarUrl ?? null, teamLeaderName: teamLeader },
    reviewer: { id: r.reviewer_id, name: nameIn(roster, r.reviewer_id) || 'Nobody yet' },
    role,
    waitsFor: waitsFor({ step: r.step, personId: r.person_id, reviewerId: r.reviewer_id, meetingEndsAt: r.meeting_ends_at, agreedAt: r.agreed_at }, now),
    due: dueOf(r.step, r.phase, cycle),
    template: templateFor(cycle.year),
    answers: ans,
    pastGoals,
    goals,
    priorities: prioritiesView,
    teamBlocks,
    lastImport: lastImport ? { ...lastImport, url: `/human-resources/imports/${lastImport.id}/file` } : null,
    canCopyJob: !!prev,
    dates: { selfSent: r.self_sent_at, reviewSent: r.review_sent_at, agreed: r.agreed_at, approved: r.approved_at, approvedBy: r.approved_by ? nameIn(roster, r.approved_by) : null, opened: r.opened_at },
    meeting: { eventId: r.meeting_event_id, startsAt: r.meeting_starts_at, endsAt: r.meeting_ends_at, notes: r.meeting_notes, held },
    sentBack: r.sent_back_at && r.sent_back_reason ? { at: r.sent_back_at, by: nameIn(roster, r.sent_back_by), reason: r.sent_back_reason, from: r.sent_back_from } : null,
    pdf: { ready: r.step === 'approved', name: r.pdf_name, drive: r.drive_status, driveError: r.drive_error, driveLink: r.drive_file_id ? `https://drive.google.com/file/d/${r.drive_file_id}/view` : null },
    log: log.map(l => ({ text: l.text, at: l.created_at, who: nameIn(roster, l.actor_id) })),
    updatedAt: r.updated_at,
  }
}

/** How many of the person's own questions have an answer. */
export function answeredCount(v: Pick<ReviewView, 'template' | 'answers'>, which: 'own' | 'manager'): { done: number; total: number } {
  const secs = v.template.sections.filter(s => (which === 'manager' ? s.key === 'manager' : s.key !== 'manager'))
  const keys = secs.flatMap(s => s.questions.map(q => q.key))
  return { done: keys.filter(k => (v.answers[k]?.body ?? '').trim()).length, total: keys.length }
}

export { loadCycle }
