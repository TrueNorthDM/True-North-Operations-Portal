// Design check: the Home's Pay period card (design handoff, 25 October 2026)
// in every state, on the prototype's sample figures, at the width the Home
// grid gives it (816px beside the 320px right column at a 1280px window).
// No sign-in. Development only. /design-check/home-pay-period

import { notFound } from 'next/navigation'
import { PayPeriodCard } from '@/components/home/PayPeriodCard'
import { VIEWS } from './samples'

export default function HomePayPeriodCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-[816px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Pay period</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">The real card on sample figures. Today is Monday, Oct 26, 2026, unless a state says otherwise.</p>
        </div>
        {VIEWS.map(v => (
          <div key={v.name} className="space-y-2">
            <p className="m-0 text-[13px] text-muted"><b className="text-tn-ink">{v.name}.</b> {v.note}</p>
            <PayPeriodCard data={{ ok: true, view: v.view }} />
          </div>
        ))}
        <div className="space-y-2">
          <p className="m-0 text-[13px] text-muted"><b className="text-tn-ink">A read that failed.</b> One line, never zeros.</p>
          <PayPeriodCard data={{ ok: false }} />
        </div>
      </div>
    </div>
  )
}
