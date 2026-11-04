'use server'

/**
 * The annual review's actions (design handoff, 3 November 2026). Each one
 * finds the signed-in person (writerAccess: a verified session, never a View
 * Stage preview) and decides from the review itself who may do what:
 *
 *   the person      writes their self-review while it is theirs (step 1),
 *                   reads and agrees after the meeting, updates their goals;
 *   the reviewer    the one they report to now: reviews, sends back, books
 *                   the meeting, writes the notes, approves, comments on goals
 *                   and holds the 6-month check-in;
 *   VP and CISO     the Company Priorities and each team's approval;
 *   a Team Leader   their team's priorities, inside their own self-review;
 *   Super Admin     starts the cycle.
 *
 * Every refusal is a sentence for the toast; every write stamps who and when.
 */

import { revalidatePath } from 'next/cache'
import { allowedTo, writerAccess } from '@/lib/access/resolve'
import {
  addLog, loadCycle, loadHrSettings, loadImports, loadPriorities, loadReview, loadRoster, loadTeamStates, nameIn,
  currentReviewerOf, rdb, rosterParticipants, syncCycle, viewerOf, type Cycle, type Goal, type ReviewRow,
} from '@/lib/review/data'
import { ownKeys, managerKeys, templateFor, JOB_KEYS } from '@/lib/review/template'
import { decidesTeam, stepBack, type GoalResult, type GoalStatus, type Step } from '@/lib/review/rules'
import { firstName, noticeOnce } from '@/lib/review/notify'
import { reviewMails } from '@/lib/review/emails'
import { approveReviewWork, copyReviewToDrive, sendOpenedNotices } from '@/lib/review/service'

export type Done = { ok: true; toast?: string; savedAt?: string; id?: number } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const GONE = 'This review is not there any more. Reload the page.'
const stamp = () => new Date().toISOString()
const refresh = () => revalidatePath('/human-resources', 'layout')

/** The signed-in person, with the review roles worked out from Company settings and the Directory. */
async function actor() {
  const access = await writerAccess()
  if (!access?.personId) return null
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const parts = rosterParticipants(roster, settings)
  return { access, settings, roster, parts, viewer: viewerOf(access, settings, parts), me: access.personId }
}
type Actor = NonNullable<Awaited<ReturnType<typeof actor>>>

/** The review and its year, with who the actor is on it. */
async function onReview(id: unknown) {
  const a = await actor()
  if (!a) return { error: 'Sign in again to do this.' } as const
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return { error: GONE } as const
  const r = await loadReview(n)
  if (!r) return { error: GONE } as const
  const cycle = (await rdb().from('review_cycles').select('*').eq('id', r.cycle_id).maybeSingle()).data as Cycle | null
  if (!cycle) return { error: GONE } as const
  // The reviewer is whoever the person reports to NOW: a former manager keeps no hand in the review (audit, 4 November 2026).
  const isReviewer = !!r.reviewer_id && r.reviewer_id === a.me && (r.step === 'approved' || currentReviewerOf(a.roster, a.settings, r.person_id) === a.me)
  return { a, r, cycle, isPerson: r.person_id === a.me, isReviewer } as const
}

async function setStep(r: ReviewRow, from: Step, patch: Record<string, unknown>): Promise<boolean> {
  const u = await rdb().from('reviews').update({ ...patch, updated_at: stamp() }).eq('id', r.id).eq('step', from).select('id')
  return !u.error && (u.data?.length ?? 0) > 0
}

const reviewUrl = (o: string, id: number) => `${o}/human-resources/reviews/${id}`
const clean = (s: unknown, max: number) => String(s ?? '').replace(/\r\n/g, '\n').slice(0, max)

// ── Answers ────────────────────────────────────────────────────────────────

/** Saves one answer as the person types (their part in step 1, the reviewer's feedback in step 2). */
export async function saveAnswer(input: { reviewId: number; key: string; body: string }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  const t = templateFor(x.cycle.year)
  const key = String(input?.key ?? '')
  const mine = ownKeys(t).has(key) && x.isPerson && x.r.step === 'self'
  const theirs = managerKeys(t).has(key) && x.isReviewer && x.r.step === 'review'
  if (!mine && !theirs) return no(x.isPerson || x.isReviewer ? 'This part is locked now.' : 'Only the person and the one they report to write in a review.')
  const now = stamp()
  const r = await rdb().from('review_answers').upsert({ review_id: x.r.id, key, body: clean(input.body, 20000), copied: false, updated_by: x.a.me, updated_at: now }, { onConflict: 'review_id,key' })
  if (r.error) { console.error('[review] answer:', r.error.message); return no(NOT_SAVED) }
  const t2 = await rdb().from('reviews').update({ updated_at: now }).eq('id', x.r.id)
  if (t2.error) console.error('[review] answer stamp:', t2.error.message)
  return { ok: true, savedAt: now }
}

/** "Copy from your last review": the Job Description from the year before, every field still editable. */
export async function copyJobDescription(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('Only you copy into your own self-review, while it is open.')
  const prev = await loadCycle(x.cycle.year - 1)
  const pr = prev ? (await rdb().from('reviews').select('id').eq('cycle_id', prev.id).eq('person_id', x.r.person_id).maybeSingle()).data as { id: number } | null : null
  // Last year's review in the portal, else what its Word file said on import (migration 150).
  const file = pr ? null : (await loadImports({ personId: x.r.person_id })).find(i => i.year === x.cycle.year - 1 && i.found?.job)
  if (!pr && !file) return no(`There is no ${x.cycle.year - 1} review to copy from.`)
  const old = pr
    ? (await rdb().from('review_answers').select('key, body').eq('review_id', pr.id).in('key', [...JOB_KEYS])).data as { key: string; body: string }[] | null
    : Object.entries(file!.found!.job).map(([key, body]) => ({ key, body: body ?? '' })).filter(a => (JOB_KEYS as readonly string[]).includes(a.key))
  const have = (await rdb().from('review_answers').select('key, body').eq('review_id', x.r.id).in('key', [...JOB_KEYS])).data as { key: string; body: string }[] | null
  const filled = new Set((have ?? []).filter(a => a.body.trim()).map(a => a.key))
  const rows = (old ?? []).filter(a => a.body.trim() && !filled.has(a.key)).map(a => ({ review_id: x.r.id, key: a.key, body: a.body, copied: true, updated_by: x.a.me, updated_at: stamp() }))
  if (!rows.length) return no(`Your ${x.cycle.year - 1} review has no Job Description to copy.`)
  const r = await rdb().from('review_answers').upsert(rows, { onConflict: 'review_id,key' })
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: `Copied from your ${x.cycle.year - 1} review. Change anything that is different now.` }
}

