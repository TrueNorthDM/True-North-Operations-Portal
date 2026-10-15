// The Home page's body on fixture data, for design checks (home-widgets, and the
// shell in design-check/rail with ?page=home).
//
// The real components on fixture data, not a copy of them, so what is on screen
// here is what is on the Home page. Home itself is behind auth and its data
// comes from Monday's warm store, which a design check cannot reach.

import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { Anniversaries } from '@/components/home/Anniversaries'
import { Birthdays } from '@/components/home/Birthdays'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'
import type { CelebrationPerson } from '@/lib/hr/celebrations'
import type { I7Carryover } from '@/lib/tsheets/types'
import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { OrgChart } from '@/components/OrgChart'
import type { OrgPerson } from '@/lib/org/data'

const CARRYOVER: I7Carryover = {
  opening: 20047.38,
  monthBudget: 55000,
  monthUsed: 7577.92,
  totalAvailable: 75047.38,
  totalLeft: 67469.46,
  openingFrom: '2026-01',
  openingComplete: true,
}

// The real figures from the snapshot, so the check shows what the widget shows:
// AAAF's English is 2 of 11 and was missed in three of these four weeks while
// the total read 82%, 27%, 136% and 82%.
const week = (label: string, done: number, target: number, en: [number, number]) =>
  ({ start: label, label, done, target, en: { done: en[0], target: en[1] }, untargeted: done > target ? 1 : 0 })

const PUBLISHING: PublishingBoardWeeks[] = [
  {
    boardId: 'aaaf', name: 'AskAnAdventistFriend', cycleWeeks: 1, perPeriod: 11, enPerPeriod: 2, hits: 2, enHits: 0, firstCycleEnds: null,
    weeks: [
      week('Aug 10-16', 9, 11, [0, 2]),
      week('Aug 17-23', 3, 11, [0, 2]),
      week('Aug 24-30', 15, 11, [0, 2]),
      week('Aug 31-Sep 6', 9, 11, [1, 2]),
    ],
  },
  {
    boardId: 'hfa', name: 'Hope for Africa', cycleWeeks: 1, perPeriod: 10, enPerPeriod: 5, hits: 2, enHits: 2, firstCycleEnds: null,
    weeks: [
      week('Aug 10-16', 10, 10, [5, 5]),
      week('Aug 17-23', 4, 10, [2, 5]),
      week('Aug 24-30', 16, 10, [8, 5]),
      week('Aug 31-Sep 6', 8, 10, [3, 5]),
    ],
  },
]

const PEOPLE: CelebrationPerson[] = [
  { id: '1', name: 'Avery Stone', avatarUrl: null, hireDate: '2021-09-14', dob: '1990-09-06', teamName: 'Writing', teamKey: 'writing', color: '#e08a1e' },
  { id: '2', name: 'Blake Rivers', avatarUrl: null, hireDate: '2019-09-02', dob: '1985-09-21', teamName: 'SEO', teamKey: 'seo', color: '#1E7D7F' },
  { id: '3', name: 'Casey Moore', avatarUrl: null, hireDate: '2023-09-25', dob: '1988-09-30', teamName: 'Web', teamKey: 'web', color: '#6d5ae0' },
]

/** A founder and two leads. Enough for the chart to draw itself and be measured. */
const person = (id: string, name: string, title: string, color: string, children: OrgPerson[] = []): OrgPerson => ({
  id, name, title, color,
  teams: [], ledTeams: [], secondaryManagerId: null, primaryTeamName: null, ghosts: [], children,
})

const ORG: OrgPerson[] = [
  person('1', 'Jordan Ellis', 'Founder', '#012358', [
    person('2', 'Dana Price', 'SEO lead', '#1E7D7F'),
    person('3', 'Casey Moore', 'Web lead', '#6d5ae0'),
  ]),
]

/** Everything under the top bar on Home, in Home's own order and spacing. */
export function HomeBody() {
  return (
    <div className="space-y-8">
      <WelcomeBanner name="Arnaldo Oliveira" />

      <I7BudgetWidget month="2026-09" carryover={CARRYOVER} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PublishingGoalsWidget data={{ boards: PUBLISHING, updatedAt: '2026-10-09T19:05:00Z' }} linked />
        <div className="space-y-6">
          <Birthdays people={PEOPLE} />
          <Anniversaries people={PEOPLE} />
        </div>
      </section>

      {/* The org chart closes the Home page. It belongs here or this check
          stops being what the page looks like. */}
      <section className="rounded-xl border border-slate-200 bg-white/60 p-4">
        <div className="flex items-baseline gap-2.5 mb-3">
          <h2 className="text-lg font-bold text-tn-ink m-0">Organization</h2>
          <span className="text-[13px] text-muted">32 people</span>
        </div>
        <OrgChart roots={ORG} />
      </section>
    </div>
  )
}
