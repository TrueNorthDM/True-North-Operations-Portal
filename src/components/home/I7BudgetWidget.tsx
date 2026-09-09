// i7 Budget on the Home page: the two figures worth reading and a thin meter.
//
// It used to be the report's full BudgetBalanceCard, with the navy header, the
// carried-in block and an animated bar that counted up on mount. That is the
// right card on the report, where it is the subject of the page. On Home it was
// the tallest thing on the screen, and the animation is the part that made it
// so, so this keeps the header and the numbers and drops the rest.
//
// The whole card is the link, which is why there is no "Open report" any more:
// a card with a two-word link in its corner gives the mouse a target far
// smaller than the obvious one.

import Link from 'next/link'
import { money, moneySigned } from '@/lib/tsheets/format'
import type { I7Carryover } from '@/lib/tsheets/types'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) =>
  /^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym

export function I7BudgetWidget({ month, carryover }: { month: string; carryover: I7Carryover }) {
  const { totalAvailable, monthUsed, totalLeft } = carryover
  const pct = totalAvailable > 0 ? Math.round((monthUsed / totalAvailable) * 100) : 0

  return (
    <Link
      href="/tools/time-report"
      className="block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]"
    >
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-white">i7 Marketing budget</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">{monthLabel(month)}</span>
      </div>

      <div className="px-5 py-4 flex items-center gap-8 flex-wrap">
        <div>
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Balance left</div>
          <div className={`text-[24px] font-(family-name:--font-display) font-extrabold tabular-nums leading-tight ${totalLeft < 0 ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>
            {moneySigned(totalLeft)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
            Used of {money(totalAvailable)}
          </div>
          <div className="text-[24px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink leading-tight">
            {money(monthUsed)}
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="h-2 rounded-full bg-subtle overflow-hidden">
            <div
              className={`h-full rounded-full ${pct > 100 ? 'bg-[#c2410c]' : 'bg-tn-teal'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11.5px] text-muted">{pct}% used</div>
        </div>
      </div>
    </Link>
  )
}
