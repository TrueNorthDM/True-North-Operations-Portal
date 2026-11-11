'use server'

/**
 * The annual review's actions (design handoff, 3 November 2026). Each one
 * finds the signed-in person (writerAccess: a verified session, never a View
 * Stage preview) and decides from the review itself who may do what:
 *
 *   the person      writes their self-review while it is theirs (step 1),
 *                   reads and agrees after the meeting, updates their goals;
 *   a reviewer      each reviewer has their own part (two reviewers, owner,
 *                   10 November 2026): reviews, sends back, books the
 *                   meeting, writes the notes, approves, comments on goals
 *                   and holds the 6-month check-in;
 *   the CISO        the Company Priorities; the VP of Operations their own;
 *   a Team Leader   their team's priorities, first thing in their self-review;
 *   VP of Ops       starts the year (a Super Admin as back-up).
 *
 * Every refusal is a sentence for the toast; every write stamps who and when.
 */

import { revalidatePath } from 'next/cache'
import { allowedTo, writerAccess } from '@/lib/access/resolve'
import {
  addLog, cleanOverrides, defaultYear, ensureYearCycle, loadCycle, loadHrSettings, loadImports, loadParts, loadPriorities, loadReview, loadRoster, nameIn,
  currentReviewerOf, rdb, reviewToday, rosterParticipants, syncCycle, viewerOf, type Cycle, type Goal, type ReviewRow,
} from '@/lib/review/data'
import { ownKeys, managerKeys, templateFor, JOB_KEYS } from '@/lib/review/template'
import { isLeadPositionName, type GoalResult, type GoalStatus } from '@/lib/review/rules'
import { everyPartApproved, partBack, partsOf, type PartNo, type PartRow, type PartStep } from '@/lib/review/parts'
import { checkinPlanFrom, goalsOpen, moveUp, orderProblems, planFrom, sixMonthsAfter, type DateKey } from '@/lib/review/schedule'
import { fmtDay } from '@/lib/review/format'
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

/**
 * The review and its year, with who the actor is on it. `part` picks the
 * reviewer's part (two reviewers); left out, it is the actor's own part when
 * they review this person, else the first.
 */
async function onReview(id: unknown, wantPart?: unknown) {
  const a = await actor()
  if (!a) return { error: 'Sign in again to do this.' } as const
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return { error: GONE } as const
  const r = await loadReview(n)
  if (!r) return { error: GONE } as const
  const cycle = (await rdb().from('review_cycles').select('*').eq('id', r.cycle_id).maybeSingle()).data as Cycle | null
  if (!cycle) return { error: GONE } as const
  const extra = (await loadParts([r.id]))[0] ?? null
  const parts = partsOf(r, extra ? [extra] : [])
  const asked = wantPart === 0 || wantPart === 1 ? wantPart as PartNo : null
  const mine = parts.find(x => x.reviewerId === a.me)?.no ?? null
  const part: PartNo = asked ?? mine ?? 0
  const p = parts.find(x => x.no === part) ?? parts[0]
  // A reviewer is whoever the person reports to NOW for that part: a former manager keeps no hand in the review (audit, 4 November 2026).
  const isReviewer = !!p.reviewerId && p.reviewerId === a.me && (p.step === 'approved' || currentReviewerOf(a.roster, a.settings, r.person_id, part) === a.me)
  return { a, r, cycle, extra, parts, part, p, isPerson: r.person_id === a.me, isReviewer } as const
}
type OnReview = Extract<Awaited<ReturnType<typeof onReview>>, { a: unknown }>

async function setStep(r: ReviewRow, from: ReviewRow['step'], patch: Record<string, unknown>): Promise<boolean> {
  const u = await rdb().from('reviews').update({ ...patch, updated_at: stamp() }).eq('id', r.id).eq('step', from).select('id')
  return !u.error && (u.data?.length ?? 0) > 0
}

/**
 * Moves one part on, from the step it is on: the first part lives on the
 * review row, the second on its review_parts row. Refuses when the part has
 * moved since the page was read.
 */
async function setPart(x: OnReview, from: PartStep, patch: Record<string, unknown>): Promise<boolean> {
  if (x.part === 0) {
    if (x.p.step !== from) return false
    const q = rdb().from('reviews').update({ ...patch, updated_at: stamp() }).eq('id', x.r.id).eq('step', from === 'waiting' ? 'self' : from)
    const u = from === 'approval' ? await q.is('approved_at', null).select('id') : await q.select('id')
    return !u.error && (u.data?.length ?? 0) > 0
  }
  if (!x.extra) return false
  const u = await rdb().from('review_parts').update({ ...patch, updated_at: stamp() }).eq('id', x.extra.id).eq('step', from).select('id')
  return !u.error && (u.data?.length ?? 0) > 0
}

/** The review is approved when every part is (the first part's approval keeps the row at "approval" while the second is open). */
async function closeIfAllApproved(reviewId: number): Promise<boolean> {
  const r = await loadReview(reviewId)
  if (!r || r.step === 'approved') return false
  const parts = partsOf(r, await loadParts([reviewId]))
  if (!everyPartApproved(parts)) return false
  const u = await rdb().from('reviews').update({ step: 'approved', drive_status: 'waiting', updated_at: stamp() }).eq('id', reviewId).eq('step', 'approval').select('id')
  return !u.error && (u.data?.length ?? 0) > 0
}

