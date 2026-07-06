'use client'

// i7 Budget Usage Report — an expandable table with 3 row levels (Project → Job
// code → Activity). People are COLUMNS, not rows: each person has an HOURS
// column, filled at every level. Hours/cost/budget roll up at each level. Data
// is computed server-side and passed in.

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { I7Report, I7Carryover, PersonHours } from '@/lib/tsheets/types'

interface Props {
  data: I7Report
  selectedMonth: string
  availableMonths: string[]
  preview?: boolean
  projectHours?: Record<string, number>   // project → budgeted hours (guide)
  carryover?: I7Carryover | null
  stdRate?: number                        // standard i7 rate for the month ($/h)
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}
// Signed dollars (can go negative when a project is over its budgeted hours).
function moneySigned(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
}
function fmtHours(n: number): string {
  if (n === 0) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${y}`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

// One HOURS cell per person column, for a given node's name→hours map.
function PersonCells({ people, byPerson, muted }: { people: string[]; byPerson: PersonHours; muted?: boolean }) {
  return (
    <>
      {people.map(name => {
        const h = byPerson[name] ?? 0
        return (
          <td key={name} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${muted ? 'text-slate-400 text-[13px]' : 'text-slate-600'}`}>
            {h ? fmtHours(h) : <span className="text-slate-300">—</span>}
          </td>
        )
      })}
    </>
  )
}

