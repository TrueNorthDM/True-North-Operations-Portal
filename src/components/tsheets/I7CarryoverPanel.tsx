'use client'

/**
 * CarryoverPanel: the i7 budget-balance widget. Left block (20%): carried-in
 * balance. Right block (80%): BudgetBalanceCard, the period's total budget,
 * closing balance, and an animated usage bar. "Budget total" = carried-in + the
 * period's budget, so Balance left = Budget total − Used stays consistent.
 *
 * The period is one month unless the report says otherwise. Over a range the
 * arithmetic is the same sum, so only the wording changes: `multi` stops the
 * labels from calling a year "this month".
 *
 * BudgetBalanceCard is exported and reused on the Home page (same card, same
 * navy header, same animation) so the two surfaces mirror each other.
 */

import { useState, useEffect } from 'react'
import { budgetFigures, budgetStatus, hoursText, workingDays, type BudgetPace, type BudgetUnit } from '@/lib/tsheets/i7-view'
import { Segmented } from '@/components/ui/Segmented'
import { dayLabel } from '@/lib/timeclock/format'
import { saveI7BudgetView } from '@/app/(app)/settings/actions'
import { BUDGET_GRADIENT, BUDGET_PILL, PACE_PILL } from './budget-style'
import { money, moneySigned } from '@/lib/tsheets/format'
import type { I7Carryover } from '@/lib/tsheets/types'
import { MONTH_LONG } from '@/lib/format/months'
import { CARD } from '@/lib/ui/type'

const fmtMonth = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? `${MONTH_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym)

// The status and its words are the PDF's too (lib/tsheets/i7-view.ts); the
// pill's colours are shared with Home's compact card (budget-style.ts).
const statusOf = budgetStatus
const PILL = BUDGET_PILL

/** The budget-balance card: navy header + this month's total, what is left, the
 *  animated usage bar and the month's progress. Shared by the i7 report and Home.
 *  One month reads in hours or dollars (owner, 11 November 2026): `onUnit` shows
 *  the Hours | Dollars switch (the report only); Home follows the saved choice. */
export function BudgetBalanceCard(
  { c, month, multi = false, title = 'i7 Marketing budget', large = false, unit = 'hours', onUnit }: {
    c: I7Carryover
    /** The header's label. A YYYY-MM is spelled out; anything else is shown as given. */
    month: string
    /** The figures cover more than one month, so the wording stops saying "this month". */
    multi?: boolean
    /**
     * What the navy header calls this. On the report it is the client's budget;
     * on Home it is the widget's own title, since the heading that used to sit
     * above the card is gone.
     */
    title?: string
    /** Home sizes its titles to match the widgets beside it. The report does not. */
    large?: boolean
    unit?: BudgetUnit
    onUnit?: (u: BudgetUnit) => void
  },
) {
  // One month: read against its pace by working days; a range keeps dollars and the plain status.
  const one = !multi && /^\d{4}-\d{2}$/.test(month)
  const f = one ? budgetFigures(c, month, unit) : null
  const hours = f?.unit === 'hours'
  const fmt = (n: number) => (hours ? hoursText(n) : moneySigned(n))
  const total = f ? f.total : c.totalAvailable
  const left = f ? f.left : c.totalLeft
  const used = f ? f.used : c.monthUsed
  const neg = left < 0
  const pill = f ? PACE_PILL[f.pace.status] : PILL[statusOf(c.monthUsed, c.totalAvailable)]
  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* navy header */}
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3.5">
        <span className={`font-(family-name:--font-display) font-extrabold text-white ${large ? 'text-lg' : 'text-[13px]'}`}>{title}</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">{fmtMonth(month)}</span>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {one && onUnit && c.rate && c.rate > 0
            ? <Segmented label="Read the budget in" value={hours ? 'hours' : 'dollars'} onChange={k => onUnit(k)} options={[{ key: 'hours', label: 'Hours' }, { key: 'dollars', label: 'Dollars' }] as const} />
            : <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Budget balance</div>}
          <span className={`gap-1.5 ${pill.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{multi ? 'Budget total, these months' : hours ? 'Hours this month' : 'Budget total this month'}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">{fmt(total)}</span>
              {hours
                ? <span className="text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">({moneySigned(c.totalAvailable)} at {money(c.rate!)}/h)</span>
                : c.opening !== 0 && (
                  <span className="text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">({money(c.monthBudget)} {c.opening < 0 ? '−' : '+'} {money(Math.abs(c.opening))})</span>
                )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{hours ? 'Hours left' : 'Balance left'}</div>
            <div className={`text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums ${neg ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>{fmt(left)}</div>
          </div>
        </div>
        <Meter key={hours ? 'h' : 'd'} label={hours ? 'Actual vs estimated' : 'Budget used'} actual={used} budget={total} fmt={fmt} usedWord={hours ? 'worked' : 'used'} />
        {f && f.pace.days > 0 && <Progress p={f.pace} month={month} />}
        {f && f.pace.status !== 'none' && f.pace.status !== 'bad' && f.pace.share > 0 && f.pace.share < 1 && (
          <p className={`m-0 mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold leading-[1.45] ${f.pace.status === 'onpace' ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#fdf8e7] text-[#8a6d1a]'}`}>
            By today the pace is {fmt(f.pace.expected)}; {fmt(f.used)} {hours ? 'worked' : 'used'}{f.pace.status === 'onpace' ? ', on pace.' : `, ${fmt(Math.abs(f.pace.diff))} ${f.pace.status === 'behind' ? 'behind' : 'ahead'}.`}
          </p>
        )}
      </div>
    </div>
  )
}

