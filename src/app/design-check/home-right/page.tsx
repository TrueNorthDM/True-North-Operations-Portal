// Design check: Home's right column (design_handoff_home, sections 4 and 5),
// the Agenda card and the compact i7 Budget at the column's 320px, on the
// prototype's sample (Monday, October 26, 2026, 10:46 AM). /design-check/home-right

import { HomeAgendaCard } from '@/components/home/HomeAgendaCard'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { homeAgenda } from '@/lib/agenda/home'
import { TODAY, ITEMS, NORMAL, OVER } from './sample'

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="m-0 mb-2 text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal">{children}</p>
)

export default function HomeRightDesignCheck() {
  const agenda = homeAgenda(ITEMS, TODAY, 10 + 46 / 60)
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="flex flex-wrap gap-10 items-start">
        <div className="w-[320px] flex flex-col gap-5">
          <Label>Right column, Super Admin</Label>
          <HomeAgendaCard agenda={agenda} />
          <I7BudgetWidget month="2026-10" carryover={NORMAL} />
        </div>
        <div className="w-[320px] flex flex-col gap-5">
          <Label>Photos, nobody out, no events</Label>
          <HomeAgendaCard agenda={homeAgenda(ITEMS, TODAY, 10 + 46 / 60, id => (id === 'hm' ? '/logos/true-north.png' : null))} />
          <HomeAgendaCard agenda={{ out: [], events: [] }} />
        </div>
        <div className="w-[320px] flex flex-col gap-5">
          <Label>States</Label>
          <I7BudgetWidget month="2026-10" carryover={OVER} />
          <I7BudgetWidget month="2026-10" carryover="unavailable" />
          <HomeAgendaCard agenda="unavailable" />
        </div>
      </div>
    </div>
  )
}