const reviewUrl = (o: string, id: number) => `${o}/human-resources/reviews/${id}`
const clean = (s: unknown, max: number) => String(s ?? '').replace(/\r\n/g, '\n').slice(0, max)

// ── Answers ────────────────────────────────────────────────────────────────

/** Saves one answer as the person types (their part in step 1, the reviewer's feedback in step 2). */
export async function saveAnswer(input: { reviewId: number; key: string; body: string; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  const t = templateFor(x.cycle.year)
  const key = String(input?.key ?? '')
  const mine = ownKeys(t).has(key) && x.isPerson && x.r.step === 'self'
  const theirs = managerKeys(t).has(key) && x.isReviewer && x.p.step === 'review'
  if (!mine && !theirs) return no(x.isPerson || x.isReviewer ? 'This part is locked now.' : 'Only the person and the one they report to write in a review.')
  const now = stamp()
  const r = await rdb().from('review_answers').upsert({ review_id: x.r.id, key, part: mine ? 0 : x.part, body: clean(input.body, 20000), copied: false, updated_by: x.a.me, updated_at: now }, { onConflict: 'review_id,key,part' })
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
    ? (await rdb().from('review_answers').select('key, body').eq('review_id', pr.id).eq('part', 0).in('key', [...JOB_KEYS])).data as { key: string; body: string }[] | null
    : Object.entries(file!.found!.job).map(([key, body]) => ({ key, body: body ?? '' })).filter(a => (JOB_KEYS as readonly string[]).includes(a.key))
  const have = (await rdb().from('review_answers').select('key, body').eq('review_id', x.r.id).eq('part', 0).in('key', [...JOB_KEYS])).data as { key: string; body: string }[] | null
  const filled = new Set((have ?? []).filter(a => a.body.trim()).map(a => a.key))
  const rows = (old ?? []).filter(a => a.body.trim() && !filled.has(a.key)).map(a => ({ review_id: x.r.id, key: a.key, part: 0, body: a.body, copied: true, updated_by: x.a.me, updated_at: stamp() }))
  if (!rows.length) return no(`Your ${x.cycle.year - 1} review has no Job Description to copy.`)
  const r = await rdb().from('review_answers').upsert(rows, { onConflict: 'review_id,key,part' })
  if (r.error) return no(NOT_SAVED)
  refresh()
  return { ok: true, toast: `Copied from your ${x.cycle.year - 1} review. Change anything that is different now.` }
}

/** Undo the copy: empties the copied fields again. */
export async function undoCopyJob(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('This part is locked now.')
  const r = await rdb().from('review_answers').delete().eq('review_id', x.r.id).eq('part', 0).eq('copied', true)
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

/** Who may change a goal of this review now: the person in step 1, a reviewer while their part is at the review or the meeting. */
function goalWriter(x: { isPerson: boolean; isReviewer: boolean; r: ReviewRow; p: { step: PartStep } }): 'person' | 'reviewer' | null {
  if (x.isPerson && x.r.step === 'self') return 'person'
  if (x.isReviewer && (x.p.step === 'review' || x.p.step === 'meeting')) return 'reviewer'
  return null
}

/** With two reviewers, a reviewer changes only the goals of their part (or one not given to either). */
const goalIsTheirs = (x: { part: PartNo; parts: { no: PartNo }[] }, g: Pick<Goal, 'part'>) => x.parts.length < 2 || g.part === null || g.part === x.part

/** "Add a goal" (the coming year) or "Add a 2026 goal" (the year being reviewed, typed from last year's file). */
export async function addGoal(input: { reviewId: number; past?: boolean; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  const who = goalWriter(x)
  if (!who) return no('This part is locked now.')
  // The year under review is closed (the owner, 4 November 2026): its goals are only marked, never added.
  if (input.past) return no('The year being reviewed is closed: only how each goal went can change.')
  // The goals for next year wait for the priorities (owner, 10 November 2026).
  if (who === 'person' && !goalsOpen(x.cycle, reviewToday())) return no(`Your goals for ${x.cycle.year + 1} open when the Company Priorities and the VP of Operations' priorities are ready${x.cycle.vp_due ? `, by ${fmtDay(x.cycle.vp_due)} at the latest` : ''}.`)
  const count = (await rdb().from('review_goals').select('id', { count: 'exact', head: true }).eq('person_id', x.r.person_id).eq('goal_year', x.cycle.year + 1)).count ?? 0
  if (count >= 20) return no('Twenty goals is the most a year can have.')
  // With two reviewers each goal is for one of them: a reviewer's own goal is theirs; the person picks, the first by default.
  const part = x.parts.length < 2 ? null : who === 'reviewer' ? x.part : (input.part === 1 ? 1 : 0)
  const row = { person_id: x.r.person_id, review_id: x.r.id, goal_year: x.cycle.year + 1, position: count, added_by: x.a.me, added_by_reviewer: who === 'reviewer', term: '1y', part }
  const r = await rdb().from('review_goals').insert(row).select('id').single()
  if (r.error) { console.error('[review] add goal:', r.error.message); return no(NOT_SAVED) }
  refresh()
  return { ok: true, id: r.data.id }
}

/** Saves a goal's fields. A reviewer's change to the person's goal keeps the original, marked for them. */
export async function saveGoal(input: { goalId: number; what?: string; how?: string; byMonth?: string | null; term?: '6m' | '1y' | null; priorityId?: number | null; part?: PartNo }): Promise<Done> {
  const g = await loadGoal(input?.goalId)
  if (!g) return no('This goal is not there any more. Reload the page.')
  if (!g.review_id) return no('The year being reviewed is closed: only how each goal went can change.')
  const reviewId = g.review_id
  const x = await onReview(reviewId)
  if ('error' in x) return no(x.error!)
  const who = goalWriter(x)
  if (!who) return no('This part is locked now.')
  if (who === 'reviewer' && !goalIsTheirs(x, g)) return no(`This goal is for ${nameIn(x.a.roster, x.parts.find(p => p.no === g.part)?.reviewerId)}. Only they change it.`)
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
      const teams = new Set([x.r.team_id, ...x.a.roster.members.filter(m => m.personId === x.r.person_id).map(m => m.teamId)])
      const ok = (await loadPriorities(x.cycle.id)).some(p => p.id === input.priorityId && (!p.team_id || teams.has(p.team_id)))
      if (!ok) return no('That priority is not one of this review\'s.')
    }
    patch.priority_id = input.priorityId
  }
  if (input.part !== undefined) {
    if (who !== 'person' || x.parts.length < 2) return no('Only the person says which reviewer a goal is for.')
    if (input.part !== 0 && input.part !== 1) return no('Pick one of the two reviewers.')
    patch.part = input.part
  }
  if (who === 'reviewer' && !g.added_by_reviewer) {
    patch.changed_by = x.a.me
    if (!g.original) patch.original = { what: g.what, how: g.how, by_month: g.by_month, term: g.term, priority_id: g.priority_id }
  }
  const r = await rdb().from('review_goals').update(patch).eq('id', g.id)
  if (r.error) { console.error('[review] goal:', r.error.message); return no(NOT_SAVED) }
  if (input.part !== undefined) refresh()
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
  if (who === 'reviewer' && !goalIsTheirs(x, g)) return no(`This goal is for ${nameIn(x.a.roster, x.parts.find(p => p.no === g.part)?.reviewerId)}. Only they change it.`)
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

/** Submit the self-review: it goes to every reviewer and the person's part locks. */
export async function submitSelf(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'self') return no('This self-review is not open for you to send.')
  if (!x.r.reviewer_id) return no('Nobody reviews you yet: ask a Super Admin to set "Reports to" on your Directory page.')
  // A Team Leader writes the team's priorities first, in this self-review (owner, 10 November 2026): no approval, but not empty.
  const leads = x.a.parts.find(p => p.personId === x.a.me)?.leads ?? []
  if (leads.length) {
    const written = new Set((await loadPriorities(x.cycle.id)).filter(p => p.team_id && p.title.trim()).map(p => p.team_id!))
    const empty = leads.filter(t => !written.has(t))
    if (empty.length) return no(`Write at least one priority for ${empty.length === 1 ? `the ${x.a.roster.teams.get(empty[0])?.name ?? 'team'}` : 'each of your teams'} first: your team builds its goals on them.`)
  }
  if (!(await setStep(x.r, 'self', { step: 'review', self_sent_at: stamp(), approved_at: null, approved_by: null }))) return no(NOT_SAVED)
  if (x.extra) await rdb().from('review_parts').update({ step: 'review', agreed_at: null, approved_at: null, approved_by: null, updated_at: stamp() }).eq('id', x.extra.id).in('step', ['waiting', 'review'])
  const who = nameIn(x.a.roster, x.r.person_id)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'self_sent', text: `${who} sent the self-review.` })
  for (const pt of x.parts) {
    await noticeOnce(`review:${x.r.id}:to-review:${pt.no}:${stamp().slice(0, 16)}`, x.a.roster, pt.reviewerId, o => reviewMails.toReviewer({ year: x.cycle.year, who, what: 'review', due: x.cycle.review_due, days: null, url: reviewUrl(o, x.r.id) }))
  }
  refresh()
  const names = x.parts.map(pt => nameIn(x.a.roster, pt.reviewerId)).filter(Boolean)
  return { ok: true, toast: `Sent to ${names.join(' and ')}. Your part is locked now.` }
}

