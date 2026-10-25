// Design check: Publishing goals on the new Home (owner, 25 October 2026),
// on the prototype's sample figures (Design/design_handoff_home, "Home Final"):
// AAAF and HFA side by side, Bessemeters with five cycles, then the same card
// with Bessemeters still in its first cycle. /design-check/home-publishing
// No sign-in; the design-check layout closes the folder in production.

import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { AAAF, HFA, BM, BM_FIRST, UPDATED } from './sample'

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      {/* The Home content area at a 1280px window: 1216px beside the rail,
          28px of grid padding. */}
      <div className="max-w-[1216px] mx-auto p-7 space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Home: Publishing goals</h1>
        </div>
        <PublishingGoalsWidget data={{ boards: [AAAF, HFA, BM], updatedAt: UPDATED }} linked />
        <PublishingGoalsWidget data={{ boards: [AAAF, HFA, BM_FIRST], updatedAt: UPDATED }} linked />
        <PublishingGoalsWidget data={null} />
      </div>
    </div>
  )
}
