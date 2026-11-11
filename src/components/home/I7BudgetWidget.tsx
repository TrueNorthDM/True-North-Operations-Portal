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
import { BUDGET_GRADIENT, PACE_PILL } from '@/components/tsheets/budget-style'
import { MONTH_LONG } from '@/lib/format/months'
import { moneySigned } from '@/lib/tsheets/format'
import { budgetFigures, hoursText, type BudgetUnit } from '@/lib/tsheets/i7-view'
import type { I7Carryover } from '@/lib/tsheets/types'
import { ROUTES } from '@/lib/nav/routes'
import { FIELD_LABEL, CARD } from '@/lib/ui/type'

const fmtMonth = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? `${MONTH_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym)
const LABEL = FIELD_LABEL

export function I7BudgetWidget({ month, carryover, unit = 'hours' }: { month: string; carryover: I7Carryover | 'unavailable'; unit?: BudgetUnit }) {
  return (
    <Link
      href={ROUTES.i7}
      aria-label="i7 Budget, open the report"
      className={`${CARD} block overflow-hidden text-inherit leading-[normal] transition-[border-color,box-shadow] hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]`}
    >
      <div className="flex items-center justify-between gap-2.5 bg-tn-primary px-[18px] py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-[#ffffff]">i7 Budget</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-[#ffffff]/70">{fmtMonth(month)}</span>
      </div>
      <div className="px-[18px] pt-4 pb-[18px] flex flex-col gap-3">
        {carryover === 'unavailable'
          ? <p role="status" className="m-0 text-[13.5px] text-muted">The i7 budget could not be read just now. Open the i7 report to try again.</p>
          : <Figures c={carryover} month={month} unit={unit} />}
      </div>
    </Link>
  )
}

function Figures({ c, month, unit }: { c: I7Carryover; month: string; unit: BudgetUnit }) {
  // In hours or dollars as this person chose on the i7 report, against the month's pace (owner, 11 November 2026).
  const f = budgetFigures(c, month, unit)
  const hours = f.unit === 'hours'
  const fmt = (n: number) => (hours ? hoursText(n) : moneySigned(n))
  const pill = PACE_PILL[f.pace.status]
  const has = f.total > 0
  const share = has ? f.used / f.total : 0
  return (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className={LABEL}>{hours ? 'Hours left' : 'Balance left'}</div>
          <div className={`text-[26px] leading-[1.2] font-(family-name:--font-display) font-extrabold tabular-nums ${f.left < 0 ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>{fmt(f.left)}</div>
        </div>
        <span className={`gap-1.5 ${pill.cls}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={LABEL}>{hours ? 'Worked vs estimated' : 'Budget used'}</div>
        {/* The report's gradient, a grey mask past the share used. */}
        <div className="relative h-2 rounded-full overflow-hidden" style={has ? { backgroundImage: BUDGET_GRADIENT } : { backgroundColor: '#eef0f3' }}>
          {has && <div className="absolute inset-y-0 right-0 bg-[#eef0f3]" style={{ left: `${Math.min(100, Math.max(0, share * 100))}%` }} />}
        </div>
        <div className="flex justify-between gap-2 text-[12px] tabular-nums">
          {has
            ? <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{fmt(f.used)} of {fmt(f.total)} · {Math.round(share * 100)}%</span>
            : <span className="text-muted">No budget set</span>}
        </div>
      </div>
      {has && f.pace.days > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className={LABEL}>Month progress</div>
          <div className="relative h-2 rounded-full overflow-hidden bg-[#eef0f3]">
            <div className="absolute inset-y-0 left-0 rounded-full bg-tn-primary" style={{ width: `${Math.round(f.pace.share * 1000) / 10}%` }} />
          </div>
          <span className="text-[12px] font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">{f.pace.gone} of {f.pace.days} working days · {Math.round(f.pace.share * 100)}%</span>
        </div>
      )}
    </>
  )
}