export function I7Report({ data, selectedMonth, availableMonths, preview, projectHours = {}, carryover, stdRate = 0 }: Props) {
  const router = useRouter()
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set())

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key); else next.add(key)
    setter(next)
  }

  function expandAll() {
    setOpenProjects(new Set(data.projects.map(p => p.project)))
    setOpenCodes(new Set(data.projects.flatMap(p => p.jobcodes.map(j => `${p.project}|${j.code}`))))
  }
  function collapseAll() {
    setOpenProjects(new Set())
    setOpenCodes(new Set())
  }

  const people = data.people
  const showCost = data.hasRates
  const showBudget = Object.keys(projectHours).length > 0
  const showBudgetAvail = showBudget && showCost && stdRate > 0   // $ available needs a rate
  const totalBudgetHours = Object.values(projectHours).reduce((s, h) => s + h, 0)
  const totalHrsAvail = totalBudgetHours - data.totalHours
  const projectOnlyCols = (showBudget ? 2 : 0) + (showBudgetAvail ? 1 : 0)
  const cols = 1 + people.length + 1 + projectOnlyCols + (showCost ? 1 : 0)

  // Per-person totals across the whole report (footer row).
  const totalByPerson: PersonHours = {}
  for (const p of data.projects) for (const [name, h] of Object.entries(p.byPerson)) totalByPerson[name] = (totalByPerson[name] ?? 0) + h

  const thNum = 'text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-3 whitespace-nowrap'
  const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="space-y-6">
      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="text-base">&#x26A0;&#xFE0F;</span>
          <span><strong>Sample data</strong> — structure preview only. Add your TSheets API token in{' '}
            <a href="/settings" className="underline font-medium hover:text-amber-900">Settings</a> to pull real hours.</span>
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="month-select" className="text-sm font-medium text-slate-700">Pay period</label>
        <select id="month-select" value={selectedMonth} onChange={e => router.push(`/tools/time-report?month=${e.target.value}`)} className={selectCls}>
          {availableMonths.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </select>
        <span className="text-sm text-slate-400 ml-1">{data.startDate} → {data.endDate}</span>
      </div>

      {/* Carryover — bank-account running balance */}
      {carryover && <CarryoverPanel c={carryover} monthLabel={monthLabel(selectedMonth)} />}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <Chip label="Total hours" value={data.totalHours.toFixed(2)} />
        {showCost && <Chip label="Total cost" value={money(data.totalCost)} />}
        <Chip label="Projects" value={String(data.projects.length)} />
        <Chip label="People" value={String(people.length)} />
      </div>

      {/* Pivot table — 3 row levels, one HOURS column per person */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 sticky left-0 bg-slate-50 z-10">Project · Job code · Activity</th>
              {people.map(name => <th key={name} className={thNum}>{name}</th>)}
              <th className={thNum}>Hours used</th>
              {showBudget && <th className={thNum}>Budget hrs</th>}
              {showBudget && <th className={thNum}>Hrs avail.</th>}
              {showBudgetAvail && <th className={thNum}>Budget avail.</th>}
              {showCost && <th className={thNum}>Budget used</th>}
            </tr>
          </thead>
          <tbody>
            {data.projects.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400">No i7 hours logged in {monthLabel(selectedMonth)}.</td></tr>
            )}
            {data.projects.map(p => (
              <ProjectRows
                key={p.project}
                project={p}
                people={people}
                pOpen={openProjects.has(p.project)}
                openCodes={openCodes}
                showCost={showCost}
                showBudget={showBudget}
                showBudgetAvail={showBudgetAvail}
                stdRate={stdRate}
                budgetHours={projectHours[p.project] ?? null}
                onToggleProject={() => toggle(openProjects, p.project, setOpenProjects)}
                onToggleCode={(code) => toggle(openCodes, `${p.project}|${code}`, setOpenCodes)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100">
              <td className="px-4 py-3 font-bold text-slate-900 sticky left-0 bg-slate-100 z-10">Total</td>
              {people.map(name => (
                <td key={name} className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{totalByPerson[name] ? fmtHours(Math.round((totalByPerson[name]) * 100) / 100) : <span className="text-slate-300">—</span>}</td>
              ))}
              <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{data.totalHours.toFixed(2)}</td>
              {showBudget && <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{totalBudgetHours ? totalBudgetHours.toLocaleString() : '—'}</td>}
              {showBudget && <td className={`px-3 py-3 text-right font-bold tabular-nums ${totalHrsAvail < 0 ? 'text-red-600' : 'text-slate-900'}`}>{totalBudgetHours ? totalHrsAvail.toFixed(2) : '—'}</td>}
              {showBudgetAvail && <td className={`px-3 py-3 text-right font-bold tabular-nums ${totalHrsAvail < 0 ? 'text-red-600' : 'text-slate-900'}`}>{totalBudgetHours ? moneySigned(totalHrsAvail * stdRate) : '—'}</td>}
              {showCost && <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{money(data.totalCost)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400">
          Hours pulled from QuickBooks Time · grouped by the “1 - i7 Code” &amp; “3 Activity” fields · one hours column per person · Budget used = hours × each person&apos;s rate
          {showBudgetAvail && <> · Budget avail. = hours available × the i7 rate (${stdRate}/h)</>}
        </p>
        <div className="flex gap-2 text-xs">
          <button onClick={expandAll} className="text-slate-500 hover:text-slate-900 underline underline-offset-2">Expand all</button>
          <span className="text-slate-300">·</span>
          <button onClick={collapseAll} className="text-slate-500 hover:text-slate-900 underline underline-offset-2">Collapse all</button>
        </div>
      </div>
    </div>
  )
}

function ProjectRows({ project, people, pOpen, openCodes, showCost, showBudget, showBudgetAvail, stdRate, budgetHours, onToggleProject, onToggleCode }: {
  project: I7Report['projects'][number]
  people: string[]
  pOpen: boolean
  openCodes: Set<string>
  showCost: boolean
  showBudget: boolean
  showBudgetAvail: boolean
  stdRate: number
  budgetHours: number | null
  onToggleProject: () => void
  onToggleCode: (code: string) => void
}) {
  const avail = budgetHours != null ? budgetHours - project.hours : null
  const dollarAvail = avail != null && showBudgetAvail ? avail * stdRate : null
  // Empty cells to keep alignment on job-code / activity rows — one per
  // project-only column (Budget hrs, Hrs avail., and optionally Budget avail.).
  const emptyCount = (showBudget ? 2 : 0) + (showBudgetAvail ? 1 : 0)
  const emptyBudget = emptyCount > 0 ? Array.from({ length: emptyCount }, (_, i) => <td key={i} />) : null

  return (
    <>
      {/* Level 1 — Project (budget columns live here) */}
      <tr className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={onToggleProject}>
        <td className="px-4 py-3 sticky left-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Chevron open={pOpen} />
            <span className="font-semibold text-slate-900 whitespace-nowrap">{project.project}</span>
            <span className="text-xs text-slate-400 whitespace-nowrap">{project.jobcodes.length} job code{project.jobcodes.length !== 1 ? 's' : ''}</span>
          </div>
        </td>
        <PersonCells people={people} byPerson={project.byPerson} />
        <td className="px-3 py-3 text-right font-semibold text-slate-900 tabular-nums">{fmtHours(project.hours)}</td>
        {showBudget && <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{budgetHours != null ? budgetHours.toLocaleString() : <span className="text-slate-300">—</span>}</td>}
        {showBudget && <td className={`px-3 py-3 text-right font-medium tabular-nums ${avail != null && avail < 0 ? 'text-red-600' : 'text-slate-700'}`}>{avail != null ? avail.toFixed(2) : <span className="text-slate-300">—</span>}</td>}
        {showBudgetAvail && <td className={`px-3 py-3 text-right font-medium tabular-nums ${dollarAvail != null && dollarAvail < 0 ? 'text-red-600' : 'text-slate-700'}`}>{dollarAvail != null ? moneySigned(dollarAvail) : <span className="text-slate-300">—</span>}</td>}
        {showCost && <td className="px-3 py-3 text-right font-semibold text-slate-900 tabular-nums">{project.cost > 0 ? money(project.cost) : <span className="text-slate-300">—</span>}</td>}
      </tr>

      {/* Level 2 — Job codes */}
      {pOpen && project.jobcodes.map(jc => {
        const key = `${project.project}|${jc.code}`
        const hasActs = jc.activities.length > 0
        const cOpen = hasActs && openCodes.has(key)
        return (
          <Fragment key={jc.code}>
            <tr className={`border-b border-slate-100 bg-slate-50/30 ${hasActs ? 'hover:bg-slate-50/60 cursor-pointer' : ''}`} onClick={hasActs ? () => onToggleCode(jc.code) : undefined}>
              <td className="px-4 py-2.5 sticky left-0 bg-slate-50 z-10">
                <div className="flex items-center gap-2 pl-6">
                  {hasActs ? <Chevron open={cOpen} /> : <span className="w-3.5" />}
                  <span className="font-medium text-slate-800 tabular-nums whitespace-nowrap">{jc.code}</span>
                </div>
              </td>
              <PersonCells people={people} byPerson={jc.byPerson} />
              <td className="px-3 py-2.5 text-right text-slate-800 tabular-nums">{fmtHours(jc.hours)}</td>
              {emptyBudget}
              {showCost && <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{jc.cost > 0 ? money(jc.cost) : <span className="text-slate-300">—</span>}</td>}
            </tr>

            {/* Level 3 — Activities (leaf rows) */}
            {cOpen && jc.activities.map((a, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="px-4 py-2 text-slate-600 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2 pl-12">
                    <span className="w-3.5" />
                    <span className="whitespace-nowrap">{a.activity}</span>
                  </div>
                </td>
                <PersonCells people={people} byPerson={a.byPerson} muted />
                <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{fmtHours(a.hours)}</td>
                {emptyBudget}
                {showCost && <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{a.cost > 0 ? money(a.cost) : <span className="text-slate-300">—</span>}</td>}
              </tr>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

// ── Budget balance ──────────────────────────────────────────────────────────
// Left block (20%): the carried-in balance. Right block (80%): this month's
// total budget, the closing balance, and a usage progress bar (Used of Budget
// total). "Budget total" = carried-in + this month's budget, so Balance left =
// Budget total − Used stays consistent with the bar.
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

function CarryoverPanel({ c, monthLabel }: { c: I7Carryover; monthLabel: string }) {
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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  )
}
