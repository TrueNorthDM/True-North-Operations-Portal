/**
 * The annual review's rows in Home's Needs you (design handoff, B2): every
 * step that needs someone to act is a row for that person, and the row goes
 * away when the step is done. Worked out from the review's state on every
 * read, so nothing has to be cleared by hand.
 */

import type { HomeRow } from '@/lib/home/needs-you-model'
import { dueOnDay } from '@/lib/home/needs-you-model'
import { checkinsOpenOn, dayDiff, decidesTeam, dueOf, dueWords, monthEnd, startRowShows, waitsFor } from './rules'
import { fmtDay, fmtInstantDay } from './format'
import {
  loadCheckins, loadCurrentCycle, loadHrSettings, loadReviews, loadRoster, loadTeamStates, nameIn, rdb, rosterParticipants, viewerOf,
  type Goal, type ReviewRow,
} from './data'

// "the Writing Team", "the Operations team": how a row names a team.
const teamOf = (name: string | undefined) => `the ${name ?? 'team'}${name && /\bteam$/i.test(name) ? '' : ' team'}`
const dueSub = (word: string, due: string | null, today: string) => due ? `${word} ${fmtDay(due)} · ${dueWords(due, today)}` : ''

const row = (key: string, title: string, sub: string, due: HomeRow['due'], href: string, button = 'Open'): HomeRow =>
  ({ key: `review:${key}`, kind: 'review', title, sub, due, button, panel: null, href })

