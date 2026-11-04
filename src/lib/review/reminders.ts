/**
 * The annual review's daily job (design handoff, B2): opens what is due to
 * open, and sends the reminders, by email, 1 week before, 3 days before and
 * on the day of every due date: each step (to whoever it waits for), the team
 * priorities to approve (VP of Operations and CISO), each goal (the end of
 * its month), and the 6-month check-ins (the managers get the list a month
 * before "Check-ins by", then a reminder for each one not booked yet).
 * Nothing after the date. Each notice has its own key, so a second run on the
 * same day sends nothing again. Needs you shows the same rows from the state.
 */

import { checkinsOpenOn, dayDiff, dueOf, monthEnd, monthLabel, reminderToday, waitsFor } from './rules'
import {
  loadCheckins, loadCurrentCycle, loadHrSettings, loadReviews, loadRoster, loadTeamStates, nameIn, rdb, reviewToday, rosterParticipants, syncCycle,
  type Cycle, type Goal, type ReviewRow,
} from './data'
import { answeredCount, loadReviewView } from './view'
import { firstName, noticeOnce } from './notify'
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
    const [reviews, states] = await Promise.all([loadReviews(cycle.id), loadTeamStates(cycle.id)])
    for (const r of reviews) {
      const due = dueOf(r.step, r.phase, cycle)
      const n = reminderToday(due, today)
      if (n === null || !due) continue
      const w = waitsFor({ step: r.step, personId: r.person_id, reviewerId: r.reviewer_id, meetingEndsAt: r.meeting_ends_at, agreedAt: r.agreed_at }, now)
      if (!w) continue
      const key = `remind:${r.id}:${r.step}:${due}:${n}`
      const url = (o: string) => `${o}/human-resources/reviews/${r.id}`
      if (r.step === 'self') {
        const v = await loadReviewView(r.id, 'server', roster, now)
        const a = v ? answeredCount(v, 'own') : { done: 0, total: 12 }
        count(await noticeOnce(key, roster, w, o => reviewMails.selfDue({ year: cycle.year, due, days: n, answered: a.done, total: a.total, goals: v?.goals.length ?? 0, url: url(o) })))
      } else if (r.step === 'meeting' && w === r.person_id) {
        count(await noticeOnce(`${key}:agree`, roster, w, o => reviewMails.agree({ year: cycle.year, manager: nameIn(roster, r.reviewer_id), url: url(o) })))
      } else {
        const what = r.step === 'review' ? 'review' : r.step === 'meeting' ? 'meeting' : 'approve'
        count(await noticeOnce(key, roster, w, o => reviewMails.toReviewer({ year: cycle.year, who: nameIn(roster, r.person_id), what, due, days: n, url: url(o) })))
      }
    }
    // Team priorities waiting: the VP of Operations and the CISO, before "Teams open by".
    const n = reminderToday(cycle.teams_open_by, today)
    if (n !== null) {
      for (const st of states.values()) {
        if (st.state !== 'sent') continue
        for (const to of [settings.vpId, settings.cisoId]) {
          count(await noticeOnce(`remind:team:${cycle.id}:${st.team_id}:${n}:${to}`, roster, to, o => reviewMails.teamPriorities({ year: cycle.year, leader: nameIn(roster, st.sent_by), team: roster.teams.get(st.team_id)?.name ?? 'team', url: `${o}/human-resources/reviews/priorities` })))
        }
      }
    }
  }

  // Goals and check-ins: every person's latest approved review.
  const approved = ((await rdb().from('reviews').select('id, cycle_id, person_id, approved_at').eq('step', 'approved').order('approved_at', { ascending: false }).limit(2000)).data ?? []) as Pick<ReviewRow, 'id' | 'cycle_id' | 'person_id' | 'approved_at'>[]
  const latest = new Map<string, (typeof approved)[number]>()
  for (const r of approved) if (!latest.has(r.person_id)) latest.set(r.person_id, r)
  if (latest.size) {
    const parts = rosterParticipants(roster, settings)
    const managerOf = new Map(parts.map(p => [p.personId, p.reviewerId]))
    const goals = ((await rdb().from('review_goals').select('*').in('review_id', [...latest.values()].map(r => r.id))).data ?? []) as Goal[]
    for (const g of goals) {
      if (!g.by_month || g.status === 'done' || g.status === 'dropped') continue
      const n = reminderToday(monthEnd(g.by_month), today)
      if (n === null) continue
      count(await noticeOnce(`goal:${g.id}:${g.by_month}:${n}`, roster, g.person_id, o => reviewMails.goalDue({ year: Number(g.by_month!.slice(0, 4)) - 1, goal: g.what, month: monthLabel(g.by_month), manager: nameIn(roster, managerOf.get(g.person_id)), url: `${o}/human-resources?tab=goals` })))
    }
    // Check-ins, per cycle.
    const cycles = new Map<number, Cycle>()
    for (const id of new Set([...latest.values()].map(r => r.cycle_id))) {
      const c = (await rdb().from('review_cycles').select('*').eq('id', id).maybeSingle()).data as Cycle | null
      if (c?.checkins_by) cycles.set(id, c)
    }
    for (const [cid, c] of cycles) {
      const by = c.checkins_by!
      const people = [...latest.values()].filter(r => r.cycle_id === cid).map(r => r.person_id)
      const checkins = await loadCheckins(cid, people)
      const byManager = new Map<string, string[]>()
      for (const p of people) { const m = managerOf.get(p); if (m) (byManager.get(m) ?? byManager.set(m, []).get(m)!).push(p) }
      if (today === checkinsOpenOn(by)) {
        for (const [m, ps] of byManager) count(await noticeOnce(`checkins-open:${cid}:${m}`, roster, m, o => reviewMails.checkinsOpen({ year: c.year, first: firstName(nameIn(roster, m)), by, names: ps.map(p => nameIn(roster, p)), url: `${o}/human-resources?tab=team` })))
      }
      const n = reminderToday(by, today)
      if (n === null || dayDiff(today, by) < 0) continue
      for (const [m, ps] of byManager) for (const p of ps) {
        const ck = checkins.get(p)
        if (ck?.event_id || ck?.finished_at) continue
        count(await noticeOnce(`checkin-due:${cid}:${p}:${n}`, roster, m, o => reviewMails.checkinDue({ year: c.year, who: nameIn(roster, p), by, days: n, url: `${o}/human-resources/team-goals/${p}` })))
      }
    }
  }
  return { opened, sent }
}