/** Undo the copy: empties the copied fields again. */
export async function undoCopyJob(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('This part is locked now.')
  const r = await rdb().from('review_answers').delete().eq('review_id', x.r.id).eq('copied', true)
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: 'Undone.' }
}

// ── Goals ──────────────────────────────────────────────────────────────────

async function loadGoal(id: unknown): Promise<Goal | null> {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return null
  return (await rdb().from('review_goals').select('*').eq('id', n).maybeSingle()).data as Goal | null
}

/** Who may change a goal of this review now: the person in step 1, the reviewer in steps 2 and 3. */
function goalWriter(x: { isPerson: boolean; isReviewer: boolean; r: ReviewRow }): 'person' | 'reviewer' | null {
  if (x.isPerson && x.r.step === 'self') return 'person'
  if (x.isReviewer && (x.r.step === 'review' || x.r.step === 'meeting')) return 'reviewer'
  return null
}

/** "Add a goal" (the coming year) or "Add a 2026 goal" (the year being reviewed, typed from last year's file). */
export async function addGoal(input: { reviewId: number; past?: boolean }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  const who = goalWriter(x)
  if (!who) return no('This part is locked now.')
  // The year under review is closed (the owner, 4 November 2026): its goals are only marked, never added.
  if (input.past) return no('The year being reviewed is closed: only how each goal went can change.')
  const count = (await rdb().from('review_goals').select('id', { count: 'exact', head: true }).eq('person_id', x.r.person_id).eq('goal_year', input.past ? x.cycle.year : x.cycle.year + 1)).count ?? 0
  if (count >= 20) return no('Twenty goals is the most a year can have.')
  const row = input.past
    ? { person_id: x.r.person_id, review_id: null, marked_in: x.r.id, goal_year: x.cycle.year, position: count, added_by: x.a.me }
    : { person_id: x.r.person_id, review_id: x.r.id, goal_year: x.cycle.year + 1, position: count, added_by: x.a.me, added_by_reviewer: who === 'reviewer', term: '1y' }
  const r = await rdb().from('review_goals').insert(row).select('id').single()
  if (r.error) { console.error('[review] add goal:', r.error.message); return no(NOT_SAVED) }
  refresh()
  return { ok: true, id: r.data.id }
}

/** Saves a goal's fields. A reviewer's change to the person's goal keeps the original, marked for them. */
export async function saveGoal(input: { goalId: number; what?: string; how?: string; byMonth?: string | null; term?: '6m' | '1y' | null; priorityId?: number | null }): Promise<Done> {
  const g = await loadGoal(input?.goalId)
  if (!g) return no('This goal is not there any more. Reload the page.')
  if (!g.review_id) return no('The year being reviewed is closed: only how each goal went can change.')
  const reviewId = g.review_id
  const x = await onReview(reviewId)
  if ('error' in x) return no(x.error!)
  const who = goalWriter(x)
  if (!who) return no('This part is locked now.')
  const patch: Record<string, unknown> = { updated_at: stamp() }
  if (input.what !== undefined) patch.what = clean(input.what, 500)
  if (input.how !== undefined) patch.how = clean(input.how, 1000)
  if (input.byMonth !== undefined) {
    if (input.byMonth !== null && !/^\d{4}-\d{2}-01$/.test(input.byMonth)) return no('Pick a month and a year.')
    patch.by_month = input.byMonth
  }
  if (input.term !== undefined) {
    if (input.term !== null && input.term !== '6m' && input.term !== '1y') return no('Pick 6 months or 1 year.')
    patch.term = input.term
  }
  if (input.priorityId !== undefined) {
    if (input.priorityId !== null) {
      const ok = (await loadPriorities(x.cycle.id)).some(p => p.id === input.priorityId && (!p.team_id || p.team_id === x.r.team_id))
      if (!ok) return no('That priority is not one of this review\'s.')
    }
    patch.priority_id = input.priorityId
  }
  if (who === 'reviewer' && !g.added_by_reviewer) {
    patch.changed_by = x.a.me
    if (!g.original) patch.original = { what: g.what, how: g.how, by_month: g.by_month, term: g.term, priority_id: g.priority_id }
  }
  const r = await rdb().from('review_goals').update(patch).eq('id', g.id)
  if (r.error) { console.error('[review] goal:', r.error.message); return no(NOT_SAVED) }
  return { ok: true, savedAt: patch.updated_at as string }
}

export async function removeGoal(input: { goalId: number }): Promise<Done> {
  const g = await loadGoal(input?.goalId)
  if (!g) return { ok: true }
  if (!g.review_id) return no('The year being reviewed is closed: only how each goal went can change.')
  const x = await onReview(g.review_id)
  if ('error' in x) return no(x.error!)
  const who = goalWriter(x)
  if (!who) return no('This part is locked now.')
  if (who === 'reviewer' && !g.added_by_reviewer) return no(`This goal is ${nameIn(x.a.roster, x.r.person_id)}'s. Change it instead; the original stays for them to see.`)
  const r = await rdb().from('review_goals').delete().eq('id', g.id)
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: 'Goal removed.' }
}

