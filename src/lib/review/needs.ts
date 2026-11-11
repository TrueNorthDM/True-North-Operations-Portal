/**
 * The annual review's rows in Home's Needs you (owner, 10 November 2026):
 * every step that needs someone to act is a row for that person, on their
 * turn, and the row goes away when the step is done. Worked out from the
 * review's state on every read, so nothing has to be cleared by hand.
 *
 *   VP of Operations   start the year (from the second Monday of November),
 *                      their priorities, the people 2 days late, the 6-month
 *                      check-in (six months after the kickoff);
 *   CISO               the Company Priorities;
 *   a Team Leader      their team's priorities, first in their self-review;
 *   the person         the self-review, read and agree, "approved" (until they
 *                      read the window), the check-in;
 *   each reviewer      review and book, the meeting, approve, the check-in.
 */

import type { HomeRow } from '@/lib/home/needs-you-model'
import { dueOnDay } from '@/lib/home/needs-you-model'
import { dayDiff, dueOf, dueWords, monthEnd } from './rules'
import { kickoffRowShows } from './schedule'
import { partsOf, partWaitsFor } from './parts'
import { fmtDay, fmtInstantDay } from './format'
import {
  defaultYear, loadAllCheckins, loadCurrentCycle, loadCycles, loadHrSettings, loadParts, loadPriorities, loadReviews, loadRoster, nameIn, rdb,
  rosterParticipants, viewerOf, type Cycle, type Goal, type ReviewRow,
} from './data'

// "the Writing Team", "the Operations team": how a row names a team.
const teamOf = (name: string | undefined) => `the ${name ?? 'team'}${name && /\bteam$/i.test(name) ? '' : ' team'}`
const dueSub = (word: string, due: string | null | undefined, today: string) => due ? `${word} ${fmtDay(due)} · ${dueWords(due, today)}` : ''

const row = (key: string, title: string, sub: string, due: HomeRow['due'], href: string, button = 'Open'): HomeRow =>
  ({ key: `review:${key}`, kind: 'review', title, sub, due, button, panel: null, href })