export async function reviewNeedsRows(access: { personId: string | null; isSuperAdmin: boolean }, today: string, now = new Date()): Promise<HomeRow[]> {
  const me = access.personId
  if (!me) return []
  const out: HomeRow[] = []
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const parts = rosterParticipants(roster, settings)
  const viewer = viewerOf(access, settings, parts)
  const cycle = await loadCurrentCycle()

  // A Super Admin starts the year's cycle (A5): asked a week before Team Leaders open.
  if (cycle && access.isSuperAdmin && startRowShows(today, cycle.leaders_open_on, !!cycle.started_at)) {
    out.push(row(`start:${cycle.year}`, `Start the ${cycle.year} review cycle`, `Team Leaders open on ${fmtDay(cycle.leaders_open_on)} · Human Resources › Reviews`, dueOnDay(cycle.leaders_open_on!, today), '/human-resources/reviews', 'Start'))
  }

  if (cycle?.started_at) {
    const [reviews, states] = await Promise.all([loadReviews(cycle.id), loadTeamStates(cycle.id)])
    for (const r of reviews) {
      const w = waitsFor({ step: r.step, personId: r.person_id, reviewerId: r.reviewer_id, meetingEndsAt: r.meeting_ends_at, agreedAt: r.agreed_at }, now)
      if (w !== me) continue
      const due = dueOf(r.step, r.phase, cycle)
      const d = due ? dueOnDay(due, today) : null
      const href = `/human-resources/reviews/${r.id}`
      const who = nameIn(roster, r.person_id)
      const by = nameIn(roster, r.reviewer_id)
      if (r.person_id === me && r.step === 'self') out.push(row(`${r.id}:self`, r.sent_back_at ? 'Your self-review came back' : 'Write your self-review', r.sent_back_at ? `${nameIn(roster, r.sent_back_by)} sent it back with a reason` : dueSub('Due', due, today) || `Your ${cycle.year} review`, d, href, 'Open'))
      else if (r.person_id === me && r.step === 'meeting') out.push(row(`${r.id}:agree`, 'Read and agree your review', `The meeting with ${by} is done`, dueOnDay(today, today), href, 'Read and agree'))
      else if (r.step === 'review') out.push(row(`${r.id}:review`, `Review ${who}'s self-review`, dueSub('Due', due, today) || `${cycle.year} review`, d, href, 'Review'))
      else if (r.step === 'meeting' && r.meeting_starts_at) out.push(row(`${r.id}:meeting`, `Meeting with ${who}`, `Booked for ${fmtInstantDay(r.meeting_starts_at)} · write the notes after it`, null, href, 'Open'))
      else if (r.step === 'meeting') out.push(row(`${r.id}:meeting`, `Book the meeting with ${who}`, dueSub('By', due, today) || `${cycle.year} review`, d, href, 'Book'))
      else if (r.step === 'approval') out.push(row(`${r.id}:approve`, `Approve ${who}'s review`, dueSub('By', due, today) || `${who} read and agreed`, d, href, 'Approve'))
    }
    // A Team Leader's priorities to send (phase 1).
    const mine = reviews.find(r => r.person_id === me)
    for (const teamId of parts.find(p => p.personId === me)?.leads ?? []) {
      const st = states.get(teamId)?.state ?? 'draft'
      if (st === 'draft' || st === 'returned') {
        out.push(row(`team:${teamId}`, `Send ${teamOf(roster.teams.get(teamId)?.name)}'s priorities`, st === 'returned' ? 'Sent back with a reason' : 'In your self-review, so your team can start', cycle.leaders_due ? dueOnDay(cycle.leaders_due, today) : null, mine ? `/human-resources/reviews/${mine.id}` : '/human-resources', 'Open'))
      }
    }
    // The VP of Operations and the CISO: team priorities waiting.
    if (viewer.isVp || viewer.isCiso) {
      for (const st of states.values()) {
        if (st.state !== 'sent' || !decidesTeam(me, true, st.team_id, roster.members, settings)) continue
        out.push(row(`approve-team:${st.team_id}`, `Approve ${teamOf(roster.teams.get(st.team_id)?.name)}'s priorities`, `From ${nameIn(roster, st.sent_by)} · VP of Operations and CISO`, cycle.teams_open_by ? dueOnDay(cycle.teams_open_by, today) : null, '/human-resources/reviews/priorities', 'Approve'))
      }
    }
  }

  // Goals during the year: the person's own, due this month; the manager's check-ins to book.
  const approved = ((await rdb().from('reviews').select('id, cycle_id, person_id, reviewer_id, approved_at').eq('step', 'approved').or(`person_id.eq.${me}${viewer.reports.size ? `,person_id.in.(${[...viewer.reports].join(',')})` : ''}`).order('approved_at', { ascending: false }).limit(500)).data ?? []) as Pick<ReviewRow, 'id' | 'cycle_id' | 'person_id' | 'reviewer_id' | 'approved_at'>[]
  const latest = new Map<string, (typeof approved)[number]>()
  for (const r of approved) if (!latest.has(r.person_id)) latest.set(r.person_id, r)

  const own = latest.get(me)
  if (own) {
    const goals = ((await rdb().from('review_goals').select('*').eq('review_id', own.id)).data ?? []) as Goal[]
    for (const g of goals) {
      if (!g.by_month || g.status === 'done' || g.status === 'dropped') continue
      const end = monthEnd(g.by_month)
      const days = dayDiff(today, end)
      if (days <= 7 && days >= -7) out.push(row(`goal:${g.id}`, `Update your goal: ${g.what}`, 'Say where it is', dueOnDay(end, today), '/human-resources?tab=goals', 'Update'))
    }
    const ck = (await loadCheckins(own.cycle_id, [me])).get(me)
    if (ck?.finished_at && dayDiff(ck.finished_at.slice(0, 10), today) <= 7) out.push(row(`checkin-done:${own.cycle_id}`, 'Read the comments on your goals', `${nameIn(roster, ck.manager_id)} finished your 6-month check-in`, null, '/human-resources?tab=goals', 'Open'))
  }

  for (const personId of viewer.reports) {
    const r = latest.get(personId)
    if (!r) continue
    const c = (await rdb().from('review_cycles').select('checkins_by').eq('id', r.cycle_id).maybeSingle()).data as { checkins_by: string | null } | null
    if (!c?.checkins_by || today < checkinsOpenOn(c.checkins_by)) continue
    const ck = (await loadCheckins(r.cycle_id, [personId])).get(personId)
    if (ck?.event_id || ck?.finished_at) continue
    const who = nameIn(roster, personId)
    out.push(row(`checkin:${r.cycle_id}:${personId}`, `Book ${who}'s 6-month check-in`, 'Book opens the Agenda, filled in', dueOnDay(c.checkins_by, today), `/human-resources/team-goals/${personId}?book=1`, 'Book'))
  }
  return out
}