/**
 * Send back one step, always with a reason. From a reviewer's review it goes
 * back to the self-review, and with two reviewers both parts start again from
 * there (their notes stay); from the meeting or approval only that part moves.
 */
export async function sendBack(input: { reviewId: number; reason: string; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  const reason = clean(input?.reason, 2000).trim()
  if (!reason) return no('Write the reason: the other person sees it.')
  const back = partBack(x.p.step)
  if (!back) return no('This review cannot go back from here.')
  if (!x.isReviewer) return no(`Only ${nameIn(x.a.roster, x.p.reviewerId) || 'the reviewer'} sends this back.`)
  const mark = { sent_back_at: stamp(), sent_back_by: x.a.me, sent_back_reason: reason, sent_back_from: x.p.step }
  if (back === 'self') {
    if (x.r.step === 'approved') return no('This review is approved.')
    const u = await rdb().from('reviews').update({ step: 'self', agreed_at: null, approved_at: null, approved_by: null, ...(x.part === 0 ? mark : {}), updated_at: stamp() }).eq('id', x.r.id).neq('step', 'approved').select('id')
    if (u.error || !u.data?.length) return no(NOT_SAVED)
    if (x.extra) await rdb().from('review_parts').update({ step: 'waiting', agreed_at: null, approved_at: null, approved_by: null, ...(x.part === 1 ? mark : {}), updated_at: stamp() }).eq('id', x.extra.id)
  } else {
    const patch: Record<string, unknown> = { step: back, ...mark }
    if (x.p.step === 'approval') patch.agreed_at = null
    if (!(await setPart(x, x.p.step, patch))) return no(NOT_SAVED)
  }
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'sent_back', text: `${nameIn(x.a.roster, x.a.me)} sent it back to ${back === 'self' ? 'the self-review' : back}: ${reason}` })
  if (back === 'self' || x.p.step === 'approval') {
    await noticeOnce(`review:${x.r.id}:back:${stamp()}`, x.a.roster, x.r.person_id, o => reviewMails.sentBack({ year: x.cycle.year, by: nameIn(x.a.roster, x.a.me), reason, url: reviewUrl(o, x.r.id) }))
  }
  refresh()
  return { ok: true, toast: back === 'self' ? `Sent back to ${nameIn(x.a.roster, x.r.person_id)}, with your reason.` : 'Sent back one step.' }
}

