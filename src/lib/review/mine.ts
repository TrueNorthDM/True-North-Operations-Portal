/**
 * A person's own side of the review (design handoff, C1, C2, G1 to G5): the
 * card on Human Resources and Home, their reviews by year, their goals with
 * the updates and comments, and a manager's view of the goals of the people
 * who report to them.
 */

import { cardShows, cardState, dueOf, dueWords, monthLabel, statusSummary, type CardState, type GoalStatus } from './rules'
import { answeredCount, loadReviewView } from './view'
import {
  loadCheckins, loadCurrentCycle, loadGoalUpdates, loadGoals, loadImports, loadParts, loadPersonReviews, loadPriorities, loadTeamStates, nameIn, rdb, reviewToday,
  type Cycle, type ReviewViewer, type Roster,
} from './data'
import { fmtDay, fmtInstantDay, fmtWhen } from './format'

export interface ReviewCard {
  state: CardState; year: number; title: string; sub: string; button: string; href: string
  steps: { label: string; state: 'done' | 'now' | 'next' }[]
}

const STEPS = ['self', 'review', 'meeting', 'approval'] as const

/** The card for this person's current review, or null when there is none to show. */
export async function loadMyCard(personId: string, roster: Roster, today: string, now = new Date()): Promise<ReviewCard | null> {
  const cycle = await loadCurrentCycle()
  if (!cycle?.started_at) return null
  const r = (await rdb().from('reviews').select('*').eq('cycle_id', cycle.id).eq('person_id', personId).maybeSingle()).data as import('./data').ReviewRow | null
  if (!r || !cardShows({ step: r.step, approvedAt: r.approved_at }, today)) return null
  const goals = (await rdb().from('review_goals').select('id', { count: 'exact', head: true }).eq('review_id', r.id)).count ?? 0
  let answered = 0, total = 0
  if (r.step === 'self') {
    const v = await loadReviewView(r.id, 'server', roster, now)
    if (v) ({ done: answered, total } = answeredCount(v, 'own'))
  }
  const due = dueOf(r.step, r.phase, cycle)
  const state = cardState({ step: r.step, answered, goals, due, meetingStartsAt: r.meeting_starts_at, meetingEndsAt: r.meeting_ends_at, agreedAt: r.agreed_at }, today, now)
  // With two reviewers the card names both (owner, 10 November 2026).
  const extra = await loadParts([r.id])
  const reviewer = [r.reviewer_id, ...extra.map(x => x.reviewer_id)].map(id => nameIn(roster, id)).filter(Boolean).join(' and ')
  const href = `/human-resources/reviews/${r.id}`
  const g = `${goals} ${goals === 1 ? 'goal' : 'goals'}`
  const card: Record<CardState, () => Omit<ReviewCard, 'state' | 'year' | 'steps'>> = {
    soon: () => ({ title: 'Your self-review opens soon', sub: 'It opens when the reviews start.', button: 'Open your review', href }),
    open: () => ({ title: `Self-review due ${fmtDay(due)}`, sub: `The ${cycle.year} cycle opened on ${fmtInstantDay(r.opened_at ?? cycle.started_at).replace(/^\w+, /, '')}.${due ? ` ${dueWords(due, today).replace(/^./, c => c.toUpperCase())}.` : ''}`, button: 'Start your self-review', href }),
    progress: () => ({ title: `Self-review due ${fmtDay(due)}`, sub: `${answered} of ${total} questions answered, ${g}.${due ? ` ${dueWords(due, today).replace(/^./, c => c.toUpperCase())}.` : ''}`, button: 'Continue', href }),
    late: () => ({ title: `Self-review was due ${fmtDay(due)}`, sub: `${dueWords(due!, today).replace(/^./, c => c.toUpperCase())}. ${reviewer} can see that it is late.`, button: 'Continue', href }),
    with_reviewer: () => ({ title: `With ${reviewer} for ${r.step === 'approval' ? 'approval' : 'review'}`, sub: r.step === 'approval' ? `You agreed on ${fmtInstantDay(r.agreed_at)}. Nothing to do now.` : `You sent your self-review on ${fmtInstantDay(r.self_sent_at).replace(/^\w+, /, '')}. Nothing to do now.`, button: 'Open your review', href }),
    booked: () => ({ title: `Meeting on ${fmtWhen(r.meeting_starts_at).replace(/, \d{4}/, '')}`, sub: `With ${reviewer}, on Google Meet. After it, you read the review and agree.`, button: 'Open your review', href }),
    agree: () => {
      const held = r.meeting_ends_at ? reviewToday(new Date(r.meeting_ends_at)) : null
      return { title: 'Read and agree', sub: `${held === today || !held ? 'The meeting was today.' : `The meeting was on ${fmtDay(held)}.`} Read the notes and the goals, then agree.`, button: 'Read and agree', href }
    },
    approved: () => ({ title: `Approved on ${fmtInstantDay(r.approved_at)}`, sub: `Approved by ${reviewer}. Your goals are on your profile; the PDF is ready.`, button: 'Open your review', href }),
  }
  const cur = r.step === 'approved' ? 4 : r.step === 'waiting' ? -1 : STEPS.indexOf(r.step as (typeof STEPS)[number])
  return {
    state, year: cycle.year, ...card[state](),
    steps: STEPS.map((s, i) => ({ label: s === 'self' ? 'Self-review' : s === 'review' ? 'Review' : s === 'meeting' ? 'Meeting' : 'Approval', state: i < cur ? 'done' : i === cur ? 'now' : 'next' })),
  }
}

