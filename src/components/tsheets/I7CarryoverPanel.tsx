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
import { money, moneySigned } from '@/lib/tsheets/format'
import type { I7Carryover } from '@/lib/tsheets/types'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmtMonth = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym)

type Status = 'good' | 'warn' | 'bad' | 'none'
function statusOf(actual: number, budget: number | null | undefined): Status {
  if (budget == null || budget <= 0) return 'none'
  const p = actual / budget
  if (p > 1) return 'bad'
  if (p >= 0.75) return 'warn'
  return 'good'
}
const PILL: Record<Status, { cls: string; label: string }> = {
  good: { cls: 'text-[#1E9E6A] bg-[#eafaf1] border-[#c3ead5]', label: 'On track' },
  warn: { cls: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Watch' },
  bad: { cls: 'text-red-700 bg-red-50 border-red-200', label: 'Over budget' },
  none: { cls: 'text-slate-500 bg-slate-100 border-slate-200', label: 'No budget' },
}

/** The budget-balance card: navy header + this month's total, balance left and
 *  the animated usage bar. Shared by the i7 report and the Home page. */
export function BudgetBalanceCard(
  { c, month, multi = false, title = 'i7 Marketing budget', large = false }: {
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
  },
) {
  const neg = c.totalLeft < 0
  const pill = PILL[statusOf(c.monthUsed, c.totalAvailable)]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      {/* navy header */}
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3.5">
        <span className={`font-(family-name:--font-display) font-extrabold text-white ${large ? 'text-lg' : 'text-[13px]'}`}>{title}</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">{fmtMonth(month)}</span>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Budget balance</div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-(family-name:--font-display) font-bold px-3 py-1 rounded-full border ${pill.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{multi ? 'Budget total, these months' : 'Budget total this month'}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">{moneySigned(c.totalAvailable)}</span>
              {c.opening !== 0 && (
                <span className="text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">({money(c.monthBudget)} {c.opening < 0 ? '−' : '+'} {money(Math.abs(c.opening))})</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Balance left</div>
            <div className={`text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums ${neg ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>{moneySigned(c.totalLeft)}</div>
          </div>
        </div>
        <Meter label="Budget used" actual={c.monthUsed} budget={c.totalAvailable} />
      </div>
    </div>
  )
}

export function CarryoverPanel({ c, month, multi = false }: { c: I7Carryover; month: string; multi?: boolean }) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
      {/* Left 20%, Carried in */}
      <div className="lg:w-1/5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)] flex flex-col justify-center">
        <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Carried in</div>
        <div className={`text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums mt-1 ${c.opening < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>{moneySigned(c.opening)}</div>
        <div className="text-xs text-muted mt-1">{multi ? 'Balance brought into these months' : 'Balance brought from last month'}</div>
      </div>

      {/* Right 80%, Budget balance card (navy header + animated usage bar) */}
      <div className="lg:w-4/5">
        <BudgetBalanceCard c={c} month={month} multi={multi} />
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
function Meter({ label, actual, budget }: { label: string; actual: number; budget: number | null }) {
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
            <span className="text-xs font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums whitespace-nowrap">{money(shownActual)}</span>
          </div>
        )}
        <div
          className="relative h-2.5 rounded-full overflow-hidden"
          style={has
            ? { backgroundImage: 'linear-gradient(90deg, #1E7D7F 0%, #31a39a 50%, #f59e0b 78%, #ef4444 100%)' }
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
            <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">{Math.round(shownPct * 100)}% used</span>
            <span className={shownRemaining < 0 ? 'text-[#c2410c] font-semibold' : 'text-muted'}>
              {shownRemaining < 0 ? `${money(-shownRemaining)} over` : `${money(shownRemaining)} remaining`}
            </span>
          </>
        ) : (
          <span className="text-muted">No budget set</span>
        )}
      </div>
    </div>
  )
}
