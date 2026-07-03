'use client'

// TimeReportMatrix — client component that renders the hours pivot table
// and the month picker. No data fetching here: all data comes from the server
// page as props, so the token never touches the browser.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TimeReportMatrix } from '@/lib/tsheets/types'

interface Props {
  data: TimeReportMatrix
  selectedMonth: string  // "YYYY-MM"
  availableMonths: string[]  // ["2026-06", "2026-05", ...] — last 24 months
  preview?: boolean
}

export function TimeReportMatrixView({ data, selectedMonth, availableMonths, preview }: Props) {
  const router = useRouter()
  const [project, setProject] = useState<string>('all')   // 'all' or String(jobcode.id)

  function onMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/tools/time-report?month=${e.target.value}`)
  }

  const { employees, jobcodes, hours, rowTotals } = data

  // Filter to the picked project. When one is selected, also drop employee
  // columns with no hours on it so the view stays focused.
  const activeJobcodes = project === 'all' ? jobcodes : jobcodes.filter(jc => String(jc.id) === project)
  const activeEmployees = project === 'all'
    ? employees
    : employees.filter(emp => activeJobcodes.some(jc => (hours[jc.id]?.[emp.id] ?? 0) > 0))

  const colTotals: Record<number, number> = {}
  for (const emp of activeEmployees) {
    colTotals[emp.id] = activeJobcodes.reduce((sum, jc) => sum + (hours[jc.id]?.[emp.id] ?? 0), 0)
  }
  const totalHours = activeJobcodes.reduce((sum, jc) => sum + (rowTotals[jc.id] ?? 0), 0)

  function fmt(n: number): string {
    if (n === 0) return '—'
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  }

  const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="space-y-6">
      {/* Preview banner */}
      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="text-base">&#x26A0;&#xFE0F;</span>
          <span>
            <strong>Sample data</strong> — structure preview only. Add your TSheets API token in{' '}
            <a href="/settings" className="underline font-medium hover:text-amber-900">Settings</a>{' '}
            to pull real hours.
          </span>
        </div>
      )}

      {/* Month + project selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="month-select" className="text-sm font-medium text-slate-700">Pay period</label>
        <select id="month-select" value={selectedMonth} onChange={onMonthChange} className={selectCls}>
          {availableMonths.map(ym => (
            <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
          ))}
        </select>

        <label htmlFor="project-select" className="text-sm font-medium text-slate-700 ml-2">Project</label>
        <select id="project-select" value={project} onChange={e => setProject(e.target.value)} className={selectCls}>
          <option value="all">All projects</option>
          {jobcodes.map(jc => (
            <option key={jc.id} value={String(jc.id)}>{jc.name}</option>
          ))}
        </select>

        <span className="text-sm text-slate-400 ml-1">
          {data.startDate} → {data.endDate}
        </span>
      </div>

      {/* Summary chips (reflect the current project filter) */}
      <div className="flex flex-wrap gap-3">
        <Chip label="Total hours" value={totalHours.toFixed(2)} />
        <Chip label={project === 'all' ? 'Employees' : 'People with hours'} value={String(activeEmployees.length)} />
        <Chip label="Job codes" value={String(activeJobcodes.length)} />
      </div>

      {/* Pivot table — horizontally scrollable for many employees */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">
                Job code
              </th>
              {activeEmployees.map(emp => (
                <th key={emp.id} className="px-3 py-3 text-center font-semibold text-slate-700 whitespace-nowrap min-w-[72px]">
                  {emp.name}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-bold text-slate-900 whitespace-nowrap bg-slate-100 border-l border-slate-200">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {activeJobcodes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-400">
                  No hours logged on this project in {formatMonthLabel(selectedMonth)}.
                </td>
              </tr>
            )}
            {activeJobcodes.map((jc, i) => (
              <tr
                key={jc.id}
                className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <td className="sticky left-0 z-10 px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap bg-inherit border-r border-slate-100">
                  {jc.name}
                </td>
                {activeEmployees.map(emp => {
                  const h = hours[jc.id]?.[emp.id] ?? 0
                  return (
                    <td
                      key={emp.id}
                      className={`px-3 py-2.5 text-center tabular-nums ${h > 0 ? 'text-slate-800' : 'text-slate-300'}`}
                    >
                      {fmt(h)}
                    </td>
                  )
                })}
                <td className="px-4 py-2.5 text-center font-semibold text-slate-900 tabular-nums bg-slate-50 border-l border-slate-200">
                  {fmt(rowTotals[jc.id] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
          {activeJobcodes.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100">
                <td className="sticky left-0 z-10 px-4 py-3 font-bold text-slate-900 bg-slate-100 border-r border-slate-200">
                  Total
                </td>
                {activeEmployees.map(emp => (
                  <td key={emp.id} className="px-3 py-3 text-center font-bold text-slate-900 tabular-nums">
                    {fmt(colTotals[emp.id] ?? 0)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-bold text-tn-primary tabular-nums border-l border-slate-200">
                  {totalHours.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Hours pulled live from QuickBooks Time · All approved entries · Last updated on load
      </p>
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

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${y}`
}
