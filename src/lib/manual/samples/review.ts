/**
 * The System manual's annual review pictures (owner, 4 November 2026: the
 * guides show the real screens with made-up data). Everyone here is invented,
 * and so is every answer, goal and note; no real review is shown. Alex Rivera,
 * a writer, is reviewed by Jordan Lee, the Writers' Team Leader. Seen on
 * Tue, Nov 10, 2026, in the 2026 cycle.
 */

import type { ReviewView, GoalView, PriorityView } from '@/lib/review/view'
import type { Cycle } from '@/lib/review/data'
import type { ReviewCard } from '@/lib/review/mine'
import type { GoalsView, HistoryRow, TeamGoalRow } from '@/lib/review/mine'
import type { ListRow, StartCheck } from '@/components/review/ReviewList'
import type { PriorityRow, TeamRow } from '@/components/review/PrioritiesPage'
import { templateFor } from '@/lib/review/template'

export const REVIEW_TODAY = '2026-11-10'

export const CYCLE: Cycle = {
  id: 1, year: 2026, started_at: '2026-11-02T14:00:00Z', started_by: 'p-chris',
  leaders_open_on: '2026-11-02', leaders_due: '2026-11-13', teams_open_by: '2026-11-16',
  self_due: '2026-11-30', review_due: '2026-12-07', meeting_due: '2026-12-14', approval_due: '2026-12-18', checkins_by: '2027-06-30',
}

const PRIORITIES: PriorityView[] = [
  { id: 1, n: 1, scope: 'Whole company', teamId: null, title: 'Grow organic reach', body: 'More readers find the client sites through search.', goals: 2 },
  { id: 2, n: 2, scope: 'Whole company', teamId: null, title: 'Ship on time', body: 'Every promised date is met or moved before it is missed.', goals: 1 },
  { id: 3, n: 3, scope: 'Writers', teamId: 't-Writers', title: 'One editorial voice', body: 'Every article reads like the same careful writer wrote it.', goals: 1 },
]

const goal = (g: Partial<GoalView> & Pick<GoalView, 'id' | 'n' | 'what'>): GoalView => ({
  how: '', byMonth: null, byLabel: '', term: null, priorityId: null, priorityTitle: null,
  addedByReviewer: false, addedByName: null, changedByName: null, original: null,
  status: 'not_started', result: null, resultComment: '', fromLastReview: true, ...g,
})

const PAST: GoalView[] = [
  goal({ id: 11, n: 1, what: 'Publish 8 long-form articles a month', how: 'Counted on the publishing board', byMonth: '2026-10-01', byLabel: 'October 2026', term: '1y', result: 'met', resultComment: 'Averaged 9 a month from March on.' }),
  goal({ id: 12, n: 2, what: 'Finish the style guide course', how: 'Certificate uploaded', byMonth: '2026-06-01', byLabel: 'June 2026', term: '6m', result: 'partly', resultComment: 'Two of the three modules done; the last one is booked for December.' }),
  goal({ id: 13, n: 3, what: 'Edit the Translation team\'s English drafts', how: 'Every draft edited within two days', byMonth: '2026-09-01', byLabel: 'September 2026', term: '1y', result: null }),
]

const GOALS: GoalView[] = [
  goal({ id: 21, n: 1, what: 'Write 10 search-led articles a month', how: 'Counted on the publishing board, with the target keyword', byMonth: '2027-10-01', byLabel: 'October 2027', term: '1y', priorityId: 1, priorityTitle: 'Grow organic reach', fromLastReview: false }),
  goal({ id: 22, n: 2, what: 'Hand every article in by its due date', how: 'Due dates met on the board, month by month', byMonth: '2027-06-01', byLabel: 'June 2027', term: '6m', priorityId: 2, priorityTitle: 'Ship on time', fromLastReview: false }),
]

