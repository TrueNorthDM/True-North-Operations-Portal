// Design check: the Home widget row, without a login.
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

const week = (label: string, done: number, target: number) => ({ start: label, label, done, target })

const PUBLISHING: PublishingBoardWeeks[] = [
  {
    boardId: 'aaaf', name: 'AskAnAdventistFriend', perWeek: 11, hits: 2,
    weeks: [week('Aug 10', 9, 11), week('Aug 17', 12, 11), week('Aug 24', 3, 11), week('Aug 31', 14, 11)],
  },
  {
    boardId: 'hfa', name: 'Hope for Africa', perWeek: 8, hits: 1,
    weeks: [week('Aug 10', 6, 8), week('Aug 17', 8, 8), week('Aug 24', 5, 8), week('Aug 31', 3, 8)],
  },
]

const PEOPLE: CelebrationPerson[] = [
  { id: '1', name: 'Cheyenne Wilson', avatarUrl: null, hireDate: '2021-09-14', dob: '1990-09-06', teamName: 'Writing', teamKey: 'writing', color: '#e08a1e' },
  { id: '2', name: 'Kevin Ames', avatarUrl: null, hireDate: '2019-09-02', dob: '1985-09-21', teamName: 'SEO', teamKey: 'seo', color: '#1E7D7F' },
  { id: '3', name: 'Wendy Cacka', avatarUrl: null, hireDate: '2023-09-25', dob: '1988-09-30', teamName: 'Web', teamKey: 'web', color: '#6d5ae0' },
]

/** A founder and two leads. Enough for the chart to draw itself and be measured. */
const person = (id: string, name: string, title: string, color: string, children: OrgPerson[] = []): OrgPerson => ({
  id, name, title, color,
  teams: [], ledTeams: [], secondaryManagerId: null, primaryTeamName: null, ghosts: [], children,
})

const ORG: OrgPerson[] = [
  person('1', 'Arnaldo Oliveira', 'Founder', '#012358', [
    person('2', 'Jeannette Owens', 'SEO lead', '#1E7D7F'),
    person('3', 'Wendy Cacka', 'Web lead', '#6d5ae0'),
  ]),
]

export default function HomeWidgetsDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Home widgets</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            The real components on fixture figures, in the Home page&rsquo;s own layout.
          </p>
        </div>

        <WelcomeBanner name="Arnaldo Oliveira" />

        <I7BudgetWidget month="2026-09" carryover={CARRYOVER} />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <PublishingGoalsWidget boards={PUBLISHING} linked />
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
    </div>
  )
}
