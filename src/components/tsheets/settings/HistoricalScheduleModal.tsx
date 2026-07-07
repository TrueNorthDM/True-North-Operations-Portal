'use client'

// Read-only view of the OLDER budget schedule + project hours, opened from the
// Change History tab. Shows past months within the same 24-month retention
// window the reports use (retention.ts). Transposed like the editable grids.

import { pastMonths } from '@/lib/tsheets/retention'
import type { MonthlyBudget } from './MonthlyBudgetGrid'
import type { ProjectMonthHours } from './ProjectHoursGrid'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const money = (n: number) => '$' + n.toLocaleString('en-US')
const fmtHrs = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

export function HistoricalScheduleModal({ budgets, hours, projects, onClose }: {
  budgets: MonthlyBudget[]
  hours: ProjectMonthHours[]
  projects: readonly string[]
  onClose: () => void
}) {
  const months = pastMonths(new Date())
  const bByMonth = new Map(budgets.map(b => [b.month, b]))
  const hByKey = new Map(hours.map(h => [`${h.project}|${h.month}`, h.hours]))

  const th = 'text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 whitespace-nowrap'
  const rowLabel = 'text-left text-xs font-semibold text-slate-600 px-3 py-2 sticky left-0 bg-white whitespace-nowrap'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Past schedule</h2>
            <p className="text-xs text-slate-400">Read-only · older months within the 24-month window</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-8">
          {months.length === 0 ? (
            <p className="text-sm text-slate-500">No past months yet — the schedule starts this month.</p>
          ) : (
            <>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Monthly budget</div>
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 sticky left-0 bg-slate-50">Month →</th>
                        {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(['budget', 'extra', 'total'] as const).map(rowKind => (
                        <tr key={rowKind} className={`border-b border-slate-100 last:border-0 ${rowKind === 'total' ? 'bg-slate-50/60' : ''}`}>
                          <td className={`${rowLabel} ${rowKind === 'total' ? 'bg-slate-50 font-bold' : ''}`}>
                            {rowKind === 'budget' ? 'Budget ($)' : rowKind === 'extra' ? 'Extra ($)' : 'Total'}
                          </td>
                          {months.map(ym => {
                            const b = bByMonth.get(ym)
                            const v = !b ? null : rowKind === 'budget' ? b.budget : rowKind === 'extra' ? b.extra : b.budget + b.extra
                            const strong = rowKind === 'total'
                            return (
                              <td key={ym} className={`px-3 py-2 text-right tabular-nums ${strong ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                {v ? money(v) : <span className="text-slate-300">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Budget hours per project</div>
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 sticky left-0 bg-slate-50">Project</th>
                        {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map(p => (
                        <tr key={p} className="border-b border-slate-100 last:border-0">
                          <td className={rowLabel}>{p}</td>
                          {months.map(ym => {
                            const h = hByKey.get(`${p}|${ym}`)
                            return (
                              <td key={ym} className="px-3 py-2 text-right tabular-nums text-slate-600">
                                {h != null && h > 0 ? fmtHrs(h) : <span className="text-slate-300">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