/** Marks how a goal of the year being reviewed went: Met, Partly met, Not met or No longer relevant, and why. */
export async function markGoal(input: { goalId: number; result?: GoalResult | null; comment?: string }): Promise<Done> {
  const g = await loadGoal(input?.goalId)
  if (!g) return no('This goal is not there any more. Reload the page.')
  const cur = (await rdb().from('reviews').select('id, cycle_id').eq('person_id', g.person_id).eq('step', 'self').limit(1).maybeSingle()).data as { id: number } | null
  const x = await onReview(g.marked_in ?? cur?.id)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('This part is locked now.')
  if (g.goal_year !== x.cycle.year) return no('Only the goals of the year being reviewed are marked here.')
  const patch: Record<string, unknown> = { marked_in: x.r.id, updated_at: stamp() }
  if (input.result !== undefined) {
    if (input.result !== null && !['met', 'partly', 'not_met', 'dropped'].includes(input.result)) return no('Pick how it went.')
    patch.result = input.result
  }
  if (input.comment !== undefined) patch.result_comment = clean(input.comment, 2000)
  const r = await rdb().from('review_goals').update(patch).eq('id', g.id)
  if (r.error) return no(NOT_SAVED)
  return { ok: true, savedAt: patch.updated_at as string }
}

// ── The steps ──────────────────────────────────────────────────────────────

