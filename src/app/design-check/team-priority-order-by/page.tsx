// Design check: where "Order by" sits in the team priority editor, and the
// Edit order button on My Work. A mockup, asked for on 18 September 2026.
// Development only, like every design check; nothing on it is saved.

import { notFound } from 'next/navigation'
import { OrderByMockup } from './OrderByMockup'

export const dynamic = 'force-dynamic'

export default function TeamPriorityOrderByDesignCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Order by, on the right</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            The editor&apos;s top with Workspace, Board and Item under Save and close, styled as the same kind of button. Click them to see each state. Nothing is saved.
          </p>
        </div>
        <OrderByMockup />
      </div>
    </div>
  )
}
