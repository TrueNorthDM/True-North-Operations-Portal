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

        <div className="rounded-2xl bg-tn-primary px-7 py-6 text-white">
          <div className="font-(family-name:--font-display) font-extrabold text-[22px]">Good afternoon, Arnaldo</div>
          <div className="text-white/70 text-[13.5px] mt-1">One home for the tools, dashboards and tasks that keep your team moving every day.</div>
        </div>

        <I7BudgetWidget month="2026-09" carryover={CARRYOVER} />

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          <PublishingGoalsWidget boards={PUBLISHING} linked />
          <Birthdays people={PEOPLE} />
          <Anniversaries people={PEOPLE} />
        </section>

        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0 mb-2">
            The same card for somebody without the Publishing grant: same figures, no hover, not a link
          </p>
          <div className="lg:w-1/2">
            <PublishingGoalsWidget boards={PUBLISHING} />
          </div>
        </div>
      </div>
    </div>
  )
}
