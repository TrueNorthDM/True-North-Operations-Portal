/**
 * One review, read for the page, the PDF and the Drive copy (design handoff,
 * 3 November 2026, C3 to F1). Plain data: names instead of ids, dates as
 * stored, what the viewer may do worked out here, once.
 */

import { managerKeys, templateFor, type Template } from './template'
import {
  dueOf, isLeadPositionName, monthLabel, type GoalResult, type GoalStatus, type Step,
} from './rules'
import {
  canSeePerson, loadAnswers, loadCycle, loadHrSettings, loadGoals, loadImports, loadLog, loadParts, loadPersonReviews, loadPriorities, loadReview, loadTeamStates,
  nameIn, prioritiesFor, type Cycle, type Goal, type ImportRow, type ReviewRow, type ReviewViewer, type Roster, type TeamPriorityState,
} from './data'
import { rdb } from './data'
import { partsOf, partWaitsFor, type PartNo, type PartStep } from './parts'
import { goalsOpen } from './schedule'

export interface PriorityView { id: number; n: number; scope: string; teamId: string | null; kind: 'company' | 'vp' | 'team'; title: string; body: string; goals: number
  /** At the 6-month check-in. */
  mid: { status: 'same' | 'changed' | 'added'; note: string } | null }
export interface GoalView {
  id: number; n: number; what: string; how: string; byMonth: string | null; byLabel: string; term: '6m' | '1y' | null
  priorityId: number | null; priorityTitle: string | null
  addedByReviewer: boolean; addedByName: string | null; changedByName: string | null
  original: { what?: string; how?: string; by_month?: string | null; term?: string | null; priority_id?: number | null } | null
  status: GoalStatus; result: GoalResult | null; resultComment: string; fromLastReview: boolean
  /** With two reviewers: the part (reviewer) it is for. */
  part: PartNo | null
}
export interface TeamBlock { teamId: string; teamName: string; state: TeamPriorityState['state']; reason: string | null; sentAt: string | null; priorities: { id: number; title: string; body: string; supportsId: number | null }[] }

/** One reviewer's part of the review (two reviewers, owner, 10 November 2026). */
export interface PartView {
  no: PartNo
  reviewer: { id: string | null; name: string }
  /** "Social Media", "SEO"; empty with one reviewer. */
  area: string
  lane: 1 | 2
  step: PartStep
  due: string | null
  waitsFor: string | null
  /** The viewer is this part's reviewer. */
  mine: boolean
  /** The reviewer's answers (the Manager's Feedback). */
  answers: Record<string, { body: string; copied: boolean }>
  dates: { reviewSent: string | null; agreed: string | null; approved: string | null; approvedBy: string | null }
  meeting: { eventId: string | null; startsAt: string | null; endsAt: string | null; notes: string; held: boolean; how: 'online' | 'in_person' | null; place: string | null }
  sentBack: { at: string; by: string; reason: string; from: string | null } | null
}

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
  /** Who approves team priorities: the VP of Operations and the CISO, by name. */
  approvers: string[]
  /** Every reviewer's part, the first one first. reviewer, dates, meeting and sentBack above are the first part's. */
  parts: PartView[]
  /** The viewer's own part, when they are one of the reviewers. */
  myPart: PartNo | null
  /** The goals for next year can be written: the priorities are ready (schedule.ts goalsOpen). */
  goalsOpen: boolean
  /** The person has read the "approved" window. */
  approvedSeen: boolean
  /** HR by name and the Drive folder the approved PDF goes to, for the approval's words (design handoff, E3). */
  hr: string | null; driveFolder: string | null
  lastImport: (ImportRow & { url: string }) | null
  canCopyJob: boolean
  dates: { selfSent: string | null; reviewSent: string | null; agreed: string | null; approved: string | null; approvedBy: string | null; opened: string | null }
  meeting: { eventId: string | null; startsAt: string | null; endsAt: string | null; notes: string; held: boolean
    /** From the Agenda event: online (Google Meet) or in person, and where. */
    how: 'online' | 'in_person' | null; place: string | null }
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
  status: g.status, result: g.result, resultComment: g.result_comment, fromLastReview: fromLast, part: g.part ?? null,
})

const eventPlace = async (id: string | null) => id ? (await rdb().from('agenda_events').select('how, place').eq('id', id).maybeSingle()).data as { how: string | null; place: string | null } | null : null