// ── My reviews ─────────────────────────────────────────────────────────────

export interface HistoryRow { key: string; year: number; kind: 'approved' | 'imported' | 'open'; line: string; href: string; pdf: boolean
  /** The review's own page, beside its PDF (an approved review: Open and PDF, design handoff G1). */
  page?: string }

export async function loadHistory(personId: string, roster: Roster): Promise<HistoryRow[]> {
  const [reviews, imports] = await Promise.all([loadPersonReviews(personId), loadImports({ personId })])
  const out: HistoryRow[] = reviews.filter(r => r.year).map(r => r.step === 'approved'
    ? { key: `r${r.id}`, year: r.year, kind: 'approved' as const, line: `Approved by ${nameIn(roster, r.approved_by)} on ${fmtInstantDay(r.approved_at, true)}${r.drive_status === 'saved' ? ` · in Google Drive, Annual Performance Reviews / ${r.year}` : ''}`, href: `/human-resources/reviews/${r.id}/pdf`, pdf: true, page: `/human-resources/reviews/${r.id}` }
    : { key: `r${r.id}`, year: r.year, kind: 'open' as const, line: r.step === 'waiting' ? 'Opens soon' : `In progress: ${r.step === 'self' ? 'self-review' : r.step}`, href: `/human-resources/reviews/${r.id}`, pdf: false })
  for (const i of imports) if (!out.some(o => o.year === i.year)) out.push({ key: `i${i.id}`, year: i.year, kind: 'imported', line: `The review from Google Drive · ${i.file_name}`, href: `/human-resources/imports/${i.id}/file`, pdf: true })
  return out.sort((a, b) => b.year - a.year)
}

// ── Goals during the year ──────────────────────────────────────────────────

export interface GoalItem {
  id: number; n: number; what: string; how: string; by: string; term: string; serves: string | null; status: GoalStatus
  dueNote: string | null
  lastUpdate: { at: string; body: string; status: GoalStatus | null } | null
  comments: { who: string; body: string; at: string; checkin: boolean }[]
}
export interface GoalsView { year: number; reviewYear: number; reviewId: number; personId: string; manager: { id: string | null; name: string }; checkinsBy: string | null; checkin: { at: string | null; finished: string | null; eventId: string | null }; goals: GoalItem[]; summary: string }

