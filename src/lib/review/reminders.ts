/**
 * The annual review's daily job (owner, 10 November 2026): keeps the year
 * current and sends the reminders by email, 3 days before, the day before and
 * on the day of every due date: the CISO's and the VP of Operations'
 * priorities, each Team Leader's team priorities, each step (to whoever it
 * waits for, one part at a time with two reviewers), each goal (the end of its
 * month), and the 6-month check-in's booking and finishing. Nothing after the
 * date. Each notice has its own key, so a second run on the same day sends
 * nothing again. Needs you shows the same rows from the state.
 */

import { dueOf, monthEnd, monthLabel, reminderToday } from './rules'
import {
  loadAllCheckins, loadCurrentCycle, loadCycles, loadHrSettings, loadParts, loadPriorities, loadReviews, loadRoster, nameIn, rdb, reviewToday, rosterParticipants, syncCycle,
  type Goal, type ReviewRow,
} from './data'
import { partsOf, partWaitsFor } from './parts'
import { answeredCount, loadReviewView } from './view'
import { noticeOnce } from './notify'
import { reviewMails } from './emails'
import { sendOpenedNotices } from './service'

export interface NoticeReport { opened: number; sent: number }

export async function runReviewNotices(now = new Date()): Promise<NoticeReport> {
  const today = reviewToday(now)
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  let sent = 0, opened = 0
  const count = (ok: boolean) => { if (ok) sent++ }

  const cycle = await loadCurrentCycle()
  if (cycle?.started_at) {
    const o = await syncCycle(cycle, now)
    opened = o.opened.length
    await sendOpenedNotices(cycle, o.opened)
    const reviews = await loadReviews(cycle.id)
    const extra = await loadParts(reviews.map(r => r.id))
    const priUrl = (o: string) => `${o}/human-resources/reviews/priorities`

    // The priorities: the CISO's, then the VP's, until marked ready.
    for (const [which, due, done, to] of [['company', cycle.company_due, cycle.company_done_at, settings.cisoId], ['vp', cycle.vp_due, cycle.vp_done_at, settings.vpId]] as const) {
      const n = reminderToday(due ?? null, today)
      if (n === null || done || !due) continue
      count(await noticeOnce(`remind:${which}:${cycle.id}:${due}:${n}`, roster, to, o => reviewMails.prioritiesAsk({ year: cycle.year, which, due, days: n, url: priUrl(o) })))
    }

    // A Team Leader's team priorities, while none are written.
    const nl = reminderToday(cycle.self_due, today)
    if (nl !== null && cycle.self_due) {
      const priorities = await loadPriorities(cycle.id)
      for (const p of rosterParticipants(roster, settings)) {
        const empty = (p.leads ?? []).filter(t => !priorities.some(x => x.team_id === t && x.title.trim()))
        if (!empty.length) continue
        const mine = reviews.find(r => r.person_id === p.personId)
        if (!mine || mine.step !== 'self') continue
        count(await noticeOnce(`remind:leader:${cycle.id}:${p.personId}:${nl}`, roster, p.personId, o => reviewMails.prioritiesDue({ year: cycle.year, due: cycle.self_due!, days: nl, teams: empty.map(t => roster.teams.get(t)?.name ?? 'team'), url: `${o}/human-resources/reviews/${mine.id}` })))
      }
    }

    for (const r of reviews) {
      const url = (o: string) => `${o}/human-resources/reviews/${r.id}`
      if (r.step === 'self') {
        const due = dueOf('self', r.phase, cycle)
        const n = reminderToday(due, today)
        if (n === null || !due) continue
        const v = await loadReviewView(r.id, 'server', roster, now)
        const a = v ? answeredCount(v, 'own') : { done: 0, total: 12 }
        count(await noticeOnce(`remind:${r.id}:self:${due}:${n}`, roster, r.person_id, o => reviewMails.selfDue({ year: cycle.year, due, days: n, answered: a.done, total: a.total, goals: v?.goals.length ?? 0, url: url(o) })))
        continue
      }
      for (const p of partsOf(r, extra)) {
        if (p.step === 'waiting' || p.step === 'approved') continue
        // Booked: nothing to remind until the meeting is held, when the person is asked to agree.
        if (p.step === 'meeting' && p.meetingStartsAt && !(p.meetingEndsAt && new Date(p.meetingEndsAt) <= now)) continue
        const due = dueOf(p.step, p.lane, cycle)
        const n = reminderToday(due, today)
        if (n === null || !due) continue
        const w = partWaitsFor(p, r.person_id, now)
        if (!w) continue
        const key = `remind:${r.id}:${p.no}:${p.step}:${due}:${n}`
        if (p.step === 'meeting' && w === r.person_id) {
          count(await noticeOnce(`${key}:agree`, roster, w, o => reviewMails.agree({ year: cycle.year, manager: nameIn(roster, p.reviewerId), url: url(o) })))
        } else {
          const what = p.step === 'review' ? 'review' : p.step === 'meeting' ? 'meeting' : 'approve'
          count(await noticeOnce(key, roster, w, o => reviewMails.toReviewer({ year: cycle.year, who: nameIn(roster, r.person_id), what, due, days: n, url: url(o) })))
        }
      }
    }
  }

  // The 6-month check-in, after "tell everyone": each reviewer, to book and to finish.
  for (const c of (await loadCycles()).filter(x => x.checkin_told_at)) {
    const reviews = (await loadReviews(c.id)).filter(r => r.step === 'approved')
    const extra = await loadParts(reviews.map(r => r.id))
    const checkins = await loadAllCheckins(c.id)
    for (const r of reviews) {
      for (const p of partsOf(r, extra)) {
        const ck = checkins.find(x => x.person_id === r.person_id && x.part === p.no)
        if (ck?.finished_at) continue
        const due = ck?.starts_at ? c.ck_done_due : c.ck_book_due
        const n = reminderToday(due ?? null, today)
        if (n === null || !due) continue
        count(await noticeOnce(`ck:${c.id}:${r.id}:${p.no}:${ck?.starts_at ? 'done' : 'book'}:${n}`, roster, p.reviewerId, o => reviewMails.checkinDue({ year: c.year, who: nameIn(roster, r.person_id), by: due, days: n, url: `${o}/human-resources/reviews/${r.id}?tab=checkin` })))
      }
    }
  }

  // Goals: every person's latest approved review, at the end of each goal's month.
  const approved = ((await rdb().from('reviews').select('id, cycle_id, person_id, approved_at').eq('step', 'approved').order('approved_at', { ascending: false }).limit(2000)).data ?? []) as Pick<ReviewRow, 'id' | 'cycle_id' | 'person_id' | 'approved_at'>[]
  const latest = new Map<string, (typeof approved)[number]>()
  for (const r of approved) if (!latest.has(r.person_id)) latest.set(r.person_id, r)
  if (latest.size) {
    const managerOf = new Map(rosterParticipants(roster, settings).map(p => [p.personId, p.reviewerId]))
    const goals = ((await rdb().from('review_goals').select('*').in('review_id', [...latest.values()].map(r => r.id))).data ?? []) as Goal[]
    for (const g of goals) {
      if (!g.by_month || g.status === 'done' || g.status === 'dropped') continue
      const n = reminderToday(monthEnd(g.by_month), today)
      if (n === null) continue
      count(await noticeOnce(`goal:${g.id}:${g.by_month}:${n}`, roster, g.person_id, o => reviewMails.goalDue({ year: Number(g.by_month!.slice(0, 4)) - 1, goal: g.what, month: monthLabel(g.by_month), manager: nameIn(roster, managerOf.get(g.person_id)), url: `${o}/human-resources?tab=goals` })))
    }
  }
  return { opened, sent }
}
