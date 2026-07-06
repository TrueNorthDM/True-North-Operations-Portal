'use client'

// i7 Budget Usage Report — a 3-level expandable table (Project → Job code →
// Activity). Collapsed to projects by default; the user expands each row. Hours
// and cost roll up at every level. Data is computed server-side and passed in.

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { I7Report } from '@/lib/tsheets/types'

interface Props {
  data: I7Report
  selectedMonth: string
  availableMonths: string[]
  preview?: boolean
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

export function I7Report({ data, selectedMonth, availableMonths, preview }: Props) {
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

  const showCost = data.hasRates
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
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-32">Hours used</th>
              {showCost && <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 w-36">Budget used</th>}
            </tr>
          </thead>
          <tbody>
            {data.projects.length === 0 && (
              <tr><td colSpan={showCost ? 3 : 2} className="px-4 py-6 text-center text-sm text-slate-400">No i7 hours logged in {monthLabel(selectedMonth)}.</td></tr>
            )}
            {data.projects.map(p => {
              const pOpen = openProjects.has(p.project)
              return (
                <ProjectRows
                  key={p.project}
                  project={p}
                  pOpen={pOpen}
                  openCodes={openCodes}
                  showCost={showCost}
                  onToggleProject={() => toggle(openProjects, p.project, setOpenProjects)}
                  onToggleCode={(code) => toggle(openCodes, `${p.project}|${code}`, setOpenCodes)}
                />
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100">
              <td className="px-4 py-3 font-bold text-slate-900">Total</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{data.totalHours.toFixed(2)}</td>
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

function ProjectRows({ project, pOpen, openCodes, showCost, onToggleProject, onToggleCode }: {
  project: I7Report['projects'][number]
  pOpen: boolean
  openCodes: Set<string>
  showCost: boolean
  onToggleProject: () => void
  onToggleCode: (code: string) => void
}) {
  return (
    <>
      {/* Level 1 — Project */}
      <tr className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={onToggleProject}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Chevron open={pOpen} />
            <span className="font-semibold text-slate-900">{project.project}</span>
            <span className="text-xs text-slate-400">{project.jobcodes.length} job code{project.jobcodes.length !== 1 ? 's' : ''}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{fmtHours(project.hours)}</td>
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
              {showCost && <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{jc.cost > 0 ? money(jc.cost) : <span className="text-slate-300">—</span>}</td>}
            </tr>

            {/* Level 3 — Activities */}
            {cOpen && jc.activities.map((a, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="px-4 py-2 text-slate-600">
                  <span className="pl-16 block">{a.activity}</span>
                </td>
                <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{fmtHours(a.hours)}</td>
                {showCost && <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{a.cost > 0 ? money(a.cost) : <span className="text-slate-300">—</span>}</td>}
              </tr>
            ))}
          </Fragment>
        )
      })}
    </>
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