/** "Save and book the meeting": this reviewer's review is done, their meeting step opens. */
export async function finishReview(input: { reviewId: number; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.p.step !== 'review') return no('This review is not waiting for you.')
  if (!(await setPart(x, 'review', { step: 'meeting', review_sent_at: stamp() }))) return no(NOT_SAVED)
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

/**
 * Links the meeting booked in the Agenda's drawer to this reviewer's part.
 * One meeting for both reviewers (owner, 10 November 2026): when the other
 * reviewer is a guest too and their part is at the meeting with none booked,
 * it is theirs as well.
 */
export async function linkMeeting(input: { reviewId: number; eventId: string; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.p.step !== 'meeting') return no('Only the reviewer books the meeting, at the meeting step.')
  const ev = await ownEventWith(x.a.me, x.r.person_id, input?.eventId)
  if (!ev) return no('The meeting was not found in the Agenda. Try booking it again.')
  const when = { meeting_event_id: ev.id, meeting_starts_at: ev.starts_at, meeting_ends_at: ev.ends_at, updated_at: stamp() }
  const u = x.part === 0 ? await rdb().from('reviews').update(when).eq('id', x.r.id) : await rdb().from('review_parts').update(when).eq('id', x.extra!.id)
  if (u.error) return no(NOT_SAVED)
  let joint = ''
  const other = x.parts.find(pt => pt.no !== x.part)
  if (other?.reviewerId && other.step === 'meeting' && !other.meetingStartsAt) {
    const guest = await rdb().from('agenda_event_guests').select('id').eq('event_id', ev.id).eq('person_id', other.reviewerId).limit(1)
    if (guest.data?.length) {
      const w = other.no === 0 ? await rdb().from('reviews').update(when).eq('id', x.r.id) : await rdb().from('review_parts').update(when).eq('id', x.extra!.id)
      if (!w.error) joint = ` ${nameIn(x.a.roster, other.reviewerId)} is in it too: one meeting for both parts.`
    }
  }
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'meeting_booked', text: `${nameIn(x.a.roster, x.a.me)} booked the meeting.` })
  refresh()
  return { ok: true, toast: `Booked. It is on the Agendas and the Google Calendars.${joint}` }
}