export async function reviewNeedsRows(access: { personId: string | null; isSuperAdmin: boolean }, today: string, now = new Date()): Promise<HomeRow[]> {
  const me = access.personId
  if (!me) return []
  const out: HomeRow[] = []
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const people = rosterParticipants(roster, settings)
  const viewer = viewerOf(access, settings, people)
  const cycle = await loadCurrentCycle()
  // The VP starts the year; with no VP picked, the Super Admins are asked.
  const starter = viewer.isVp || (!settings.vpId && access.isSuperAdmin)

  // Start the year: from the second Monday of November until it is started.
  const year = defaultYear(now)
  const thisYear = cycle?.year === year ? cycle : null
  if (starter && kickoffRowShows(today, year, !!thisYear?.started_at)) {
    out.push(row(`start:${year}`, `Start the ${year} reviews`, 'Every November · Human Resources › Reviews', dueOnDay(today, today), '/human-resources/reviews?start=1', 'Start Reviews'))
  }

  if (cycle?.started_at) {
    const reviewsHref = '/human-resources/reviews'
    // The priorities: the CISO's, then the VP's.
    if (viewer.isCiso && !cycle.company_done_at) {
      out.push(row(`company:${cycle.id}`, `Write the Company Priorities for ${cycle.year + 1}`, 'Every review shows them; mark them ready when done', cycle.company_due ? dueOnDay(cycle.company_due, today) : null, `${reviewsHref}/priorities`, 'Open'))
    }
    if (viewer.isVp && !cycle.vp_done_at) {
      out.push(row(`vp:${cycle.id}`, `Add your priorities for ${cycle.year + 1}`, cycle.company_done_at ? 'The Company Priorities are ready' : 'After the CISO\'s Company Priorities', cycle.vp_due ? dueOnDay(cycle.vp_due, today) : null, `${reviewsHref}/priorities`, 'Open'))
    }

    const reviews = await loadReviews(cycle.id)
    const extra = await loadParts(reviews.map(r => r.id))
    const priorities = await loadPriorities(cycle.id)
    for (const r of reviews) {
      const href = `/human-resources/reviews/${r.id}`
      const who = nameIn(roster, r.person_id)
      const parts = partsOf(r, extra)
      if (r.person_id === me) {
        if (r.step === 'self') {
          // A Team Leader starts with their team's priorities.
          const empty = (people.find(p => p.personId === me)?.leads ?? []).filter(t => !priorities.some(p => p.team_id === t && p.title.trim()))
          if (empty.length) out.push(row(`team:${r.id}`, `Write ${teamOf(roster.teams.get(empty[0])?.name)}'s priorities for ${cycle.year + 1}`, 'First thing in your self-review: your team builds its goals on them', cycle.self_due ? dueOnDay(cycle.self_due, today) : null, href, 'Open'))
          const due = dueOf('self', r.phase, cycle)
          out.push(row(`${r.id}:self`, r.sent_back_at ? 'Your self-review came back' : 'Write your self-review', r.sent_back_at ? `${nameIn(roster, r.sent_back_by)} sent it back with a reason` : dueSub('Due', due, today) || `Your ${cycle.year} review`, due ? dueOnDay(due, today) : null, href, 'Open'))
        }
        for (const p of parts) {
          if (partWaitsFor(p, me, now) === me && p.step === 'meeting') {
            out.push(row(`${r.id}:agree:${p.no}`, 'Read and agree your review', `The meeting with ${nameIn(roster, p.reviewerId)} is done`, dueOnDay(today, today), href, 'Read and agree'))
          }
        }
        if (r.step === 'approved' && !r.approved_seen_at) {
          out.push(row(`${r.id}:approved`, `Your ${cycle.year} review is approved`, 'Your goals are recorded on your profile', null, `${href}?approved=1`, 'See my review'))
        }
        continue
      }
      for (const p of parts) {
        if (p.reviewerId !== me || p.step === 'waiting' || p.step === 'approved') continue
        if (partWaitsFor(p, r.person_id, now) !== me) continue
        const due = dueOf(p.step, p.lane, cycle)
        const d = due ? dueOnDay(due, today) : null
        const area = parts.length > 1 && p.area ? ` (${p.area})` : ''
        if (p.step === 'review') out.push(row(`${r.id}:review:${p.no}`, `Review ${who}${area} and book the meeting`, dueSub('Due', due, today) || 'Their self-review is in', d, href, 'Review'))
        else if (p.step === 'meeting' && p.meetingStartsAt) out.push(row(`${r.id}:meeting:${p.no}`, `Meeting with ${who}${area}`, `Booked for ${fmtInstantDay(p.meetingStartsAt)} · write the notes after it`, null, href, 'Open'))
        else if (p.step === 'meeting') out.push(row(`${r.id}:meeting:${p.no}`, `Book the meeting with ${who}${area}`, dueSub('By', due, today) || `${cycle.year} review`, d, href, 'Book'))
        else if (p.step === 'approval') out.push(row(`${r.id}:approve:${p.no}`, `Final remarks and approval: ${who}${area}`, dueSub('By', due, today) || `${who} read and agreed`, d, href, 'Approve'))
      }
    }

    // The VP: anyone 2 days late or more, in one row.
    if (viewer.isVp) {
      const late = new Set<string>()
      for (const r of reviews) {
        if (r.step === 'approved') continue
        const parts = partsOf(r, extra)
        const steps = r.step === 'self' ? [{ due: dueOf('self', r.phase, cycle) }] : parts.filter(p => p.step !== 'approved' && p.step !== 'waiting').map(p => ({ due: dueOf(p.step, p.lane, cycle) }))
        if (steps.some(s => s.due && dayDiff(s.due, today) >= 2)) late.add(nameIn(roster, r.person_id))
      }
      if (late.size) {
        const names = [...late].sort()
        out.push(row(`late:${cycle.id}`, `${late.size} ${late.size === 1 ? 'review is' : 'reviews are'} late`, names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : ''), { label: 'Late', tone: 'late', at: today }, reviewsHref, 'See'))
      }
    }
  }

  // The 6-month check-in: the VP starts it six months after the kickoff; then each person and each reviewer.
  const cycles = (await loadCycles()).filter(c => c.started_at && c.checkins_by)
  for (const c of cycles) {
    if (viewer.isVp && !c.checkin_started_at && today >= c.checkins_by!) {
      out.push(row(`checkin-start:${c.id}`, 'Start the 6-month check-in', `The ${c.year} reviews started ${fmtInstantDay(c.started_at)}`, dueOnDay(c.checkins_by!, today), '/human-resources/reviews?checkin=1', 'Start check-in'))
    }
    if (viewer.isVp && c.checkin_started_at && !c.checkin_told_at) {
      out.push(row(`checkin-pri:${c.id}`, 'Check the Company Priorities with the CISO', 'Kept, changed or added, then tell everyone', c.ck_priorities_due ? dueOnDay(c.ck_priorities_due, today) : null, '/human-resources/reviews/priorities?checkin=1', 'Open'))
    }
    if (!c.checkin_told_at) continue
    await checkinRows(c, me, roster, today, out)
  }

  // Goals during the year: the person's own, due this month.
  const own = ((await rdb().from('reviews').select('id, cycle_id').eq('step', 'approved').eq('person_id', me).order('approved_at', { ascending: false }).limit(1)).data ?? [])[0] as Pick<ReviewRow, 'id' | 'cycle_id'> | undefined
  if (own) {
    const goals = ((await rdb().from('review_goals').select('*').eq('review_id', own.id)).data ?? []) as Goal[]
    for (const g of goals) {
      if (!g.by_month || g.status === 'done' || g.status === 'dropped') continue
      const end = monthEnd(g.by_month)
      const days = dayDiff(today, end)
      if (days <= 7 && days >= -7) out.push(row(`goal:${g.id}`, `Update your goal: ${g.what}`, 'Say where it is', dueOnDay(end, today), '/human-resources?tab=goals', 'Update'))
    }
  }
  return out
}

