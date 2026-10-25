// i7 Budget on Home (design_handoff_home, section 5), last in the right
// column: the compact form of the i7 report's BudgetBalanceCard. The same navy
// header, the balance left with the report's status pill, and the report's
// usage bar, still and without the count-up. Rendered only for whoever opens
// the i7 report (canTool('i7-budget'); the data is loaded in the Home page).
//
// The whole card is the link, so there is no "Open report" in the corner: a
// two-word link is a far smaller target than the card it sits in.
//
// A read that fails keeps the card and says so in one line, never a figure: it
// used to come back as $0 used and the whole budget left (audit, 9 October 2026).

import Link from 'next/link'
import { BUDGET_GRADIENT, BUDGET_PILL } from '@/components/tsheets/budget-style'
import { MONTH_LONG } from '@/lib/format/months'
import { money, moneySigned } from '@/lib/tsheets/format'
import { budgetStatus } from '@/lib/tsheets/i7-view'
import type { I7Carryover } from '@/lib/tsheets/types'
import { ROUTES } from '@/lib/nav/routes'

const fmtMonth = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? `${MONTH_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym)
const LABEL = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.04em] text-muted'

export function I7BudgetWidget({ month, carryover }: { month: string; carryover: I7Carryover | 'unavailable' }) {
  return (
    <Link
      href={ROUTES.i7}
      aria-label="i7 Budget, open the report"
      className="block bg-white border border-[var(--panel-border)] rounded-[18px] overflow-hidden text-inherit leading-[normal] transition-[border-color,box-shadow] hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]"
    >
      <div className="flex items-center justify-between gap-2.5 bg-tn-primary px-[18px] py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-[#ffffff]">i7 Budget</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-[#ffffff]/70">{fmtMonth(month)}</span>
      </div>
      <div className="px-[18px] pt-4 pb-[18px] flex flex-col gap-3">
        {carryover === 'unavailable'
          ? <p role="status" className="m-0 text-[13.5px] text-muted">The i7 budget could not be read just now. Open the i7 report to try again.</p>
          : <Figures c={carryover} />}
      </div>
    </Link>
  )
}

function Figures({ c }: { c: I7Carryover }) {
  const pill = BUDGET_PILL[budgetStatus(c.monthUsed, c.totalAvailable)]
  const has = c.totalAvailable > 0
  const share = has ? c.monthUsed / c.totalAvailable : 0
  return (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className={LABEL}>Balance left</div>
          <div className={`text-[26px] leading-[1.2] font-(family-name:--font-display) font-extrabold tabular-nums ${c.totalLeft < 0 ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>{moneySigned(c.totalLeft)}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-(family-name:--font-display) font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${pill.cls}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
        </span>
      </div>
      {/* The report's gradient, a grey mask past the share used. */}
      <div className="relative h-2 rounded-full overflow-hidden" style={has ? { backgroundImage: BUDGET_GRADIENT } : { backgroundColor: '#eef0f3' }}>
        {has && <div className="absolute inset-y-0 right-0 bg-[#eef0f3]" style={{ left: `${Math.min(100, Math.max(0, share * 100))}%` }} />}
      </div>
      <div className="flex justify-between gap-2 text-[12px] tabular-nums">
        {has ? (
          <>
            <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{Math.round(share * 100)}% used · {money(c.monthUsed)}</span>
            <span className="text-muted">of {moneySigned(c.totalAvailable)}</span>
          </>
        ) : <span className="text-muted">No budget set</span>}
      </div>
    </>
  )
}