function view(step: ReviewView['step'], role: ReviewView['role']): ReviewView {
  const after = step === 'meeting' || step === 'approval' || step === 'approved'
  const answers: ReviewView['answers'] = {
    job_current: { body: 'Long-form articles for two client sites, and the first edit of the Translation team\'s English drafts.', copied: false },
    job_initial: { body: 'A writer for one client site, four articles a month.', copied: false },
    self_strengths: { body: 'Research. The March series on search habits was the most read of the year.', copied: false },
    self_accomplishments: { body: 'Took on a second client site in April without missing a date.', copied: false },
  }
  if (step !== 'self') {
    Object.assign(answers, {
      job_alignment: { body: 'Close to the role; the editing grew on its own and should be named.', copied: false },
      job_success: { body: 'Articles published on time and ranking within three months.', copied: false },
      self_challenges: { body: 'Late briefs in the summer.', copied: false },
      self_improve: { body: 'Shorter first drafts.', copied: false },
      self_plan: { body: 'Finish the style guide course and pair with Jordan on outlines.', copied: false },
      self_support: { body: 'Briefs a week before the writing starts.', copied: false },
      fb_company: { body: 'One shared calendar for client launches.', copied: false },
      fb_other: { body: 'Thank you for the flexible hours this year.', copied: false },
      mgr_summary: { body: 'A strong year: more output, same quality, and a second site taken on calmly.', copied: false },
      mgr_strengths: { body: 'Research and reliability.', copied: false },
      mgr_develop: { body: 'Outlines agreed before the first draft.', copied: false },
      mgr_alignment: { body: 'Both goals serve the company priorities directly.', copied: false },
      mgr_support: { body: 'Briefs a week ahead, and time for the course.', copied: false },
    })
  }
  const goals = step === 'self' ? GOALS : [
    ...GOALS.map(g => g.id === 22 ? { ...g, changedByName: 'Jordan Lee', original: { what: 'Hand most articles in on time' } } : g),
    goal({ id: 23, n: 3, what: 'Lead the monthly outline review', how: 'Held every month with the Writers', byMonth: '2027-12-01', byLabel: 'December 2027', term: '1y', priorityId: 3, priorityTitle: 'One editorial voice', addedByReviewer: true, addedByName: 'Jordan Lee', fromLastReview: false }),
  ]
  return {
    id: 7, year: 2026, cycle: CYCLE, step, phase: 2,
    person: { id: 'p-alex', name: 'Alex Rivera', title: 'Writer', teamName: 'Writers', hireDate: '2024-11-18', avatarUrl: null, teamLeaderName: 'Jordan Lee' },
    reviewer: { id: 'p-jordan', name: 'Jordan Lee' },
    role, waitsFor: null,
    due: step === 'self' ? CYCLE.self_due : step === 'review' ? CYCLE.review_due : step === 'meeting' ? CYCLE.meeting_due : step === 'approval' ? CYCLE.approval_due : null,
    template: templateFor(2026), answers,
    pastGoals: step === 'self' ? PAST : PAST.map(g => g.result ? g : { ...g, result: 'met' as const, resultComment: 'Every draft edited within two days since May.' }),
    goals, priorities: PRIORITIES, teamBlocks: [], approvers: ['Chris Taylor', 'Priya Nair'],
    hr: 'Maria Gomez', driveFolder: 'Annual Performance Reviews', lastImport: null, canCopyJob: false,
    dates: {
      selfSent: step === 'self' ? null : '2026-11-24T16:00:00Z', reviewSent: after ? '2026-12-03T15:00:00Z' : null,
      agreed: step === 'approval' || step === 'approved' ? '2026-12-10T19:00:00Z' : null,
      approved: step === 'approved' ? '2026-12-11T15:00:00Z' : null, approvedBy: step === 'approved' ? 'Jordan Lee' : null, opened: '2026-11-16T12:00:00Z',
    },
    meeting: after
      ? { eventId: 'e-7', startsAt: '2026-12-09T15:00:00Z', endsAt: '2026-12-09T15:45:00Z', notes: 'We went through every goal. Alex will lead the outline review from January; Jordan sends briefs a week ahead.', held: true, how: 'online', place: null }
      : { eventId: null, startsAt: null, endsAt: null, notes: '', held: false, how: null, place: null },
    sentBack: null,
    pdf: { ready: step === 'approved', name: step === 'approved' ? '2026.12 - Alex Rivera.pdf' : null, drive: step === 'approved' ? 'saved' : null, driveError: null, driveLink: null },
    log: [], updatedAt: '2026-11-10T15:00:00Z',
  }
}

