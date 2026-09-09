// i7 Budget on the Home page, a mirror of the i7 report's budget-balance card
// (same navy header, same animated usage bar via BudgetBalanceCard). Rendered
// only for privileged tiers (sensitive $); data loaded in the Home page.
//
// It was shrunk to a single short row and put back: the card is the shape this
// figure is read in everywhere else in the portal, and the short version saved
// height at the cost of being a different thing from the one on the report.
//
// What stayed from that pass is the click. The whole card is the link, so there
// is no "Open report" in the corner: a two-word link is a far smaller target
// than the card it sits in.
//
// The "i7 Budget" heading that used to sit above the card is now the card's own
// title, sized to match Birthdays and the rest of the row. A heading outside a
// card and a title inside it are two names for one thing.

import Link from 'next/link'
import { BudgetBalanceCard } from '@/components/tsheets/I7CarryoverPanel'
import type { I7Carryover } from '@/lib/tsheets/types'

export function I7BudgetWidget({ month, carryover }: { month: string; carryover: I7Carryover }) {
  return (
    <Link
      href="/tools/time-report"
      className="block rounded-2xl transition-shadow hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]"
    >
      <BudgetBalanceCard c={carryover} month={month} title="i7 Budget" large />
    </Link>
  )
}
