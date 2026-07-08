'use client'

// i7 Budget Usage Report — an expandable table with 3 row levels (Project → Job
// code → Activity). People are COLUMNS, not rows: each person has an HOURS
// column, filled at every level. Hours/cost/budget roll up at each level. Data
// is computed server-side and passed in.

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { I7Charts } from './I7Charts'
import { ProjectRows } from './I7ProjectRows'
import { ExportMenu, NoteCard } from './I7ReportParts'
import { CarryoverPanel } from './I7CarryoverPanel'
import { money, moneySigned, fmtHours } from '@/lib/tsheets/format'
import type { I7Report, I7Carryover, PersonHours, I7TrendPoint } from '@/lib/tsheets/types'

interface Props {
  data: I7Report
  selectedMonth: string
  availableMonths: string[]
  preview?: boolean
  projectHours?: Record<string, number>   // project → budgeted hours (guide)
  carryover?: I7Carryover | null
  stdRate?: number                        // standard i7 rate for the month ($/h)
  trend?: I7TrendPoint[]                  // Jan → selected month, for the charts
  note?: string                           // per-month narrative (shown + in the PDF)
  canEditNote?: boolean                   // admin can edit the note
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${y}`
}

export function I7Report({ data, selectedMonth, availableMonths, preview, projectHours = {}, carryover, stdRate = 0, trend = [], note = '', canEditNote = false }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'numbers' | 'graphics'>('numbers')
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
            <Link href="/settings" className="underline font-medium hover:text-amber-900">Settings</Link> to pull real hours.</span>
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="month-select" className="text-sm font-medium text-slate-700">Pay period</label>
        <select id="month-select" value={selectedMonth} onChange={e => router.push(`/tools/time-report?month=${e.target.value}`)} className={selectCls}>
          {availableMonths.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </select>
        <span className="text-sm text-slate-400 ml-1">{data.startDate} → {data.endDate}</span>
        {!preview && <div className="ml-auto"><ExportMenu month={selectedMonth} /></div>}
      </div>

      {/* View tabs — the same month's data as a table (In Numbers) or charts (In Graphics) */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['numbers', 'graphics'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${view === v ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {v === 'numbers' ? 'In Numbers' : 'In Graphics'}
          </button>
        ))}
      </div>

      {view === 'graphics' ? (
        <I7Charts data={data} projectHours={projectHours} totalByPerson={totalByPerson} showCost={showCost} trend={trend} />
      ) : (
      <>
      {/* Carryover — bank-account running balance */}
      {carryover && <CarryoverPanel c={carryover} monthLabel={monthLabel(selectedMonth)} />}

      {/* Month narrative (also printed on the client report) */}
      {!preview && <NoteCard month={selectedMonth} note={note} canEdit={canEditNote} />}

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
              {showBudget && <th className={thNum}>Budget hrs</th>}
              {showBudget && <th className={thNum}>Hrs avail.</th>}
              {showBudgetAvail && <th className={thNum}>Budget avail.</th>}
              {showCost && <th className={thNum}>Budget used</th>}
              {people.map(name => <th key={name} className={thNum}>{name}</th>)}
              <th className={thNum}>Hours used</th>
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
              {showBudget && <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{totalBudgetHours ? totalBudgetHours.toLocaleString() : '—'}</td>}
              {showBudget && <td className={`px-3 py-3 text-right font-bold tabular-nums ${totalHrsAvail < 0 ? 'text-red-600' : 'text-slate-900'}`}>{totalBudgetHours ? totalHrsAvail.toFixed(2) : '—'}</td>}
              {showBudgetAvail && <td className={`px-3 py-3 text-right font-bold tabular-nums ${totalHrsAvail < 0 ? 'text-red-600' : 'text-slate-900'}`}>{totalBudgetHours ? moneySigned(totalHrsAvail * stdRate) : '—'}</td>}
              {showCost && <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{money(data.totalCost)}</td>}
              {people.map(name => (
                <td key={name} className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{totalByPerson[name] ? fmtHours(Math.round((totalByPerson[name]) * 100) / 100) : <span className="text-slate-300">—</span>}</td>
              ))}
              <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{data.totalHours.toFixed(2)}</td>
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
      </>
      )}
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