/** Alex writing the self-review (step 1). */
export const selfReviewSample = () => view('self', 'person')
/** Jordan reviewing Alex's self-review (step 2). */
export const managerReviewSample = () => view('review', 'reviewer')
/** Alex after the meeting, about to read and agree (step 3). */
export const agreeSample = () => view('meeting', 'person')
/** Jordan about to approve (step 4). */
export const approvalSample = () => view('approval', 'reviewer')

export const pastGoalsSample = () => PAST
export const goalsSample = () => GOALS
export const prioritiesSample = () => PRIORITIES

const STEPS = (now: number): ReviewCard['steps'] => ['Self-review', 'Review', 'Meeting', 'Approval'].map((label, i) => ({ label, state: i < now ? 'done' : i === now ? 'now' : 'next' }))

/** The review card at the top of Human Resources and Home. */
export function reviewCardSample(state: 'progress' | 'agree'): ReviewCard {
  return state === 'progress'
    ? { state, year: 2026, title: 'Self-review due Mon, Nov 30', sub: '4 of 12 questions answered, 2 goals. Due in 20 days.', button: 'Continue', href: '/human-resources/reviews/7', steps: STEPS(0) }
    : { state, year: 2026, title: 'Read and agree', sub: 'The meeting was today. Read the notes and the goals, then agree.', button: 'Read and agree', href: '/human-resources/reviews/7', steps: STEPS(2) }
}

/** My reviews: last year's approved review and the year before, imported. */
export function historySample(): HistoryRow[] {
  return [
    { key: 'r7', year: 2026, kind: 'open', line: 'In progress: self-review', href: '/human-resources/reviews/7', pdf: false },
    { key: 'i3', year: 2025, kind: 'imported', line: 'Imported from Google Drive on Oct 28', href: '/human-resources/imports/3/file', pdf: true },
  ]
}

/** My goals: the goals agreed in the last approved review, during the year. */
export function myGoalsSample(): GoalsView {
  return {
    year: 2027, reviewYear: 2026, reviewId: 7, personId: 'p-alex', manager: { id: 'p-jordan', name: 'Jordan Lee' }, checkinsBy: '2027-06-30',
    checkin: { at: null, finished: null, eventId: null }, summary: '1 on track · 1 at risk',
    goals: [
      { id: 21, n: 1, what: 'Write 10 search-led articles a month', how: 'Counted on the publishing board, with the target keyword', by: 'October 2027', term: '1 year', serves: 'Grow organic reach', status: 'on_track', dueNote: null,
        lastUpdate: { at: '2027-03-02T15:00:00Z', body: 'Eleven in February, all with their keyword.', status: 'on_track' },
        comments: [{ who: 'Jordan Lee', body: 'Great pace. Keep the keyword list current.', at: '2027-03-03T15:00:00Z', checkin: false }] },
      { id: 22, n: 2, what: 'Hand every article in by its due date', how: 'Due dates met on the board, month by month', by: 'June 2027', term: '6 months', serves: 'Ship on time', status: 'at_risk', dueNote: 'Due in 3 months',
        lastUpdate: { at: '2027-03-02T15:00:00Z', body: 'Two late in February, both waiting on client approval.', status: 'at_risk' }, comments: [] },
    ],
  }
}

/** My team's goals, as Jordan sees them. */
export function teamGoalsSample(): TeamGoalRow[] {
  return [
    { personId: 'p-alex', name: 'Alex Rivera', title: 'Writer', goals: 3, summary: '2 on track · 1 at risk', checkin: { label: 'To book', state: 'book' }, lastUpdate: '2027-03-02T15:00:00Z' },
    { personId: 'p-ben', name: 'Ben Carter', title: 'Designer', goals: 2, summary: '1 done · 1 on track', checkin: { label: 'Booked Jun 12', state: 'booked' }, lastUpdate: '2027-02-20T15:00:00Z' },
  ]
}