/** Submit the self-review: it goes to the reviewer and the person's part locks. */
export async function submitSelf(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('This self-review is not open for you to send.')
  if (!x.r.reviewer_id) return no('Nobody reviews you yet: ask a Super Admin to set "Reports to" on your Directory page.')
  // A Team Leader sends the team's priorities first: the block lives in this self-review (audit, 4 November 2026).
  const leads = x.a.parts.find(p => p.personId === x.a.me)?.leads ?? []
  if (leads.length) {
    const states = await loadTeamStates(x.cycle.id)
    const waiting = leads.filter(t => ['draft', 'returned'].includes(states.get(t)?.state ?? 'draft'))
    if (waiting.length) return no(`Send ${waiting.length === 1 ? `the ${x.a.roster.teams.get(waiting[0])?.name ?? 'team'}'s` : 'your teams\''} priorities for approval first, so your team can start.`)
  }
  if (!(await setStep(x.r, 'self', { step: 'review', self_sent_at: stamp() }))) return no(NOT_SAVED)
  const who = nameIn(x.a.roster, x.r.person_id)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'self_sent', text: `${who} sent the self-review.` })
  await noticeOnce(`review:${x.r.id}:to-review:${stamp().slice(0, 16)}`, x.a.roster, x.r.reviewer_id, o => reviewMails.toReviewer({ year: x.cycle.year, who, what: 'review', due: x.cycle.review_due, days: null, url: reviewUrl(o, x.r.id) }))
  refresh()
  return { ok: true, toast: `Sent to ${nameIn(x.a.roster, x.r.reviewer_id)}. Your part is locked now.` }
}

/** Send back one step, always with a reason. */
export async function sendBack(input: { reviewId: number; reason: string }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  const reason = clean(input?.reason, 2000).trim()
  if (!reason) return no('Write the reason: the other person sees it.')
  const back = stepBack(x.r.step)
  if (!back) return no('This review cannot go back from here.')
  if (!x.isReviewer) return no(`Only ${nameIn(x.a.roster, x.r.reviewer_id) || 'the reviewer'} sends this review back.`)
  const patch: Record<string, unknown> = { step: back, sent_back_at: stamp(), sent_back_by: x.a.me, sent_back_reason: reason, sent_back_from: x.r.step }
  if (x.r.step === 'approval') patch.agreed_at = null
  if (!(await setStep(x.r, x.r.step, patch))) return no(NOT_SAVED)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'sent_back', text: `${nameIn(x.a.roster, x.a.me)} sent it back to ${back === 'self' ? 'the self-review' : back}: ${reason}` })
  if (back === 'self' || x.r.step === 'approval') {
    await noticeOnce(`review:${x.r.id}:back:${stamp()}`, x.a.roster, x.r.person_id, o => reviewMails.sentBack({ year: x.cycle.year, by: nameIn(x.a.roster, x.a.me), reason, url: reviewUrl(o, x.r.id) }))
  }
  refresh()
  return { ok: true, toast: back === 'self' ? `Sent back to ${nameIn(x.a.roster, x.r.person_id)}, with your reason.` : 'Sent back one step.' }
}

/** "Save and book the meeting": the review is done, the meeting step opens. */
export async function finishReview(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.r.step !== 'review') return no('This review is not waiting for you.')
  if (!(await setStep(x.r, 'review', { step: 'meeting', review_sent_at: stamp() }))) return no(NOT_SAVED)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'review_sent', text: `${nameIn(x.a.roster, x.a.me)} finished the review.` })
  refresh()
  return { ok: true, toast: 'Saved. Now book the meeting.' }
}

/** An Agenda event the actor made with that person as a guest: the only kind that can be a review meeting or a check-in (audit, 4 November 2026). */
async function ownEventWith(me: string, personId: string, eventId: unknown): Promise<{ id: string; starts_at: string; ends_at: string } | null> {
  const id = String(eventId ?? '')
  if (!/^\d+$/.test(id)) return null
  const ev = (await rdb().from('agenda_events').select('id, starts_at, ends_at, created_by').eq('id', id).maybeSingle()).data as { id: string; starts_at: string; ends_at: string; created_by: string | null } | null
  if (!ev || ev.created_by !== me) return null
  const guest = await rdb().from('agenda_event_guests').select('id').eq('event_id', id).eq('person_id', personId).limit(1)
  return guest.data?.length ? ev : null
}

/** Links the meeting booked in the Agenda's drawer to the review. */
export async function linkMeeting(input: { reviewId: number; eventId: string }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.r.step !== 'meeting') return no('Only the reviewer books the meeting, at the meeting step.')
  const ev = await ownEventWith(x.a.me, x.r.person_id, input?.eventId)
  if (!ev) return no('The meeting was not found in the Agenda. Try booking it again.')
  const u = await rdb().from('reviews').update({ meeting_event_id: ev.id, meeting_starts_at: ev.starts_at, meeting_ends_at: ev.ends_at, updated_at: stamp() }).eq('id', x.r.id)
  if (u.error) return no(NOT_SAVED)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'meeting_booked', text: `${nameIn(x.a.roster, x.a.me)} booked the meeting.` })
  refresh()
  return { ok: true, toast: 'Booked. It is on both Agendas and both Google Calendars.' }
}

export async function saveMeetingNotes(input: { reviewId: number; notes: string }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.r.step !== 'meeting') return no('The meeting notes are written by the reviewer, at the meeting step.')
  const now = stamp()
  const u = await rdb().from('reviews').update({ meeting_notes: clean(input?.notes, 20000), updated_at: now }).eq('id', x.r.id).eq('step', 'meeting').select('id')
  if (u.error || !u.data?.length) return no('The review moved on. Reload the page.')
  return { ok: true, savedAt: now }
}

/** "I have read and agree": after the meeting, the review goes to the reviewer for approval. */
export async function agreeReview(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'meeting') return no('There is nothing to agree to yet.')
  if (!x.r.meeting_ends_at || new Date(x.r.meeting_ends_at) > new Date()) return no('You agree after the meeting.')
  if (!(await setStep(x.r, 'meeting', { step: 'approval', agreed_at: stamp() }))) return no(NOT_SAVED)
  const who = nameIn(x.a.roster, x.r.person_id)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'agreed', text: `${who} read and agreed.` })
  await noticeOnce(`review:${x.r.id}:to-approve`, x.a.roster, x.r.reviewer_id, o => reviewMails.toReviewer({ year: x.cycle.year, who, what: 'approve', due: x.cycle.approval_due, days: null, url: reviewUrl(o, x.r.id) }))
  refresh()
  return { ok: true, toast: `Thank you. ${nameIn(x.a.roster, x.r.reviewer_id)} approves it next.` }
}

/** Approve: the review locks, the PDF is made and copied to Drive, the person and HR are told. */
export async function approveReview(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.r.step !== 'approval') return no('This review is not waiting for your approval.')
  if (!(await setStep(x.r, 'approval', { step: 'approved', approved_at: stamp(), approved_by: x.a.me, drive_status: 'waiting' }))) return no(NOT_SAVED)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'approved', text: `${nameIn(x.a.roster, x.a.me)} approved the review.` })
  await approveReviewWork(x.r.id, x.a.roster, x.a.settings)
  refresh()
  return { ok: true, toast: 'Approved. The PDF is made and on its way to Google Drive.' }
}

/** Try again on a Drive copy that failed. */
export async function retryReviewDrive(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (x.r.step !== 'approved') return no('Only an approved review is copied to Drive.')
  if (!x.isReviewer && !x.a.viewer.seesAll) return no('Only the reviewer and HR try the copy again.')
  const r = await copyReviewToDrive(x.r.id)
  refresh()
  return r.ok ? { ok: true, toast: 'Saved to Drive.' } : no(r.error)
}

// ── Priorities ─────────────────────────────────────────────────────────────

async function onCycle(cycleId: unknown) {
  const a = await actor()
  if (!a) return { error: 'Sign in again to do this.' } as const
  const c = (await rdb().from('review_cycles').select('*').eq('id', Number(cycleId)).maybeSingle()).data as Cycle | null
  if (!c) return { error: 'That review year is not there any more. Reload the page.' } as const
  return { a, c } as const
}

const leaderOf = (a: Actor, teamId: string) => a.roster.members.some(m => m.teamId === teamId && m.personId === a.me && ['lead', 'founder', 'manager', 'team_leader'].includes(m.position ?? ''))

/** Adds or saves a priority: the Company Priorities by the VP and CISO, a team's by its Team Leader (until approved). */
export async function savePriority(input: { cycleId: number; id?: number | null; teamId?: string | null; title?: string; body?: string; supportsId?: number | null }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  const teamId = input.teamId ?? null
  let existing: { id: number; team_id: string | null } | null = null
  if (input.id) {
    existing = (await rdb().from('review_priorities').select('id, team_id').eq('id', input.id).eq('cycle_id', x.c.id).maybeSingle()).data
    if (!existing) return no('That priority is not there any more. Reload the page.')
  }
  const scope = existing ? existing.team_id : teamId
  if (!scope) {
    if (!x.a.viewer.leads) return no('Only the VP of Operations and the CISO write the Company Priorities.')
  } else {
    const st = (await loadTeamStates(x.c.id)).get(scope)
    const locked = st?.state === 'approved' || st?.state === 'sent'
    if (!(x.a.viewer.leads || (leaderOf(x.a, scope) && !locked))) return no(locked ? 'These priorities are sent. Only the VP of Operations and the CISO change them now.' : 'Only the team\'s Team Leader writes its priorities.')
  }
  const fields: Record<string, unknown> = { updated_by: x.a.me, updated_at: stamp() }
  if (input.title !== undefined) fields.title = clean(input.title, 200)
  if (input.body !== undefined) fields.body = clean(input.body, 2000)
  if (input.supportsId !== undefined) {
    if (input.supportsId !== null && !(await loadPriorities(x.c.id)).some(p => p.id === input.supportsId && !p.team_id)) return no('Pick one of the Company Priorities.')
    fields.supports_id = input.supportsId
  }
  const c = rdb()
  if (existing) {
    const r = await c.from('review_priorities').update(fields).eq('id', existing.id)
    if (r.error) return no(NOT_SAVED)
    if (input.title !== undefined || input.body !== undefined) {
      await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'priority_changed', text: `${nameIn(x.a.roster, x.a.me)} changed "${String(fields.title ?? '') || 'a priority'}".` })
    }
    return { ok: true, savedAt: fields.updated_at as string }
  }
  const base = c.from('review_priorities').select('id', { count: 'exact', head: true }).eq('cycle_id', x.c.id)
  const count = (await (scope ? base.eq('team_id', scope) : base.is('team_id', null))).count ?? 0
  if (count >= 12) return no('Twelve priorities is the most.')
  const r = await c.from('review_priorities').insert({ cycle_id: x.c.id, team_id: scope, position: count, created_by: x.a.me, ...fields }).select('id').single()
  if (r.error) { console.error('[review] priority:', r.error.message); return no(NOT_SAVED) }
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'priority_added', text: `${nameIn(x.a.roster, x.a.me)} added a ${scope ? `${x.a.roster.teams.get(scope)?.name ?? 'team'} ` : 'whole-company '}priority.` })
  refresh()
  return { ok: true, id: r.data.id }
}

export async function removePriority(input: { id: number }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const p = (await rdb().from('review_priorities').select('id, cycle_id, team_id, title').eq('id', Number(input?.id)).maybeSingle()).data as { id: number; cycle_id: number; team_id: string | null; title: string } | null
  if (!p) return { ok: true }
  if (!p.team_id && !a.viewer.leads) return no('Only the VP of Operations and the CISO change the Company Priorities.')
  if (p.team_id) {
    const st = (await loadTeamStates(p.cycle_id)).get(p.team_id)
    const locked = st?.state === 'approved' || st?.state === 'sent'
    if (!(a.viewer.leads || (leaderOf(a, p.team_id) && !locked))) return no('These priorities are locked now.')
  }
  const r = await rdb().from('review_priorities').delete().eq('id', p.id)
  if (r.error) return no(NOT_SAVED)
  await addLog({ cycle_id: p.cycle_id, actor_id: a.me, kind: 'priority_removed', text: `${nameIn(a.roster, a.me)} removed "${p.title || 'a priority'}".` })
  refresh()
  return { ok: true, toast: 'Priority removed.' }
}

/** A Team Leader sends their team's priorities for approval, without sending their self-review. */
export async function sendTeamPriorities(input: { cycleId: number; teamId: string }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  const teamId = String(input?.teamId ?? '')
  if (!leaderOf(x.a, teamId)) return no('Only the team\'s Team Leader sends its priorities.')
  const was = (await loadTeamStates(x.c.id)).get(teamId)?.state ?? 'draft'
  if (was === 'sent') return no('These priorities are already sent. They are waiting for approval.')
  if (was === 'approved') return no('These priorities are approved. Only the VP of Operations and the CISO change them now.')
  const mine = (await loadPriorities(x.c.id)).filter(p => p.team_id === teamId && p.title.trim())
  if (!mine.length) return no('Write at least one priority with a title first.')
  const r = await rdb().from('review_team_priorities').upsert({ cycle_id: x.c.id, team_id: teamId, state: 'sent', sent_at: stamp(), sent_by: x.a.me, return_reason: null }, { onConflict: 'cycle_id,team_id' })
  if (r.error) return no(NOT_SAVED)
  const team = x.a.roster.teams.get(teamId)?.name ?? 'team'
  const leader = nameIn(x.a.roster, x.a.me)
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'team_sent', text: `${leader} sent ${mine.length} ${mine.length === 1 ? 'priority' : 'priorities'} for the ${team}.` })
  for (const to of [x.a.settings.vpId, x.a.settings.cisoId]) {
    await noticeOnce(`team:${x.c.id}:${teamId}:sent:${stamp().slice(0, 16)}:${to}`, x.a.roster, to, o => reviewMails.teamPriorities({ year: x.c.year, leader, team, url: `${o}/human-resources/reviews/priorities` }))
  }
  refresh()
  return { ok: true, toast: 'Sent for approval. Your self-review stays open.' }
}

const OWN_TEAM = 'You lead this team, so the other of the VP of Operations and the CISO decides its priorities.'

/** The VP of Operations or the CISO approves a team's priorities: the team's self-reviews open. */
export async function approveTeamPriorities(input: { cycleId: number; teamId: string }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  if (!x.a.viewer.leads) return no('Only the VP of Operations and the CISO approve team priorities.')
  const teamId = String(input?.teamId ?? '')
  if (!x.a.roster.teams.has(teamId)) return no('That team is not in the Directory.')
  if (!decidesTeam(x.a.me, true, teamId, x.a.roster.members)) return no(OWN_TEAM)
  if ((await loadTeamStates(x.c.id)).get(teamId)?.state !== 'sent') return no('These priorities are not waiting for approval.')
  const r = await rdb().from('review_team_priorities').upsert({ cycle_id: x.c.id, team_id: teamId, state: 'approved', decided_at: stamp(), decided_by: x.a.me, return_reason: null }, { onConflict: 'cycle_id,team_id' })
  if (r.error) return no(NOT_SAVED)
  const team = x.a.roster.teams.get(teamId)?.name ?? 'team'
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'team_approved', text: `${nameIn(x.a.roster, x.a.me)} approved the priorities for the ${team}.${x.c.started_at ? ` The ${team}'s self-reviews opened.` : ''}` })
  const { opened } = await syncCycle(x.c)
  await sendOpenedNotices(x.c, opened)
  refresh()
  return { ok: true, toast: opened.length ? `Approved. ${opened.length} self-review${opened.length === 1 ? '' : 's'} opened.` : 'Approved.' }
}

export async function returnTeamPriorities(input: { cycleId: number; teamId: string; reason: string }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  if (!x.a.viewer.leads) return no('Only the VP of Operations and the CISO send team priorities back.')
  const reason = clean(input?.reason, 2000).trim()
  if (!reason) return no('Write the reason: the Team Leader sees it.')
  const teamId = String(input?.teamId ?? '')
  if (!x.a.roster.teams.has(teamId)) return no('That team is not in the Directory.')
  if (!decidesTeam(x.a.me, true, teamId, x.a.roster.members)) return no(OWN_TEAM)
  const st = (await loadTeamStates(x.c.id)).get(teamId)
  if (st?.state !== 'sent') return no('These priorities are not waiting for approval.')
  const r = await rdb().from('review_team_priorities').upsert({ cycle_id: x.c.id, team_id: teamId, state: 'returned', decided_at: stamp(), decided_by: x.a.me, return_reason: reason }, { onConflict: 'cycle_id,team_id' })
  if (r.error) return no(NOT_SAVED)
  const team = x.a.roster.teams.get(teamId)?.name ?? 'team'
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'team_returned', text: `${nameIn(x.a.roster, x.a.me)} sent the ${team}'s priorities back: ${reason}` })
  if (st?.sent_by) {
    const rev = (await rdb().from('reviews').select('id').eq('cycle_id', x.c.id).eq('person_id', st.sent_by).maybeSingle()).data as { id: number } | null
    await noticeOnce(`team:${x.c.id}:${teamId}:back:${stamp()}`, x.a.roster, st.sent_by, o => reviewMails.prioritiesBack({ year: x.c.year, by: nameIn(x.a.roster, x.a.me), team, reason, url: rev ? reviewUrl(o, rev.id) : `${o}/human-resources` }))
  }
  refresh()
  return { ok: true, toast: 'Sent back to the Team Leader, with your reason.' }
}

// ── The year ───────────────────────────────────────────────────────────────

/** Who may change the Human Resources settings: a Super Admin, and the HR person picked there. */
async function settingsWriter() {
  const a = await actor()
  if (!a) return null
  if (await allowedTo('cs-hr-edit')) return a
  return a.viewer.isHr ? a : null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DATE_KEYS = ['leaders_open_on', 'leaders_due', 'teams_open_by', 'self_due', 'review_due', 'meeting_due', 'approval_due', 'checkins_by'] as const

/** Saves the year's dates (Company settings > Human Resources), making the year's cycle when there is none. */
export async function saveReviewDates(input: { year: number; dates: Partial<Record<(typeof DATE_KEYS)[number], string | null>> }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR change the review settings.')
  const year = Number(input?.year)
  if (!Number.isInteger(year) || year < 2025 || year > 2100) return no('That is not a year.')
  const patch: Record<string, unknown> = { updated_at: stamp() }
  for (const k of DATE_KEYS) {
    const v = input.dates?.[k]
    if (v === undefined) continue
    if (v !== null && !DAY.test(v)) return no('Pick a date.')
    patch[k] = v
  }
  const r = await rdb().from('review_cycles').upsert({ year, ...patch }, { onConflict: 'year' })
  if (r.error) { console.error('[review] dates:', r.error.message); return no(NOT_SAVED) }
  revalidatePath('/admin/settings')
  return { ok: true, toast: 'Saved.' }
}

/** Saves the three roles, or who takes part beyond the employees. */
export async function saveHrSettings(input: { vpId?: string | null; cisoId?: string | null; hrId?: string | null; extra?: string[] }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR change the review settings.')
  const patch: Record<string, unknown> = { updated_by: a.me, updated_at: stamp() }
  const person = (v: unknown) => v === null || (typeof v === 'string' && a.roster.people.get(v)?.active)
  for (const [k, col] of [['vpId', 'vp_operations_id'], ['cisoId', 'ciso_id'], ['hrId', 'hr_id']] as const) {
    if (input[k] === undefined) continue
    // The roles give access to every review and to the approvals: HR cannot hand them out (audit, 4 November 2026).
    if (!(await allowedTo('cs-hr-edit'))) return no('Only a Super Admin picks the roles.')
    if (!person(input[k])) return no('Pick an active person.')
    patch[col] = input[k]
  }
  if (input.extra !== undefined) {
    const ids = [...new Set(input.extra.map(String))]
    if (!ids.every(id => a.roster.people.get(id)?.active)) return no('Pick active people.')
    patch.extra_people = ids
  }
  const r = await rdb().from('hr_settings').update(patch).eq('singleton_id', 1)
  if (r.error) return no(NOT_SAVED)
  revalidatePath('/admin/settings')
  return { ok: true, toast: 'Saved.' }
}

/** The folder picked in Google's Picker for the approved PDFs. */
export async function saveHrDriveFolder(input: { id: string; name: string }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR change the review settings.')
  const id = String(input?.id ?? '').trim(), name = String(input?.name ?? '').trim().slice(0, 200)
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return no('That is not a Drive folder. Pick it again.')
  const r = await rdb().from('hr_settings').update({ drive_folder_id: id, drive_folder_name: name || 'Drive folder', drive_folder_path: null, updated_by: a.me, updated_at: stamp() }).eq('singleton_id', 1)
  if (r.error) return no(NOT_SAVED)
  revalidatePath('/admin/settings')
  return { ok: true, toast: `Saved. Approved reviews go into "${name}".` }
}

/** The Picker's keys, for the HR folder and for last year's files. */
export async function hrPicker(): Promise<{ ok: true; token: string; key: string; appId: string } | { ok: false; error: string }> {
  const a = await settingsWriter()
  if (!a) return { ok: false, error: 'Only Super Admins and HR change the review settings.' }
  const { driveAccount, driveToken } = await import('@/lib/agenda/google-drive')
  const acc = await driveAccount()
  if (!acc.ok) return { ok: false, error: acc.why }
  const { data } = await rdb().from('app_settings').select('google_oauth_client_id, google_picker_key').eq('singleton_id', 1).maybeSingle()
  if (!data?.google_picker_key || !data.google_oauth_client_id) return { ok: false, error: 'Save the Picker key in Company settings, Integrations, first.' }
  const token = await driveToken()
  if (!token) return { ok: false, error: `${acc.email} needs to be connected again in Agenda settings.` }
  return { ok: true, token, key: data.google_picker_key, appId: String(data.google_oauth_client_id).split('-')[0] }
}

/** Last year's files picked in Drive: each matched to a person by the name in it, waiting for Import. */
export async function pickImportFiles(input: { year: number; files: { id: string; name: string; mimeType?: string; url?: string }[] }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR import last year\'s reviews.')
  const year = Number(input?.year)
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return no('That is not a year.')
  const files = (input?.files ?? []).filter(f => /^[A-Za-z0-9_-]{10,}$/.test(String(f.id))).slice(0, 300)
  if (!files.length) return no('No files were picked.')
  const { matchFile } = await import('@/lib/review/rules')
  const people = [...a.roster.people.values()].map(p => ({ id: p.id, name: p.name, active: p.active }))
  const rows = files.map(f => {
    const m = matchFile(String(f.name), people)
    return { year, drive_file_id: f.id, file_name: String(f.name).slice(0, 300), mime_type: f.mimeType ?? null, web_link: f.url ?? null, person_id: m.personId, match: m.match }
  })
  // A file picked before keeps its row: its person may have been checked, or imported already.
  const r = await rdb().from('review_imports').upsert(rows, { onConflict: 'year,drive_file_id', ignoreDuplicates: true })
  if (r.error) { console.error('[review] pick files:', r.error.message); return no(NOT_SAVED) }
  revalidatePath('/admin/settings')
  return { ok: true, toast: `${rows.length} file${rows.length === 1 ? '' : 's'} picked. Check the matches, then import.` }
}

export async function setImportPerson(input: { id: number; personId: string | null; skip?: boolean }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR import last year\'s reviews.')
  if (input.personId && !a.roster.people.has(input.personId)) return no('Pick a person from the Directory.')
  const row = (await rdb().from('review_imports').select('id, imported_at').eq('id', Number(input?.id)).maybeSingle()).data as { id: number; imported_at: string | null } | null
  if (!row) return no('That file is not there any more. Reload the page.')
  // Once imported, the file is served to its person and its goals are theirs: it does not move (audit, 4 November 2026).
  if (row.imported_at) return no('This file is imported already. It stays with its person.')
  const r = await rdb().from('review_imports').update({ person_id: input.skip ? null : input.personId, match: input.skip ? 'skipped' : input.personId ? 'matched' : 'none' }).eq('id', row.id)
  if (r.error) return no(NOT_SAVED)
  revalidatePath('/admin/settings')
  return { ok: true }
}

