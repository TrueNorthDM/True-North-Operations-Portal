// Human Resources (annual review handoff, 3 November 2026, C1 and G1 to G5):
// open to everyone. On top, the card of this year's review; then the tabs:
// My reviews (every year, with the PDF), My goals (the goals agreed in the
// last review, to update), My team's goals (for whoever has people reporting
// to them) and Anniversaries (the badge gallery, by its own tick). HR, the VP
// of Operations, the CISO and managers also get the year's list (Reviews).

import type { Metadata } from 'next'
import Link from 'next/link'
import { PAGE_TITLE } from '@/lib/ui/type'
import { BTN } from '@/lib/ui/buttons'
import { Tabs } from '@/components/ui/Tabs'
import { Anniversaries } from '@/components/hr/Anniversaries'
import { MyGoals, ReviewCard, ReviewHistory, TeamGoals } from '@/components/review/HrParts'
import { PriorityGrid } from '@/components/review/parts'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadGoalsView, loadHistory, loadMyCard, loadTeamGoals } from '@/lib/review/mine'
import { currentReviewerOf, loadCurrentCycle, loadPriorities, loadTeamStates, prioritiesFor, reviewToday } from '@/lib/review/data'
import { updateGoal } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Human Resources' }

type Tab = 'reviews' | 'goals' | 'team' | 'anniversaries' | 'priorities'

export default async function HumanResourcesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { access, viewer, roster, settings } = await reviewContext(await requireSurface('human-resources'))
  const me = access.personId
  const today = reviewToday()
  const [card, history, goals, team] = await Promise.all([
    me ? loadMyCard(me, roster, today) : null,
    me ? loadHistory(me, roster) : [],
    me ? loadGoalsView(me, roster, today, currentReviewerOf(roster, settings, me)) : null,
    viewer.reports.size ? loadTeamGoals(viewer, roster, today) : [],
  ])
  const tabs: { key: Tab; label: string }[] = [
    { key: 'reviews', label: 'My reviews' },
    { key: 'goals', label: 'My goals' },
    ...(viewer.reports.size ? [{ key: 'team' as const, label: "My team's goals" }] : []),
    ...(access.can('hr-anniversaries') ? [{ key: 'anniversaries' as const, label: 'Anniversaries' }] : []),
  ]
  const asked = (await searchParams).tab as Tab | undefined
  const tab: Tab = asked === 'priorities' || tabs.some(t => t.key === asked) ? asked! : 'reviews'
  const sub = tab === 'goals' && goals ? `Your goals for ${goals.year}, from your ${goals.reviewYear} review.` : tab === 'team' ? 'The goals of the people who report to you, and their 6-month check-ins.' : tab === 'anniversaries' ? 'Every service milestone and who currently holds it.' : 'Your reviews and your goals.'

  let priorities = null
  if (tab === 'priorities' && me) {
    const c = await loadCurrentCycle()
    if (c) {
      const [all, states] = await Promise.all([loadPriorities(c.id), loadTeamStates(c.id)])
      const mine = roster.members.find(m => m.personId === me && m.isPrimary)?.teamId ?? roster.members.find(m => m.personId === me)?.teamId ?? null
      priorities = { year: c.year, items: prioritiesFor(all, mine, states).map((p, i) => ({ id: p.id, n: i + 1, scope: p.team_id ? roster.teams.get(p.team_id)?.name ?? 'Team' : 'Whole company', teamId: p.team_id, title: p.title, body: p.body, goals: 0 })) }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Human Resources</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{sub}</p>
        </div>
        {(viewer.seesAll || viewer.reports.size > 0) && <Link href="/human-resources/reviews" className={BTN.white}>Reviews</Link>}
      </div>
      {card && <ReviewCard c={card} />}
      <Tabs label="Human Resources" value={tab === 'priorities' ? 'reviews' : tab} items={tabs.map(t => ({ key: t.key, label: t.label, href: `/human-resources?tab=${t.key}` }))} />
      {tab === 'reviews' && <ReviewHistory rows={history} intro="Only you, the person you report to and HR see these." footer="Your reviews stay here for as long as you work at True North. They are also on your page in the Directory, under HR." />}
      {tab === 'goals' && (goals ? <MyGoals v={goals} api={{ updateGoal }} /> : <p className="m-0 text-[14px] text-muted">Your goals show here once a review is approved.</p>)}
      {tab === 'team' && <TeamGoals rows={team} />}
      {tab === 'anniversaries' && <Anniversaries access={access} />}
      {tab === 'priorities' && (priorities
        ? <div className="flex flex-col gap-3"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Priorities for {priorities.year + 1}</h2><PriorityGrid items={priorities.items} showGoals={false} /></div>
        : <p className="m-0 text-[14px] text-muted">No priorities yet.</p>)}
    </div>
  )
}