/** Human Resources, Reviews: the year's list, as HR sees it. */
export function reviewListSample(): ListRow[] {
  const row = (r: Partial<ListRow> & Pick<ListRow, 'id' | 'name' | 'sub' | 'team' | 'step' | 'waits'>): ListRow => ({ personId: `p-${r.id}`, leader: null, sentBack: false, booked: null, due: null, dueText: '', late: false, approvedOn: null, drive: null, ...r })
  return [
    row({ id: 1, name: 'Ben Carter', sub: 'Designer', team: 'Graphics', step: 'self', waits: 'Ben Carter', due: '2026-11-13', dueText: 'Fri, Nov 13' }),
    row({ id: 2, name: 'Alex Rivera', sub: 'Writer', team: 'Writers', leader: 'Jordan Lee', step: 'self', waits: 'Alex Rivera', due: '2026-11-30', dueText: 'Mon, Nov 30' }),
    row({ id: 3, name: 'Sam Patel', sub: 'SEO Specialist', team: 'SEO', step: 'review', waits: 'Chris Taylor', due: '2026-12-07', dueText: 'Mon, Dec 7' }),
    row({ id: 4, name: 'Jordan Lee', sub: 'Lead Writer', team: 'Writers', step: 'meeting', waits: 'Chris Taylor, to book', due: '2026-12-14', dueText: 'Mon, Dec 14' }),
    row({ id: 5, name: 'Maria Gomez', sub: 'HR Coordinator', team: 'Leadership', step: 'approved', waits: 'Approved Nov 9', approvedOn: '2026-11-09T15:00:00Z', drive: 'saved' }),
  ]
}

/** Before the year starts: what the cycle needs, as a Super Admin sees it. */
export function startChecksSample(): StartCheck[] {
  return [
    { key: 'dates', label: 'Dates', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: 'Team Leaders open on Mon, Nov 2 · Teams open by Mon, Nov 16 · Approval by Fri, Dec 18' },
    { key: 'roles', label: 'Roles', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: 'VP of Operations: Chris Taylor · CISO: Priya Nair · HR: Maria Gomez' },
    { key: 'people', label: 'Who takes part', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: '6 employees from the Directory · 1 added' },
    { key: 'priorities', label: 'Company Priorities for 2027', ok: true, href: '/human-resources/reviews/priorities', action: 'Open', text: '2 written by Chris Taylor and Priya Nair' },
    { key: 'drive', label: 'Google Drive folder', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: 'Annual Performance Reviews / 2026' },
    { key: 'last', label: "Last year's reviews", ok: 'warn', href: '/admin/settings#human-resources', action: 'Fix it', text: '6 of 7 files imported · 1 still needs a person. It does not stop the cycle.' },
  ]
}

/** The Priorities page, as the VP of Operations sees it with the Writers' sent for approval. */
export function prioritiesPageSample(): { company: PriorityRow[]; teams: TeamRow[] } {
  return {
    company: [
      { id: 1, title: 'Grow organic reach', body: 'More readers find the client sites through search.', changed: 'Changed by Chris Taylor on Mon, Oct 26, 10:12 AM' },
      { id: 2, title: 'Ship on time', body: 'Every promised date is met or moved before it is missed.', changed: 'Changed by Priya Nair on Tue, Oct 27, 3:40 PM' },
    ],
    teams: [
      { teamId: 't-Writers', name: 'Writers', leader: 'Jordan Lee', state: 'sent', line: '1 priority, sent Thu, Nov 5.', decider: null, sentLine: 'Sent Thu, Nov 5, 4:10 PM, from their self-review', members: 2,
        priorities: [{ id: 3, title: 'One editorial voice', body: 'Every article reads like the same careful writer wrote it.', changed: null }] },
      { teamId: 't-SEO', name: 'SEO', leader: 'Sam Patel', state: 'draft', line: 'Writing them in their self-review, due Fri, Nov 13.', decider: null, sentLine: null, members: 1, priorities: [] },
    ],
  }
}