/** The goals agreed in the person's latest approved review, with their updates and the manager's comments. */
export async function loadGoalsView(personId: string, roster: Roster, today: string, currentManager: string | null): Promise<GoalsView | null> {
  const reviews = await loadPersonReviews(personId)
  const run = reviews.find(r => r.step === 'approved')
  if (!run) return null
  const cycle = (await rdb().from('review_cycles').select('*').eq('id', run.cycle_id).maybeSingle()).data as Cycle | null
  if (!cycle) return null
  const [goals, priorities, checkins] = await Promise.all([loadGoals({ reviewId: run.id }), loadPriorities(cycle.id), loadCheckins(cycle.id, [personId])])
  const mine = goals.filter(g => g.goal_year === cycle.year + 1)
  const updates = await loadGoalUpdates(mine.map(g => g.id))
  const pri = new Map(priorities.map(p => [p.id, p.title]))
  const ck = checkins.get(personId)
  const items: GoalItem[] = mine.map((g, i) => {
    const ups = updates.filter(u => u.goal_id === g.id)
    const last = ups.find(u => u.kind === 'update') ?? null
    const end = g.by_month ? `${g.by_month.slice(0, 7)}-${String(new Date(Date.UTC(Number(g.by_month.slice(0, 4)), Number(g.by_month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}` : null
    const days = end ? Math.round((Date.parse(end) - Date.parse(today)) / 864e5) : null
    let dueNote: string | null = null
    if (end && days !== null && g.status !== 'done' && g.status !== 'dropped') {
      if (days < 0) dueNote = `Was due in ${monthLabel(g.by_month).split(' ')[0]}`
      else if (days <= 31) dueNote = `Due in ${monthLabel(g.by_month).split(' ')[0]} · reminders on ${[7, 3, 0].map(n => fmtDay(new Date(Date.parse(end) - n * 864e5).toISOString().slice(0, 10)).replace(/^\w+, /, '')).join(', ').replace(/, ([^,]*)$/, ' and $1')}`
      else if (days <= 62) dueNote = `Due next month · first reminder on ${fmtDay(new Date(Date.parse(end) - 7 * 864e5).toISOString().slice(0, 10)).replace(/^\w+, /, '')}`
    }
    return {
      id: g.id, n: i + 1, what: g.what, how: g.how, by: monthLabel(g.by_month), term: g.term === '6m' ? '6 months' : g.term === '1y' ? '1 year' : '', serves: g.priority_id ? pri.get(g.priority_id) ?? null : null,
      status: g.status, dueNote,
      lastUpdate: last ? { at: last.created_at, body: last.body, status: last.status } : null,
      comments: ups.filter(u => u.kind !== 'update').slice(0, 3).map(u => ({ who: nameIn(roster, u.author_id), body: u.body, at: u.created_at, checkin: u.kind === 'checkin' })),
    }
  })
  return {
    year: cycle.year + 1, reviewYear: cycle.year, reviewId: run.id, personId, manager: { id: currentManager, name: nameIn(roster, currentManager) },
    checkinsBy: cycle.checkins_by, checkin: { at: ck?.starts_at ?? null, finished: ck?.finished_at ?? null, eventId: ck?.event_id ? String(ck.event_id) : null },
    goals: items, summary: statusSummary(items.map(g => g.status)),
  }
}

export interface TeamGoalRow { personId: string; name: string; title: string | null; goals: number; summary: string; checkin: { label: string; state: 'book' | 'booked' | 'done' }; lastUpdate: string | null }

export async function loadTeamGoals(viewer: ReviewViewer, roster: Roster, today: string): Promise<TeamGoalRow[]> {
  const out: TeamGoalRow[] = []
  for (const personId of viewer.reports) {
    const g = await loadGoalsView(personId, roster, today, viewer.personId)
    if (!g) continue
    const last = g.goals.map(x => x.lastUpdate?.at).filter((x): x is string => !!x).sort().pop() ?? null
    const p = roster.people.get(personId)
    out.push({
      personId, name: p?.name ?? 'Someone', title: p?.title ?? null, goals: g.goals.length, summary: g.summary || 'No goals',
      checkin: g.checkin.finished ? { label: `Done ${fmtInstantDay(g.checkin.finished).replace(/^\w+, /, '')}`, state: 'done' } : g.checkin.at ? { label: `Booked ${fmtInstantDay(g.checkin.at).replace(/^\w+, /, '')}`, state: 'booked' } : { label: g.checkinsBy ? `Book by ${fmtDay(g.checkinsBy).replace(/^\w+, /, '')}` : 'Book', state: 'book' },
      lastUpdate: last,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export { loadTeamStates }