/**
 * HR corrects the goals a file gave (migration 150): adds one the reader
 * missed, changes its words or month, or takes one out. The person only marks
 * them; their year is closed. Not after their review of that year is approved.
 */
export async function saveImportGoal(input: { importId: number; goalId?: number | null; what?: string; byMonth?: string | null }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR correct last year\'s goals.')
  const imp = (await rdb().from('review_imports').select('id, year, person_id, imported_at').eq('id', Number(input?.importId)).maybeSingle()).data as { id: number; year: number; person_id: string | null; imported_at: string | null } | null
  if (!imp?.imported_at || !imp.person_id) return no('Import the file first.')
  if (await goalsClosed(imp.person_id, imp.year + 1)) return no(`${nameIn(a.roster, imp.person_id)}'s ${imp.year + 1} review is approved: these goals are closed.`)
  const fields: Record<string, unknown> = { updated_at: stamp() }
  if (input.what !== undefined) fields.what = clean(input.what, 500)
  if (input.byMonth !== undefined) {
    if (input.byMonth !== null && !/^\d{4}-\d{2}-01$/.test(input.byMonth)) return no('Pick a month.')
    fields.by_month = input.byMonth
  }
  if (input.goalId) {
    const r = await rdb().from('review_goals').update(fields).eq('id', input.goalId).eq('import_id', imp.id)
    if (r.error) return no(NOT_SAVED)
  } else {
    const count = (await rdb().from('review_goals').select('id', { count: 'exact', head: true }).eq('import_id', imp.id)).count ?? 0
    if (count >= 20) return no('Twenty goals is the most a year can have.')
    const r = await rdb().from('review_goals').insert({ person_id: imp.person_id, goal_year: imp.year + 1, position: count, what: '', how: '', result_comment: '', import_id: imp.id, added_by: a.me, ...fields })
    if (r.error) return no(NOT_SAVED)
  }
  revalidatePath('/admin/settings')
  return { ok: true, toast: 'Saved.' }
}