/** The review as `viewer` may see it, or null when it is not theirs to see. */
export async function loadReviewView(id: number, viewer: ReviewViewer | 'server', roster: Roster, now = new Date()): Promise<ReviewView | null> {
  const r = await loadReview(id)
  if (!r) return null
  if (viewer !== 'server' && !canSeePerson(viewer, r.person_id)) return null
  const cycle = (await rdb().from('review_cycles').select('*').eq('id', r.cycle_id).maybeSingle()).data as Cycle | null
  if (!cycle) return null
  const [answers, answers1, extra, nextGoals, pastGoalsAll, priorities, states, imports, history, log] = await Promise.all([
    loadAnswers(r.id),
    loadAnswers(r.id, 1),
    loadParts([r.id]),
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
  const firstArea = r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : ''
  const rawParts = partsOf(r, extra, firstArea)
  const myPart = me ? rawParts.find(x => x.reviewerId === me)?.no ?? null : null
  const role: ReviewView['role'] = me && me === r.person_id ? 'person' : myPart !== null ? 'reviewer' : 'reader'

  // Their team's priorities: every team they are in, so someone with two reviewers sees both teams'.
  const myTeams = [r.team_id, ...roster.members.filter(m => m.personId === r.person_id).map(m => m.teamId)]
  const visible = prioritiesFor(priorities, myTeams)
  const priTitle = new Map(priorities.map(x => [x.id, x.title]))
  const goals = nextGoals.filter(g => g.goal_year === cycle.year + 1).map((g, i) => tidy(g, i + 1, priTitle, roster, false))
  const prev = history.find(h => h.year === cycle.year - 1) ?? null
  // Last year's goals: agreed in last year's review, or read from last year's file (marked_in still empty until marked).
  const pastGoals = pastGoalsAll.filter(g => g.review_id === null ? g.marked_in === r.id || g.marked_in === null : true).map((g, i) => tidy(g, i + 1, priTitle, roster, g.review_id !== null))
  const served = (pid: number) => goals.filter(g => g.priorityId === pid).length
  const prioritiesView: PriorityView[] = visible.map((x, i) => ({
    id: x.id, n: i + 1, scope: x.team_id ? roster.teams.get(x.team_id)?.name ?? 'Team' : x.kind === 'vp' ? 'VP of Operations' : 'Whole company', teamId: x.team_id, kind: x.kind ?? (x.team_id ? 'team' : 'company'),
    title: x.title, body: x.body, goals: served(x.id), mid: x.mid_status ? { status: x.mid_status, note: x.mid_note ?? '' } : null,
  }))

  const leads = roster.members.filter(m => m.personId === r.person_id && isLeadPositionName(m.position)).map(m => m.teamId)
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
  const hrSet = await loadHrSettings()
  const held = !!r.meeting_ends_at && new Date(r.meeting_ends_at) <= now
  const ev = await eventPlace(r.meeting_event_id)
  const mgr = managerKeys(templateFor(cycle.year))
  const partViews: PartView[] = await Promise.all(rawParts.map(async x => {
    const pe = x.no === 0 ? ev : await eventPlace(x.meetingEventId)
    const src = x.no === 0 ? answers : answers1
    const ans: PartView['answers'] = {}
    for (const [k, a] of src) if (mgr.has(k)) ans[k] = { body: a.body, copied: a.copied }
    return {
      no: x.no, reviewer: { id: x.reviewerId, name: nameIn(roster, x.reviewerId) || 'Nobody yet' }, area: x.area, lane: x.lane, step: x.step,
      due: dueOf(x.step === 'waiting' ? 'self' : x.step, x.lane, cycle),
      waitsFor: x.step === 'waiting' ? (r.step === 'self' ? r.person_id : null) : partWaitsFor(x, r.person_id, now),
      mine: !!me && x.reviewerId === me,
      answers: ans,
      dates: { reviewSent: x.reviewSentAt, agreed: x.agreedAt, approved: x.approvedAt, approvedBy: x.approvedBy ? nameIn(roster, x.approvedBy) : null },
      meeting: { eventId: x.meetingEventId, startsAt: x.meetingStartsAt, endsAt: x.meetingEndsAt, notes: x.meetingNotes, held: !!x.meetingEndsAt && new Date(x.meetingEndsAt) <= now,
        how: pe?.how === 'online' || pe?.how === 'in_person' ? pe.how : null, place: pe?.place ?? null },
      sentBack: x.sentBack ? { at: x.sentBack.at, by: nameIn(roster, x.sentBack.by), reason: x.sentBack.reason, from: x.sentBack.from } : null,
    }
  }))
  // Who the review waits for now: the person in the self-review, else the first part still open.
  const open = partViews.find(x => x.step !== 'approved' && x.waitsFor)
  return {
    id: r.id, year: cycle.year, cycle, step: r.step, phase: r.phase,
    person: { id: r.person_id, name: p?.name ?? 'Someone', title: p?.title ?? null, teamName: team?.name ?? null, hireDate: p?.hireDate ?? null, avatarUrl: p?.avatarUrl ?? null, teamLeaderName: teamLeader },
    reviewer: { id: r.reviewer_id, name: nameIn(roster, r.reviewer_id) || 'Nobody yet' },
    role,
    waitsFor: r.step === 'self' ? r.person_id : r.step === 'approved' ? null : open?.waitsFor ?? null,
    due: r.step === 'self' ? dueOf('self', r.phase, cycle) : open?.due ?? null,
    template: templateFor(cycle.year),
    answers: ans,
    pastGoals,
    goals,
    priorities: prioritiesView,
    teamBlocks,
    parts: partViews,
    myPart,
    goalsOpen: goalsOpen(cycle, todayIn(now)),
    approvedSeen: !!r.approved_seen_at,
    hr: hrSet.hrId ? nameIn(roster, hrSet.hrId) : null, driveFolder: hrSet.driveFolderName,
    approvers: teamBlocks.length ? await loadHrSettings().then(h => [h.vpId, h.cisoId].filter((x): x is string => !!x && x !== r.person_id).map(x => nameIn(roster, x))) : [],
    lastImport: lastImport ? { ...lastImport, url: `/human-resources/imports/${lastImport.id}/file` } : null,
    canCopyJob: !!prev || !!lastImport?.found && Object.values(lastImport.found.job ?? {}).some(Boolean),
    dates: { selfSent: r.self_sent_at, reviewSent: r.review_sent_at, agreed: r.agreed_at, approved: r.approved_at, approvedBy: r.approved_by ? nameIn(roster, r.approved_by) : null, opened: r.opened_at },
    meeting: { eventId: r.meeting_event_id, startsAt: r.meeting_starts_at, endsAt: r.meeting_ends_at, notes: r.meeting_notes, held, how: ev?.how === 'online' || ev?.how === 'in_person' ? ev.how : null, place: ev?.place ?? null },
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

const todayIn = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