/** After "tell everyone": the person's check-in, and each reviewer's to book and to finish. */
async function checkinRows(c: Cycle, me: string, roster: Awaited<ReturnType<typeof loadRoster>>, today: string, out: HomeRow[]) {
  const reviews = (await loadReviews(c.id)).filter(r => r.step === 'approved')
  const extra = await loadParts(reviews.map(r => r.id))
  const checkins = await loadAllCheckins(c.id)
  for (const r of reviews) {
    const href = `/human-resources/reviews/${r.id}?tab=checkin`
    for (const p of partsOf(r, extra)) {
      const ck = checkins.find(x => x.person_id === r.person_id && x.part === p.no)
      if (ck?.finished_at) continue
      if (r.person_id === me) {
        out.push(row(`ck:${r.id}:${p.no}:me`, 'Your 6-month check-in', ck?.starts_at ? `With ${nameIn(roster, p.reviewerId)}, ${fmtInstantDay(ck.starts_at)} · write your notes before it` : `${nameIn(roster, p.reviewerId)} books the meeting · look at your goals`, c.ck_done_due ? dueOnDay(c.ck_done_due, today) : null, href, 'Open'))
      } else if (p.reviewerId === me) {
        const who = nameIn(roster, r.person_id)
        out.push(ck?.starts_at
          ? row(`ck:${r.id}:${p.no}`, `Check-in with ${who}`, `Booked for ${fmtInstantDay(ck.starts_at)} · tick, adjust, notes, then finish`, c.ck_done_due ? dueOnDay(c.ck_done_due, today) : null, href, 'Open')
          : row(`ck:${r.id}:${p.no}`, `Book the 6-month check-in with ${who}`, 'Book opens the Agenda, filled in', c.ck_book_due ? dueOnDay(c.ck_book_due, today) : null, href, 'Book'))
      }
    }
  }
}