/** The goals of a year are closed once the review that marks them is approved. */
async function goalsClosed(personId: string, goalYear: number): Promise<boolean> {
  // No "!inner" embed: the server refuses the "!" (LiteSpeed, 2026-10).
  const c = await loadCycle(goalYear)
  if (!c) return false
  const r = await rdb().from('reviews').select('id').eq('person_id', personId).eq('cycle_id', c.id).eq('step', 'approved').limit(1)
  return (r.data?.length ?? 0) > 0
}

export async function removeImportGoal(input: { goalId: number }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR correct last year\'s goals.')
  const g = (await rdb().from('review_goals').select('id, person_id, goal_year, import_id').eq('id', Number(input?.goalId)).maybeSingle()).data as { id: number; person_id: string; goal_year: number; import_id: number | null } | null
  if (!g?.import_id) return { ok: true }
  if (await goalsClosed(g.person_id, g.goal_year)) return no('That review is approved: these goals are closed.')
  const r = await rdb().from('review_goals').delete().eq('id', g.id)
  if (r.error) return no(NOT_SAVED)
  revalidatePath('/admin/settings')
  return { ok: true, toast: 'Goal removed.' }
}

/** Import: copies each matched file (as a PDF) into the portal, where it shows as the reference. */
export async function importFiles(input: { year: number; importId?: number }): Promise<Done> {
  const a = await settingsWriter()
  if (!a) return no('Only Super Admins and HR import last year\'s reviews.')
  const { importReviewFiles } = await import('@/lib/review/drive')
  const one = input?.importId === undefined ? undefined : Number(input.importId)
  const r = await importReviewFiles(Number(input?.year), a.me, one)
  revalidatePath('/admin/settings')
  if (!r.ok) return no(r.error)
  // One file (the dialog's loop): whether it went in, and the toast carries
  // the number of goals read, which the dialog adds up.
  if (one !== undefined) return r.done ? { ok: true, toast: `${r.goals}` } : no('Could not be read.')
  return { ok: true, toast: `${r.done} file${r.done === 1 ? '' : 's'} imported.${r.failed ? ` ${r.failed} could not be read; try them again.` : ''}` }
}