export async function saveMeetingNotes(input: { reviewId: number; notes: string; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  if (!x.isReviewer || x.p.step !== 'meeting') return no('The meeting notes are written by the reviewer, at the meeting step.')
  const now = stamp()
  const u = x.part === 0
    ? await rdb().from('reviews').update({ meeting_notes: clean(input?.notes, 20000), updated_at: now }).eq('id', x.r.id).eq('step', 'meeting').select('id')
    : await rdb().from('review_parts').update({ meeting_notes: clean(input?.notes, 20000), updated_at: now }).eq('id', x.extra!.id).eq('step', 'meeting').select('id')
  if (u.error || !u.data?.length) return no('The review moved on. Reload the page.')
  return { ok: true, savedAt: now }
}

/** "I have read and agree": after the meeting, this part goes to its reviewer for approval (both, after a joint meeting). */
export async function agreeReview(input: { reviewId: number; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson) return no('There is nothing to agree to yet.')
  const ready = x.parts.filter(pt => pt.step === 'meeting' && pt.meetingEndsAt && new Date(pt.meetingEndsAt) <= new Date() && (input?.part === undefined || pt.no === input.part || (pt.meetingEventId && pt.meetingEventId === x.p.meetingEventId)))
  if (!ready.length) return no(x.parts.some(pt => pt.step === 'meeting') ? 'You agree after the meeting.' : 'There is nothing to agree to yet.')
  const who = nameIn(x.a.roster, x.r.person_id)
  for (const pt of ready) {
    const ok = pt.no === 0
      ? await setStep(x.r, 'meeting', { step: 'approval', agreed_at: stamp() })
      : !(await rdb().from('review_parts').update({ step: 'approval', agreed_at: stamp(), updated_at: stamp() }).eq('id', x.extra!.id).eq('step', 'meeting')).error
    if (!ok) return no(NOT_SAVED)
    await noticeOnce(`review:${x.r.id}:to-approve:${pt.no}`, x.a.roster, pt.reviewerId, o => reviewMails.toReviewer({ year: x.cycle.year, who, what: 'approve', due: x.cycle.approval_due, days: null, url: reviewUrl(o, x.r.id) }))
  }
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'agreed', text: `${who} read and agreed.` })
  refresh()
  return { ok: true, toast: `Thank you. ${ready.map(pt => nameIn(x.a.roster, pt.reviewerId)).join(' and ')} ${ready.length > 1 ? 'approve' : 'approves'} it next.` }
}

/** One part's approval; the review is approved, its PDF made and copied to Drive, once every part is. */
async function approvePart(x: OnReview): Promise<Done> {
  if (!x.isReviewer || x.p.step !== 'approval') return no('This review is not waiting for your approval.')
  const at = { approved_at: stamp(), approved_by: x.a.me }
  const ok = x.part === 0
    ? await setPart(x, 'approval', { ...at, ...(x.parts.length < 2 ? { step: 'approved', drive_status: 'waiting' } : {}) })
    : await setPart(x, 'approval', { step: 'approved', ...at })
  if (!ok) return no(NOT_SAVED)
  await addLog({ cycle_id: x.cycle.id, review_id: x.r.id, actor_id: x.a.me, kind: 'approved', text: `${nameIn(x.a.roster, x.a.me)} approved the review${x.parts.length > 1 ? ` (${x.p.area || 'their part'})` : ''}.` })
  const done = x.parts.length < 2 || await closeIfAllApproved(x.r.id)
  if (done) {
    await approveReviewWork(x.r.id, x.a.roster, x.a.settings)
    return { ok: true, toast: 'Approved. The PDF is made and on its way to Google Drive.' }
  }
  const other = x.parts.find(pt => pt.no !== x.part)
  return { ok: true, toast: `Approved. It is complete when ${nameIn(x.a.roster, other?.reviewerId) || 'the other reviewer'} approves too.` }
}

export async function approveReview(input: { reviewId: number; part?: PartNo }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part)
  if ('error' in x) return no(x.error!)
  const r = await approvePart(x)
  refresh()
  return r
}

