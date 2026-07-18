// i7 Budget at-a-glance — a Home widget mirroring the "Team Update" share card:
// budget used ($ + %), amount left, and the month's total, with a progress bar.
// "Used" folds in any overage carried from prior months (used = this month's
// cost − carried-in balance), so it matches the report and the shareable image.
// Server component; rendered only for privileged tiers (sensitive $).

import Link from 'next/link'
import type { I7Carryover } from '@/lib/tsheets/types'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym)
const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US')

export function I7BudgetWidget({ month, carryover: c }: { month: string; carryover: I7Carryover }) {
  const full = c.monthBudget
  const used = c.monthUsed - c.opening // adds prior overage when carried-in < 0
  const left = c.totalLeft
  const pct = full > 0 ? Math.round((used / full) * 100) : 0
  const fill = Math.max(0, Math.min(100, pct))
  const over = left < 0
  const overage = c.opening < 0 ? -c.opening : 0
  const surplus = c.opening > 0 ? c.opening : 0
  const note = overage > 0 ? ` · incl. ${money(overage)} carried over` : surplus > 0 ? ` · ${money(surplus)} credit carried in` : ''

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">i7 Budget</h2>
        <Link href="/tools/time-report" className="text-xs font-semibold text-muted hover:text-tn-teal transition-colors">Open report →</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] max-w-[560px]">
        <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-white">i7 Marketing budget</span>
          <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">{monthLabel(month)}</span>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Budget used</div>
              <div className="text-[26px] font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums leading-tight">{money(used)}</div>
              <div className="text-[12px] text-muted mt-0.5">{pct}% of {money(full)}{note}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{over ? 'Over by' : 'Left'}</div>
              <div className={`text-[22px] font-(family-name:--font-display) font-extrabold tabular-nums leading-tight ${over ? 'text-red-600' : 'text-tn-teal'}`}>{money(Math.abs(left))}</div>
            </div>
          </div>

          <div className="mt-4 h-2.5 rounded-full bg-subtle overflow-hidden">
            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-tn-teal'}`} style={{ width: `${over ? 100 : fill}%` }} />
          </div>
        </div>
      </div>
    </section>
  )
}