/** "Start the 2026 cycle" (Super Admin): phase 1 opens now, with an email to each. */
export async function startCycle(input: { year: number }): Promise<Done> {
  if (!(await allowedTo('hr-start'))) return no('Only a Super Admin starts the cycle.')
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const c = await loadCycle(Number(input?.year))
  if (!c) return no('Set the dates in Company settings > Human Resources first.')
  if (c.started_at) return no(`The ${c.year} cycle has already started.`)
  if (!c.self_due || !c.approval_due) return no('Set the dates in Company settings > Human Resources first.')
  const u = await rdb().from('review_cycles').update({ started_at: stamp(), started_by: a.me, updated_at: stamp() }).eq('id', c.id).is('started_at', null).select('id')
  if (u.error || !u.data?.length) return no(`The ${c.year} cycle has already started.`)
  const started = { ...c, started_at: stamp(), started_by: a.me }
  await addLog({ cycle_id: c.id, actor_id: a.me, kind: 'started', text: `${nameIn(a.roster, a.me)} started the ${c.year} cycle.` })
  const { opened } = await syncCycle(started)
  await sendOpenedNotices(started, opened)
  refresh()
  return { ok: true, toast: `The ${c.year} cycle started. ${opened.length} self-review${opened.length === 1 ? '' : 's'} opened.` }
}

