'use client'

// i7 Budget Usage Report — a 3-level expandable table (Project → Job code →
// Activity). Collapsed to projects by default; the user expands each row. Hours
// and cost roll up at every level. Data is computed server-side and passed in.

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { I7Report, I7Carryover } from '@/lib/tsheets/types'

interface Props {
  data: I7Report
  selectedMonth: string
  availableMonths: string[]
  preview?: boolean
  projectHours?: Record<string, number>   // project → budgeted hours (guide)
  carryover?: I7Carryover | null
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
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

export function I7Report({ data, selectedMonth, availableMonths, preview, projectHours = {}, carryover }: Props) {
  const router = useRouter()
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set())
  const [openActs, setOpenActs] = useState<Set<string>>(new Set())

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key); else next.add(key)
    setter(next)
  }

  function expandAll() {
    setOpenProjects(new Set(data.projects.map(p => p.project)))
    setOpenCodes(new Set(data.projects.flatMap(p => p.jobcodes.map(j => `${p.project}|${j.code}`))))
    setOpenActs(new Set(data.projects.flatMap(p => p.jobcodes.flatMap(j => j.activities.map(a => `${p.project}|${j.code}|${a.activity}`)))))
  }
  function collapseAll() {
    setOpenProjects(new Set())
    setOpenCodes(new Set())
    setOpenActs(new Set())
  }

  const showCost = data.hasRates
  const showBudget = Object.keys(projectHours).length > 0
  const totalBudgetHours = Object.values(projectHours).reduce((s, h) => s + h, 0)
  const cols = 2 + (showBudget ? 2 : 0) + (showCost ? 1 : 0)
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
      </div>

      {/* 3-level table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Project · Job code · Activity</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-28">Hours used</th>
              {showBudget && <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-28">Budget hrs</th>}
              {showBudget && <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-28">Hrs avail.</th>}
              {showCost && <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-32">Budget used</th>}
            </tr>
          </thead>
          <tbody>
            {data.projects.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400">No i7 hours logged in {monthLabel(selectedMonth)}.</td></tr>
            )}
            {data.projects.map(p => {
              const pOpen = openProjects.has(p.project)
              return (
                <ProjectRows
                  key={p.project}
                  project={p}
                  pOpen={pOpen}
                  openCodes={openCodes}
                  openActs={openActs}
                  showCost={showCost}
                  showBudget={showBudget}
                  budgetHours={projectHours[p.project] ?? null}
                  onToggleProject={() => toggle(openProjects, p.project, setOpenProjects)}
                  onToggleCode={(code) => toggle(openCodes, `${p.project}|${code}`, setOpenCodes)}
                  onToggleAct={(code, act) => toggle(openActs, `${p.project}|${code}|${act}`, setOpenActs)}
                />
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100">
              <td className="px-4 py-3 font-bold text-slate-900">Total</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{data.totalHours.toFixed(2)}</td>
              {showBudget && <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{totalBudgetHours ? totalBudgetHours.toLocaleString() : '—'}</td>}
              {showBudget && <td className={`px-4 py-3 text-right font-bold tabular-nums ${totalBudgetHours - data.totalHours < 0 ? 'text-red-600' : 'text-slate-900'}`}>{totalBudgetHours ? (totalBudgetHours - data.totalHours).toFixed(2) : '—'}</td>}
              {showCost && <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{money(data.totalCost)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400">
          Hours pulled live from QuickBooks Time · grouped by the “1 - i7 Code” &amp; “3 Activity” fields · Budget used = hours × each person&apos;s rate
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

function ProjectRows({ project, pOpen, openCodes, openActs, showCost, showBudget, budgetHours, onToggleProject, onToggleCode, onToggleAct }: {
  project: I7Report['projects'][number]
  pOpen: boolean
  openCodes: Set<string>
  openActs: Set<string>
  showCost: boolean
  showBudget: boolean
  budgetHours: number | null
  onToggleProject: () => void
  onToggleCode: (code: string) => void
  onToggleAct: (code: string, act: string) => void
}) {
  const avail = budgetHours != null ? budgetHours - project.hours : null
  // Empty budget cells to keep alignment on job-code / activity / person rows.
  const emptyBudget = showBudget ? <><td /><td /></> : null
  return (
    <>
      {/* Level 1 — Project (budget hrs + hrs available live here) */}
      <tr className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={onToggleProject}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Chevron open={pOpen} />
            <span className="font-semibold text-slate-900">{project.project}</span>
            <span className="text-xs text-slate-400">{project.jobcodes.length} job code{project.jobcodes.length !== 1 ? 's' : ''}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{fmtHours(project.hours)}</td>
        {showBudget && <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{budgetHours != null ? budgetHours.toLocaleString() : <span className="text-slate-300">—</span>}</td>}
        {showBudget && <td className={`px-4 py-3 text-right font-medium tabular-nums ${avail != null && avail < 0 ? 'text-red-600' : 'text-slate-700'}`}>{avail != null ? avail.toFixed(2) : <span className="text-slate-300">—</span>}</td>}
        {showCost && <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{project.cost > 0 ? money(project.cost) : <span className="text-slate-300">—</span>}</td>}
      </tr>

      {/* Level 2 — Job codes */}
      {pOpen && project.jobcodes.map(jc => {
        const key = `${project.project}|${jc.code}`
        const cOpen = openCodes.has(key)
        return (
          <Fragment key={jc.code}>
            <tr className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer bg-slate-50/30" onClick={() => onToggleCode(jc.code)}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 pl-6">
                  <Chevron open={cOpen} />
                  <span className="font-medium text-slate-800 tabular-nums">{jc.code}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-slate-800 tabular-nums">{fmtHours(jc.hours)}</td>
              {emptyBudget}
              {showCost && <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{jc.cost > 0 ? money(jc.cost) : <span className="text-slate-300">—</span>}</td>}
            </tr>

            {/* Level 3 — Activities (expandable to people) */}
            {cOpen && jc.activities.map((a, i) => {
              const aKey = `${project.project}|${jc.code}|${a.activity}`
              const aOpen = openActs.has(aKey)
              const hasPeople = a.people.length > 0
              return (
                <Fragment key={i}>
                  <tr
                    className={`border-b border-slate-50 ${hasPeople ? 'hover:bg-slate-50/60 cursor-pointer' : ''}`}
                    onClick={hasPeople ? () => onToggleAct(jc.code, a.activity) : undefined}
                  >
                    <td className="px-4 py-2 text-slate-600">
                      <div className="flex items-center gap-2 pl-12">
                        {hasPeople ? <Chevron open={aOpen} /> : <span className="w-3.5" />}
                        <span>{a.activity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{fmtHours(a.hours)}</td>
                    {emptyBudget}
                    {showCost && <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{a.cost > 0 ? money(a.cost) : <span className="text-slate-300">—</span>}</td>}
                  </tr>

                  {/* Level 4 — People */}
                  {aOpen && a.people.map((pp, j) => (
                    <tr key={j} className="border-b border-slate-50 bg-slate-50/20">
                      <td className="px-4 py-1.5 text-slate-500 text-[13px]"><span className="pl-24 block">{pp.name}</span></td>
                      <td className="px-4 py-1.5 text-right text-slate-500 tabular-nums text-[13px]">{fmtHours(pp.hours)}</td>
                      {emptyBudget}
                      {showCost && <td className="px-4 py-1.5 text-right text-slate-400 tabular-nums text-[13px]">{pp.cost > 0 ? money(pp.cost) : <span className="text-slate-300">—</span>}</td>}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </>
  )
}

// ── Carryover panel — bank-account running balance ──────────────────────────
function CarryoverPanel({ c, monthLabel }: { c: I7Carryover; monthLabel: string }) {
  const neg = c.totalLeft < 0
  const money0 = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
  const Item = ({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'strong' | 'bad' | 'good' }) => (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : tone === 'muted' ? 'text-slate-500' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Budget balance · {monthLabel}</div>
      <div className="flex items-center gap-3 flex-wrap text-slate-400">
        <Item label="Carried in" value={money0(c.opening)} tone={c.opening < 0 ? 'bad' : 'muted'} />
        <span className="text-xl font-light">+</span>
        <Item label="This month" value={money0(c.monthBudget)} />
        <span className="text-xl font-light">=</span>
        <Item label="Available" value={money0(c.totalAvailable)} tone="strong" />
        <span className="text-xl font-light">−</span>
        <Item label="Used" value={money0(c.monthUsed)} />
        <span className="text-xl font-light">=</span>
        <Item label="Balance left" value={money0(c.totalLeft)} tone={neg ? 'bad' : 'good'} />
      </div>
      {neg && <p className="text-xs text-red-500 mt-3">Over budget — this closing balance carries into next month.</p>}
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
