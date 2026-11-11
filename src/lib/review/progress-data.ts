/**
 * Reads what the progress block needs (progress.ts) for one year. Every read
 * goes through the privileged client; the caller decides who may see it
 * (the VP of Operations, the CISO, HR and Super Admins).
 */

import { computeCheckinProgress, computeProgress, type Progress } from './progress'
import { loadAllCheckins, loadParts, loadPriorities, loadReviews, nameIn, reviewToday, rosterParticipants, type Cycle, type HrSettings, type Roster } from './data'
import { partsOf } from './parts'
import { fmtDay } from './format'

export async function loadProgress(cycle: Cycle, roster: Roster, settings: HrSettings, now = new Date()): Promise<Progress> {
  const [reviews, priorities] = await Promise.all([loadReviews(cycle.id), loadPriorities(cycle.id)])
  const extra = await loadParts(reviews.map(r => r.id))
  const people = rosterParticipants(roster, settings)
  const byPerson = new Map(reviews.map(r => [r.person_id, r]))
  const written = new Map<string, number>()
  for (const p of priorities) if (p.team_id && p.title.trim()) written.set(p.team_id, (written.get(p.team_id) ?? 0) + 1)
  return computeProgress({
    today: reviewToday(now),
    now,
    cycle,
    reviews: reviews.map(r => ({
      id: r.id, personId: r.person_id, name: nameIn(roster, r.person_id), step: r.step, selfSentAt: r.self_sent_at,
      parts: partsOf(r, extra, r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : '').map(p => ({ ...p, reviewerName: nameIn(roster, p.reviewerId) })),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    leaders: people.filter(p => p.leads.length && byPerson.has(p.personId)).map(p => ({
      personId: p.personId, name: nameIn(roster, p.personId), reviewId: byPerson.get(p.personId)?.id ?? null,
      teams: p.leads.map(t => ({ id: t, name: roster.teams.get(t)?.name ?? 'Team', written: written.get(t) ?? 0 })),
    })),
    priorities: {
      company: priorities.filter(p => !p.team_id && (p.kind ?? 'company') === 'company' && p.title.trim()).length,
      vp: priorities.filter(p => !p.team_id && p.kind === 'vp' && p.title.trim()).length,
    },
    fmt: d => fmtDay(d).replace(/^\w+, /, ''),
  })
}

/** The 6-month check-in's four steps, for the progress block. */
export async function loadCheckinProgress(cycle: Cycle, roster: Roster, now = new Date()): Promise<Progress> {
  const [reviews, priorities, checkins] = await Promise.all([loadReviews(cycle.id), loadPriorities(cycle.id), loadAllCheckins(cycle.id)])
  const approved = reviews.filter(r => r.step === 'approved')
  const extra = await loadParts(approved.map(r => r.id))
  const company = priorities.filter(p => !p.team_id)
  return computeCheckinProgress({
    today: reviewToday(now), cycle,
    priorities: { total: company.length, checked: company.filter(p => p.mid_status).length },
    items: approved.flatMap(r => partsOf(r, extra, r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : '').map(p => {
      const ck = checkins.find(x => x.person_id === r.person_id && x.part === p.no)
      return { reviewId: r.id, personId: r.person_id, name: nameIn(roster, r.person_id), reviewer: nameIn(roster, p.reviewerId), area: p.area, part: p.no, booked: ck?.starts_at ?? null, finished: ck?.finished_at ?? null }
    })),
    fmt: d => fmtDay(d).replace(/^\w+, /, ''),
  })
}
