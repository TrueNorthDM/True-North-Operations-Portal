// Human Resources (annual review handoff, 3 November 2026, C1 and G1 to G5):
// open to everyone. On top, the card of this year's review; then the tabs:
// My reviews (every year, with the PDF), My goals (the goals agreed in the
// last review, to update), My team's goals (for whoever has people reporting
// to them) and Anniversaries (the badge gallery, by its own tick). HR, the VP
// of Operations, the CISO and managers also get the year's list (Reviews).

import type { Metadata } from 'next'
import { PAGE_TITLE } from '@/lib/ui/type'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Tabs } from '@/components/ui/Tabs'
import { Anniversaries } from '@/components/hr/Anniversaries'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { HistoryNote, MyGoals, ReviewCard, ReviewHistory, TeamGoals } from '@/components/review/HrParts'
import { PriorityGrid } from '@/components/review/parts'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadGoalsView, loadHistory, loadMyCard, loadTeamGoals } from '@/lib/review/mine'
import { currentReviewerOf, loadCurrentCycle, loadPriorities, loadTeamStates, prioritiesFor, reviewToday } from '@/lib/review/data'
import { updateGoal } from './actions'
import { hrTabs } from '@/lib/review/hr-tabs'

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
  const first = !history.some(h => h.kind === 'approved') && !team.length
  const tabs = hrTabs({ first, team: viewer.reports.size > 0, all: viewer.seesAll || viewer.reports.size > 0 })
  const asked = (await searchParams).tab as Tab | undefined
  const tab: Tab = asked === 'priorities' || tabs.some(t => t.key !== 'all' && t.key === (asked as string)) ? asked! : 'reviews'
  let priorities = null
  if (tab === 'priorities' && me) {
    const c = await loadCurrentCycle()
    if (c) {
      const [all, states] = await Promise.all([loadPriorities(c.id), loadTeamStates(c.id)])
      const mine = roster.members.find(m => m.personId === me && m.isPrimary)?.teamId ?? roster.members.find(m => m.personId === me)?.teamId ?? null
      priorities = { year: c.year, items: prioritiesFor(all, mine, states).map((p, i) => ({ id: p.id, n: i + 1, scope: p.team_id ? roster.teams.get(p.team_id)?.name ?? 'Team' : 'Whole company', teamId: p.team_id, title: p.title, body: p.body, goals: 0 })) }
    }
  }

  const sub = tab === 'goals' && goals ? `Your goals for ${goals.year}, from your ${goals.reviewYear} review.` : tab === 'team' ? 'The goals of the people who report to you, and their 6-month check-ins.' : tab === 'anniversaries' ? 'Every service milestone and who currently holds it.' : 'Your reviews and your goals.'

  // Until a review of theirs is approved in the portal (the first year), the
  // page is C1: the card, then the anniversary badges, no tabs. From then on,
  // G1: the tabs, with the reviews and the goals they agreed. A manager whose
  // people have goals keeps the tabs for My team's goals.
  if (first) return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Human Resources</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">Your review, and the anniversary badges: every service milestone and who currently holds it.</p>
        </div>
      </div>
      {tabs.length > 1 && <Tabs label="Human Resources" value="reviews" items={tabs} />}
      {card && <ReviewCard c={card} />}
      {tab === 'priorities' && priorities && <div className="flex flex-col gap-3"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Priorities for {priorities.year + 1}</h2><PriorityGrid items={priorities.items} showGoals={false} /></div>}
      <Organization />
      <Anniversaries access={access} intro={false} />
    </div>
  )

  const crumb = tab === 'priorities' ? 'Priorities' : tabs.find(t => t.key === tab)!.label
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <Breadcrumb parents={['/human-resources']} now={crumb} />
          <h1 className={PAGE_TITLE}>Human Resources</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{sub}</p>
        </div>
      </div>
      {card && <ReviewCard c={card} />}
      <Tabs label="Human Resources" value={tab === 'priorities' ? 'reviews' : tab} items={tabs} />
      {tab === 'reviews' && <div className="flex flex-col gap-[18px]"><ReviewHistory rows={history} intro="Only you, the person you report to and HR see these." /><HistoryNote text="Your reviews stay here for as long as you work at True North. They are also on your page in the Directory, under HR." /></div>}
      {tab === 'goals' && (goals ? <MyGoals v={goals} api={{ updateGoal }} /> : <p className="m-0 text-[14px] text-muted">Your goals show here once a review is approved.</p>)}
      {tab === 'team' && <TeamGoals rows={team} />}
      {tab === 'anniversaries' && <div className="flex flex-col gap-5"><Organization /><Anniversaries access={access} intro={false} /></div>}
      {tab === 'priorities' && (priorities
        ? <div className="flex flex-col gap-3"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Priorities for {priorities.year + 1}</h2><PriorityGrid items={priorities.items} showGoals={false} /></div>
        : <p className="m-0 text-[14px] text-muted">No priorities yet.</p>)}
    </div>
  )
}

/** Who reports to whom (the owner, 4 November 2026): the company's org chart, the second block here, before the anniversaries. */
async function Organization() {
  const org = await getOrgChart()
  return (
    <section className="rounded-[14px] border border-[#e4e7ec] bg-white px-[22px] py-5 flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Organization</h2>
        <span className="text-[12.5px] text-[#8593a4]">Who reports to whom{org.total > 0 ? `, ${org.total} people` : ''}.</span>
      </div>
      <OrgChart roots={org.roots} />
    </section>
  )
}
