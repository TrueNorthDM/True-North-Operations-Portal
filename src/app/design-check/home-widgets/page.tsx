// Design check: the Home widget row, without a login.
// The body lives in HomeBody.tsx, shared with the shell check (design-check/rail).

import { HomeBody } from './HomeBody'

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
        <HomeBody />
      </div>
    </div>
  )
}
