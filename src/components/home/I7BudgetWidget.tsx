// i7 Budget on the Home page, a mirror of the i7 report's budget-balance card
// (same navy header, same animated usage bar via BudgetBalanceCard). Rendered
// only for privileged tiers (sensitive $); data loaded in the Home page.

import Link from 'next/link'
import { BudgetBalanceCard } from '@/components/tsheets/I7CarryoverPanel'
import type { I7Carryover } from '@/lib/tsheets/types'

export function I7BudgetWidget({ month, carryover }: { month: string; carryover: I7Carryover }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">i7 Budget</h2>
        <Link href="/tools/time-report" className="text-xs font-semibold text-muted hover:text-tn-teal transition-colors">Open report →</Link>
      </div>
      <BudgetBalanceCard c={carryover} month={month} />
    </section>
  )
}