/** The month's progress in working days, under the usage bar, to compare the two at a glance (TSheets did). */
function Progress({ p, month }: { p: BudgetPace; month: string }) {
  const days = workingDays(month)
  const span = days.length ? `${dayLabel(days[0])} to ${dayLabel(days[days.length - 1])}` : ''
  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Month progress, working days</div>
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[#eef0f3]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-tn-primary" style={{ width: `${Math.round(p.share * 1000) / 10}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">{p.gone} of {p.days} working days · {Math.round(p.share * 100)}%</span>
        <span className="text-muted">{span}</span>
      </div>
    </div>
  )
}

export function CarryoverPanel({ c, month, multi = false, unit = 'hours' }: { c: I7Carryover; month: string; multi?: boolean; unit?: BudgetUnit }) {
  // Hours or dollars: shown at once, saved for this person; Home's widget follows it (owner, 11 November 2026).
  const [u, setU] = useState<BudgetUnit>(unit)
  const pick = (next: BudgetUnit) => {
    setU(next)
    void saveI7BudgetView(next).catch(() => { /* the choice still shows here; it is saved next time */ })
  }
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
      {/* Left 20%, Carried in */}
      <div className={`${CARD} lg:w-1/5 p-5 flex flex-col justify-center`}>
        <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Carried in</div>
        <div className={`text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums mt-1 ${c.opening < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>{moneySigned(c.opening)}</div>
        <div className="text-xs text-muted mt-1">{multi ? 'Balance brought into these months' : 'Balance brought from last month'}</div>
      </div>

      {/* Right 80%, Budget balance card (navy header + animated usage bar) */}
      <div className="lg:w-4/5">
        <BudgetBalanceCard c={c} month={month} multi={multi} unit={u} onUnit={pick} />
      </div>
    </div>
  )
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// Usage progress bar. The track holds a fixed green→amber→red gradient (colours
// map to real budget-% positions, yellowing past ~50%, red toward/over 100%);
// a grey mask reveals it up to the used %. On mount it fills from 0 → used while
// the $ counts up (ease-out), and a soft shimmer sweeps the filled part. All of
// it is skipped under prefers-reduced-motion.
function Meter({ label, actual, budget, fmt = money, usedWord = 'used' }: { label: string; actual: number; budget: number | null; fmt?: (n: number) => string; usedWord?: string }) {
  const has = budget != null && budget > 0
  const finalPct = has ? actual / budget! : 0
  const finalFill = Math.min(100, Math.max(0, finalPct * 100))

  const [t, setT] = useState(0)       // 0 → 1 entrance progress
  const [motion, setMotion] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Intentional: honour reduced-motion by jumping straight to the final
      // state (no entrance animation) instead of running the rAF loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMotion(false); setT(1); return
    }
    let raf = 0, start = 0
    const dur = 1000
    const tick = (now: number) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / dur)
      setT(easeOutCubic(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [actual, budget])                // re-fill when the month/data changes

  const fillPct = finalFill * t
  const shownActual = actual * t
  const shownRemaining = has ? budget! - shownActual : 0
  const shownPct = has ? shownActual / budget! : 0
  const markerShift = fillPct < 12 ? 'translateX(0)' : fillPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div>
      <div className="mb-2 text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{label}</div>
      <div className="relative pt-5">
        {has && (
          <div className="absolute top-0" style={{ left: `${fillPct}%`, transform: markerShift }}>
            <span className="text-xs font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums whitespace-nowrap">{fmt(shownActual)}</span>
          </div>
        )}
        <div
          className="relative h-2.5 rounded-full overflow-hidden"
          style={has
            ? { backgroundImage: BUDGET_GRADIENT }
            : { backgroundColor: '#eef0f3' }}
        >
          {/* grey mask over the not-yet-used portion */}
          {has && <div className="absolute inset-y-0 right-0 bg-[#eef0f3]" style={{ left: `${fillPct}%` }} />}
          {/* shimmer, clipped to the filled portion */}
          {has && motion && fillPct > 0 && (
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <span className="tr-shimmer" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        {has ? (
          <>
            <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">{fmt(shownActual)} {usedWord} · {Math.round(shownPct * 100)}%</span>
            <span className={shownRemaining < 0 ? 'text-[#c2410c] font-semibold' : 'text-muted'}>
              {shownRemaining < 0 ? `${fmt(-shownRemaining)} over` : `${fmt(shownRemaining)} remaining`}
            </span>
          </>
        ) : (
          <span className="text-muted">No budget set</span>
        )}
      </div>
    </div>
  )
}
