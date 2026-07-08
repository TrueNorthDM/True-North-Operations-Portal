'use client'

/**
 * CarryoverPanel — the i7 budget-balance widget. Split out of I7Report (audit
 * M5-2). Left block (20%): carried-in balance. Right block (80%): this month's
 * total budget, closing balance, and an animated usage bar (Used of Budget
 * total). "Budget total" = carried-in + this month's budget, so Balance left =
 * Budget total − Used stays consistent with the bar.
 */

import { useState, useEffect } from 'react'
import { money, moneySigned } from '@/lib/tsheets/format'
import type { I7Carryover } from '@/lib/tsheets/types'

type Status = 'good' | 'warn' | 'bad' | 'none'
function statusOf(actual: number, budget: number | null | undefined): Status {
  if (budget == null || budget <= 0) return 'none'
  const p = actual / budget
  if (p > 1) return 'bad'
  if (p >= 0.75) return 'warn'
  return 'good'
}
const PILL: Record<Status, { cls: string; label: string }> = {
  good: { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'On track' },
  warn: { cls: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Watch' },
  bad: { cls: 'text-red-700 bg-red-50 border-red-200', label: 'Over budget' },
  none: { cls: 'text-slate-500 bg-slate-100 border-slate-200', label: 'No budget' },
}

export function CarryoverPanel({ c, monthLabel }: { c: I7Carryover; monthLabel: string }) {
  const neg = c.totalLeft < 0
  const st = statusOf(c.monthUsed, c.totalAvailable)
  const pill = PILL[st]
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left 20% — Carried in */}
      <div className="lg:w-1/5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Carried in</div>
        <div className={`text-2xl font-bold tabular-nums mt-1 ${c.opening < 0 ? 'text-red-600' : 'text-slate-900'}`}>{moneySigned(c.opening)}</div>
        <div className="text-xs text-slate-400 mt-1">Balance brought from last month</div>
      </div>

      {/* Right 80% — Budget balance + usage bar */}
      <div className="lg:w-4/5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budget balance · {monthLabel}</div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${pill.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budget total this month</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">{moneySigned(c.totalAvailable)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Balance left</div>
            <div className={`text-2xl font-bold tabular-nums ${neg ? 'text-red-600' : 'text-emerald-600'}`}>{moneySigned(c.totalLeft)}</div>
          </div>
        </div>
        <Meter label="Budget used" actual={c.monthUsed} budget={c.totalAvailable} />
      </div>
    </div>
  )
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// Usage progress bar. The track holds a fixed green→amber→red gradient (colours
// map to real budget-% positions — yellowing past ~50%, red toward/over 100%);
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
      <div className="mb-2 text-xs font-semibold text-slate-500">{label}</div>
      <div className="relative pt-5">
        {has && (
          <div className="absolute top-0" style={{ left: `${fillPct}%`, transform: markerShift }}>
            <span className="text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(shownActual)}</span>
          </div>
        )}
        <div
          className="relative h-3 rounded-full overflow-hidden"
          style={has
            ? { backgroundImage: 'linear-gradient(90deg, #10b981 0%, #10b981 50%, #f59e0b 75%, #ef4444 100%)' }
            : { backgroundColor: '#f1f5f9' }}
        >
          {/* grey mask over the not-yet-used portion */}
          {has && <div className="absolute inset-y-0 right-0 bg-slate-100" style={{ left: `${fillPct}%` }} />}
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
            <span className="font-bold text-slate-900 tabular-nums">{Math.round(shownPct * 100)}% used</span>
            <span className={shownRemaining < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
              {shownRemaining < 0 ? `${money(-shownRemaining)} over` : `${money(shownRemaining)} remaining`}
            </span>
          </>
        ) : (
          <span className="text-slate-400">No budget set</span>
        )}
      </div>
    </div>
  )
}