/** "Approve all" (owner, 10 November 2026): every review waiting for the actor's approval this year, after reading each one. */
export async function approveAll(input: { reviewIds: number[] }): Promise<Done> {
  const ids = [...new Set((input?.reviewIds ?? []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200)
  if (!ids.length) return no('Nothing is waiting for your approval.')
  let n = 0
  const failed: string[] = []
  for (const id of ids) {
    const x = await onReview(id)
    if ('error' in x) continue
    if (!x.isReviewer || x.p.step !== 'approval') continue
    const r = await approvePart(x)
    if (r.ok) n++
    else failed.push(nameIn(x.a.roster, x.r.person_id))
  }
  refresh()
  if (!n) return no(failed.length ? `Not approved: ${failed.join(', ')}. Try again.` : 'Nothing is waiting for your approval.')
  return { ok: true, toast: `${n} ${n === 1 ? 'review' : 'reviews'} approved.${failed.length ? ` Not approved: ${failed.join(', ')}.` : ''}` }
}

/** The person read the "approved" window on Home (owner, 10 November 2026). */
export async function markApprovedSeen(input: { reviewId: number }): Promise<Done> {
  const x = await onReview(input?.reviewId)
  if ('error' in x) return no(x.error!)
  if (!x.isPerson || x.r.step !== 'approved') return { ok: true }
  await rdb().from('reviews').update({ approved_seen_at: stamp() }).eq('id', x.r.id).is('approved_seen_at', null)
  refresh()
  return { ok: true }
}

/**
 * "Remind" from the progress block (owner, 10 November 2026): the reminder for
 * where this review is, sent now to whoever it waits for. Once a day per
 * review and step, so a second click sends nothing.
 */
export async function remindNow(input: { reviewId: number; part?: PartNo | null }): Promise<Done> {
  const x = await onReview(input?.reviewId, input?.part ?? undefined)
  if ('error' in x) return no(x.error!)
  const v = x.a.viewer
  if (!v.isVp && !v.isCiso && !v.seesAll) return no('Only the VP of Operations, the CISO and HR send reminders from here.')
  const today = reviewToday()
  const url = (o: string) => reviewUrl(o, x.r.id)
  const who = nameIn(x.a.roster, x.r.person_id)
  if (x.r.step === 'self') {
    const due = x.cycle.self_due
    const { dayDiff } = await import('@/lib/review/rules')
    const sent = await noticeOnce(`nudge:${x.r.id}:self:${today}`, x.a.roster, x.r.person_id, o => reviewMails.selfDue({ year: x.cycle.year, due: due ?? today, days: Math.max(0, due ? dayDiff(today, due) : 0), answered: 0, total: 0, goals: 0, url: url(o) }))
    return sent ? { ok: true, toast: `Reminder sent to ${who}.` } : no(`${who} was reminded today already.`)
  }
  const { partWaitsFor } = await import('@/lib/review/parts')
  const w = partWaitsFor(x.p, x.r.person_id, new Date())
  if (!w || x.p.step === 'approved' || x.p.step === 'waiting') return no('Nothing is waiting on anyone in this part.')
  const what = x.p.step === 'review' ? 'review' : x.p.step === 'meeting' ? 'meeting' : 'approve'
  const sent = w === x.r.person_id
    ? await noticeOnce(`nudge:${x.r.id}:${x.part}:agree:${today}`, x.a.roster, w, o => reviewMails.agree({ year: x.cycle.year, manager: nameIn(x.a.roster, x.p.reviewerId), url: url(o) }))
    : await noticeOnce(`nudge:${x.r.id}:${x.part}:${x.p.step}:${today}`, x.a.roster, w, o => reviewMails.toReviewer({ year: x.cycle.year, who, what, due: null, days: null, url: url(o) }))
  return sent ? { ok: true, toast: `Reminder sent to ${nameIn(x.a.roster, w)}.` } : no(`${nameIn(x.a.roster, w)} was reminded today already.`)
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

const leaderOf = (a: Actor, teamId: string) => a.roster.members.some(m => m.teamId === teamId && m.personId === a.me && isLeadPositionName(m.position))

/**
 * Who writes which priorities (owner, 10 November 2026): the CISO the Company
 * Priorities, the VP of Operations their own, a Team Leader their team's while
 * their own self-review is open. A Super Admin may do any of them.
 */
async function writesPriorities(a: Actor, c: Cycle, kind: 'company' | 'vp' | 'team', teamId: string | null): Promise<string | null> {
  if (a.access.isSuperAdmin) return null
  if (kind === 'company') return a.viewer.isCiso ? null : 'Only the CISO writes the Company Priorities.'
  if (kind === 'vp') return a.viewer.isVp ? null : 'Only the VP of Operations writes these priorities.'
  if (!teamId || !leaderOf(a, teamId)) return 'Only the team\'s Team Leader writes its priorities.'
  const mine = (await rdb().from('reviews').select('step').eq('cycle_id', c.id).eq('person_id', a.me).maybeSingle()).data as { step: string } | null
  return !mine || mine.step === 'self' || mine.step === 'waiting' ? null : 'Your self-review is sent: these priorities are locked now.'
}

/** Adds or saves a priority: the CISO's Company Priorities, the VP of Operations', or a team's. */
export async function savePriority(input: { cycleId: number; id?: number | null; teamId?: string | null; kind?: 'company' | 'vp' | 'team'; title?: string; body?: string; supportsId?: number | null }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  let existing: { id: number; team_id: string | null; kind: 'company' | 'vp' | 'team' } | null = null
  if (input.id) {
    existing = (await rdb().from('review_priorities').select('id, team_id, kind').eq('id', input.id).eq('cycle_id', x.c.id).maybeSingle()).data
    if (!existing) return no('That priority is not there any more. Reload the page.')
  }
  const teamId = existing ? existing.team_id : input.teamId ?? null
  const kind: 'company' | 'vp' | 'team' = existing ? existing.kind ?? (teamId ? 'team' : 'company') : teamId ? 'team' : input.kind === 'vp' ? 'vp' : 'company'
  const refused = await writesPriorities(x.a, x.c, kind, teamId)
  if (refused) return no(refused)
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
  const count = (await (teamId ? base.eq('team_id', teamId) : base.is('team_id', null).eq('kind', kind))).count ?? 0
  if (count >= 12) return no('Twelve priorities is the most.')
  // Added during the 6-month check-in: marked as added, so everyone sees it is new.
  const mid = x.c.checkin_started_at && !teamId ? { mid_status: 'added', mid_at: stamp(), mid_by: x.a.me } : {}
  const r = await c.from('review_priorities').insert({ cycle_id: x.c.id, team_id: teamId, kind, position: count, created_by: x.a.me, ...mid, ...fields }).select('id').single()
  if (r.error) { console.error('[review] priority:', r.error.message); return no(NOT_SAVED) }
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'priority_added', text: `${nameIn(x.a.roster, x.a.me)} added a ${teamId ? `${x.a.roster.teams.get(teamId)?.name ?? 'team'} ` : kind === 'vp' ? 'VP of Operations ' : 'whole-company '}priority.` })
  refresh()
  return { ok: true, id: r.data.id }
}

export async function removePriority(input: { id: number }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  const p = (await rdb().from('review_priorities').select('id, cycle_id, team_id, kind, title').eq('id', Number(input?.id)).maybeSingle()).data as { id: number; cycle_id: number; team_id: string | null; kind: 'company' | 'vp' | 'team'; title: string } | null
  if (!p) return { ok: true }
  const c = (await rdb().from('review_cycles').select('*').eq('id', p.cycle_id).maybeSingle()).data as Cycle | null
  if (!c) return { ok: true }
  const refused = await writesPriorities(a, c, p.kind ?? (p.team_id ? 'team' : 'company'), p.team_id)
  if (refused) return no(refused)
  const r = await rdb().from('review_priorities').delete().eq('id', p.id)
  if (r.error) return no(NOT_SAVED)
  await addLog({ cycle_id: p.cycle_id, actor_id: a.me, kind: 'priority_removed', text: `${nameIn(a.roster, a.me)} removed "${p.title || 'a priority'}".` })
  refresh()
  return { ok: true, toast: 'Priority removed.' }
}

/**
 * "The priorities are ready": the CISO for the Company Priorities, the VP of
 * Operations for theirs. When both are, the goals for next year open in
 * every self-review (schedule.ts goalsOpen).
 */
export async function markPrioritiesReady(input: { cycleId: number; kind: 'company' | 'vp' }): Promise<Done> {
  const x = await onCycle(input?.cycleId)
  if ('error' in x) return no(x.error!)
  const kind = input?.kind === 'vp' ? 'vp' : 'company'
  const refused = await writesPriorities(x.a, x.c, kind, null)
  if (refused) return no(refused)
  const written = (await loadPriorities(x.c.id)).filter(p => !p.team_id && (p.kind ?? 'company') === kind && p.title.trim())
  if (!written.length) return no('Write at least one priority with a title first.')
  const col = kind === 'company' ? 'company_done_at' : 'vp_done_at'
  const r = await rdb().from('review_cycles').update({ [col]: stamp(), updated_at: stamp() }).eq('id', x.c.id)
  if (r.error) return no(NOT_SAVED)
  await addLog({ cycle_id: x.c.id, actor_id: x.a.me, kind: 'priorities_ready', text: `${nameIn(x.a.roster, x.a.me)} marked the ${kind === 'company' ? 'Company Priorities' : "VP of Operations' priorities"} ready.` })
  const both = kind === 'company' ? !!x.c.vp_done_at : !!x.c.company_done_at
  refresh()
  return { ok: true, toast: both ? `Ready. The goals for ${x.c.year + 1} are open in every self-review.` : `Ready. The goals for ${x.c.year + 1} open when the ${kind === 'company' ? "VP of Operations' priorities are" : 'Company Priorities are'} ready too.` }
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
const DATE_KEYS: readonly DateKey[] = ['company_due', 'vp_due', 'self_due', 'review_due', 'leaders_meeting_due', 'meeting_due', 'leaders_approval_due', 'approval_due']

/** Who moves the year's dates: the VP of Operations, HR and Super Admins. */
async function datesWriter() {
  const a = await actor()
  if (!a) return null
  if (a.viewer.isVp || a.viewer.isHr || await allowedTo('cs-hr-edit')) return a
  return null
}

/**
 * "Move a due date" (owner, 10 November 2026): the dates come from the
 * kickoff and can be changed here. Dates out of order are saved and named,
 * so the person can fix them.
 */
export async function saveReviewDates(input: { year: number; dates: Partial<Record<DateKey, string | null>> }): Promise<Done> {
  const a = await datesWriter()
  if (!a) return no('Only the VP of Operations, HR and Super Admins change the review dates.')
  const year = Number(input?.year)
  if (!Number.isInteger(year) || year < 2025 || year > 2100) return no('That is not a year.')
  const c = await loadCycle(year)
  if (!c?.started_at) return no('The dates come from the kickoff: start the reviews first.')
  const patch: Record<string, unknown> = { updated_at: stamp() }
  for (const k of DATE_KEYS) {
    const v = input.dates?.[k]
    if (v === undefined) continue
    if (v === null || !DAY.test(v)) return no('Pick a date.')
    patch[k] = v
  }
  const r = await rdb().from('review_cycles').update(patch).eq('id', c.id)
  if (r.error) { console.error('[review] dates:', r.error.message); return no(NOT_SAVED) }
  await addLog({ cycle_id: c.id, actor_id: a.me, kind: 'dates', text: `${nameIn(a.roster, a.me)} changed the ${year} dates.` })
  const problems = orderProblems({ ...c, ...patch } as Partial<Record<DateKey, string>>, d => fmtDay(d))
  refresh()
  return { ok: true, toast: problems.length ? `Saved. ${problems.join(' ')}` : 'Saved. The reminders follow the new dates.' }
}

/**
 * The dates rule (owner, 10 November 2026): when a step is done before its
 * date, the dates after it may come earlier by the days saved. Nothing is ever
 * pushed later.
 */
export async function moveDatesUp(input: { year: number; key: DateKey }): Promise<Done> {
  const a = await datesWriter()
  if (!a) return no('Only the VP of Operations, HR and Super Admins change the review dates.')
  const c = await loadCycle(Number(input?.year))
  if (!c?.started_at) return no('The reviews have not started.')
  if (!DATE_KEYS.includes(input?.key)) return no('Pick a step.')
  const { loadProgress } = await import('@/lib/review/progress-data')
  const row = (await loadProgress(c, a.roster, a.settings)).rows.find(r => r.dateKey === input.key)
  if (!row || row.done < row.total) return no('That step is not finished yet.')
  const m = moveUp(c as unknown as Partial<Record<DateKey, string>>, input.key, reviewToday())
  if (!m) return no('That step finished on its date: nothing to move.')
  const r = await rdb().from('review_cycles').update({ ...m.patch, updated_at: stamp() }).eq('id', c.id)
  if (r.error) return no(NOT_SAVED)
  await addLog({ cycle_id: c.id, actor_id: a.me, kind: 'dates', text: `${nameIn(a.roster, a.me)} moved the dates after "${row.label}" up by ${m.days} ${m.days === 1 ? 'day' : 'days'}.` })
  refresh()
  return { ok: true, toast: `The later dates are ${m.days} ${m.days === 1 ? 'day' : 'days'} earlier. The reminders follow them.` }
}

/** Saves the three roles, or who takes part beyond the employees. */
export async function saveHrSettings(input: { vpId?: string | null; cisoId?: string | null; hrId?: string | null; extra?: string[]; second?: { personId: string; reviewerId?: string | null; area?: string } }): Promise<Done> {
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
  if (input.second !== undefined) {
    // A second reviewer by hand, or none, over the rule (owner, 10 November 2026). Super Admins only, like the roles.
    if (!(await allowedTo('cs-hr-edit'))) return no('Only a Super Admin changes who reviews whom.')
    const { personId, reviewerId, area } = input.second
    if (!a.roster.people.get(personId)?.active) return no('Pick an active person.')
    const next = { ...cleanOverrides((await rdb().from('hr_settings').select('second_reviewers').eq('singleton_id', 1).maybeSingle()).data?.second_reviewers) } as Record<string, { reviewerId: string; area: string } | false>
    if (reviewerId === undefined) delete next[personId]
    else if (reviewerId === null) next[personId] = false
    else {
      if (reviewerId === personId || !a.roster.people.get(reviewerId)?.active) return no('Pick an active person other than them.')
      next[personId] = { reviewerId, area: clean(area, 120).trim() || 'Second team' }
    }
    patch.second_reviewers = next
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

/**
 * "Start Reviews" (owner, 10 November 2026): the VP of Operations starts the
 * current year, a Super Admin as back-up. Every due date comes from today
 * (schedule.ts planFrom), everyone's self-review opens, and the CISO and the
 * VP are asked for the priorities.
 */
export async function startCycle(input: { year: number }): Promise<Done> {
  const a = await actor()
  if (!a) return no('Sign in again to do this.')
  if (!a.viewer.isVp && !(await allowedTo('hr-start'))) return no('Only the VP of Operations starts the reviews.')
  const year = Number(input?.year)
  if (year !== defaultYear()) return no(`Only the current year, ${defaultYear()}, can be started.`)
  if (!a.settings.vpId || !a.settings.cisoId) return no('Pick the VP of Operations and the CISO in Company settings › Human Resources first.')
  const c = await ensureYearCycle(year)
  if (c.started_at) return no(`The ${c.year} reviews have already started.`)
  const today = reviewToday()
  const plan = planFrom(today)
  const u = await rdb().from('review_cycles').update({ ...plan, leaders_open_on: today, leaders_due: null, teams_open_by: null, checkins_by: sixMonthsAfter(today), started_at: stamp(), started_by: a.me, updated_at: stamp() })
    .eq('id', c.id).is('started_at', null).select('id')
  if (u.error || !u.data?.length) return no(`The ${c.year} reviews have already started.`)
  const started = (await loadCycle(year))!
  await addLog({ cycle_id: c.id, actor_id: a.me, kind: 'started', text: `${nameIn(a.roster, a.me)} started the ${c.year} reviews.` })
  const { opened } = await syncCycle(started)
  await sendOpenedNotices(started, opened)
  const url = (o: string) => `${o}/human-resources/reviews/priorities`
  await noticeOnce(`cycle:${c.id}:ask:company`, a.roster, a.settings.cisoId, o => reviewMails.prioritiesAsk({ year: c.year, which: 'company', due: plan.company_due, days: null, url: url(o) }))
  await noticeOnce(`cycle:${c.id}:ask:vp`, a.roster, a.settings.vpId, o => reviewMails.prioritiesAsk({ year: c.year, which: 'vp', due: plan.vp_due, days: null, url: url(o) }))
  refresh()
  return { ok: true, toast: `The ${c.year} reviews started. ${opened.length} self-review${opened.length === 1 ? '' : 's'} opened; everything is due by ${fmtDay(plan.approval_due)}.` }
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