// ── Goals during the year ──────────────────────────────────────────────────

/** The person updates a goal: where it is, and what changed in a sentence. */
export async function updateGoal(input: { goalId: number; status: GoalStatus; body: string }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const g = await loadGoal(input?.goalId)
  if (!g) return no('This goal is not there any more. Reload the page.')
  if (g.person_id !== a.me) return no('Only you update your goals.')
  const owner = g.review_id ? await loadReview(g.review_id) : null
  if (!owner || owner.step !== 'approved') return no('This goal is not agreed yet.')
  if (!['not_started', 'on_track', 'at_risk', 'done', 'dropped'].includes(input.status)) return no('Pick where it is.')
  const body = clean(input.body, 4000).trim()
  const now = stamp()
  const [u, i] = await Promise.all([
    rdb().from('review_goals').update({ status: input.status, updated_at: now }).eq('id', g.id),
    rdb().from('review_goal_updates').insert({ goal_id: g.id, author_id: a.me, kind: 'update', status: input.status, body }),
  ])
  if (u.error || i.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: `Saved. ${nameIn(a.roster, owner.reviewer_id) || 'Your manager'} sees the update.` }
}

/** The manager comments on a goal (My team's goals, or during the 6-month check-in). */
export async function commentGoal(input: { goalId: number; body: string; checkin?: boolean }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const g = await loadGoal(input?.goalId)
  if (!g) return no('This goal is not there any more. Reload the page.')
  if (!a.viewer.reports.has(g.person_id)) return no('Only the person they report to comments on their goals.')
  const body = clean(input?.body, 4000).trim()
  if (!body) return no('Write the comment first.')
  const r = await rdb().from('review_goal_updates').insert({ goal_id: g.id, author_id: a.me, kind: input.checkin ? 'checkin' : 'comment', body })
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: 'Comment saved.' }
}

/** Links the check-in booked in the Agenda's drawer. */
export async function linkCheckin(input: { personId: string; eventId: string }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  if (!a.viewer.reports.has(String(input?.personId))) return no('Only the person they report to books the check-in.')
  const run = await runningCycleOf(String(input.personId))
  if (!run) return no('There are no agreed goals to check in on.')
  const ev = await ownEventWith(a.me, String(input.personId), input?.eventId)
  if (!ev) return no('The check-in was not found in the Agenda. Try booking it again.')
  const r = await rdb().from('review_checkins').upsert({ cycle_id: run, person_id: input.personId, manager_id: a.me, event_id: ev.id, starts_at: ev.starts_at }, { onConflict: 'cycle_id,person_id' })
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: 'Booked. It is on both Agendas and both Google Calendars.' }
}

/** "Finish the check-in": the person gets the comments by email and in Needs you. */
export async function finishCheckin(input: { personId: string }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const personId = String(input?.personId ?? '')
  if (!a.viewer.reports.has(personId)) return no('Only the person they report to finishes the check-in.')
  const run = await runningCycleOf(personId)
  if (!run) return no('There are no agreed goals to check in on.')
  const year = (await rdb().from('review_cycles').select('year').eq('id', run).maybeSingle()).data?.year ?? new Date().getFullYear()
  const r = await rdb().from('review_checkins').upsert({ cycle_id: run, person_id: personId, manager_id: a.me, finished_at: stamp() }, { onConflict: 'cycle_id,person_id' })
  if (r.error) return no(NOT_SAVED)
  await noticeOnce(`checkin:${run}:${personId}:done`, a.roster, personId, o => reviewMails.checkinDone({ year, manager: nameIn(a.roster, a.me), url: `${o}/human-resources?tab=goals` }))
  refresh()
  return { ok: true, toast: `Done. ${firstName(nameIn(a.roster, personId))} gets your comments.` }
}

/** The cycle whose agreed goals run now for a person: their latest approved review's. */
async function runningCycleOf(personId: string): Promise<number | null> {
  const r = (await rdb().from('reviews').select('cycle_id, approved_at').eq('person_id', personId).eq('step', 'approved').order('approved_at', { ascending: false }).limit(1).maybeSingle()).data as { cycle_id: number } | null
  return r?.cycle_id ?? null
}

// ── For the page: keeps a started year current on every visit ──────────────

