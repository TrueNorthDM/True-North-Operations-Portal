'use client'

// Read-only view of the OLDER budget schedule + project hours, rendered inside
// the Full history view. Shows past months within the same 24-month retention
// window the reports use. Styled like the i7 modal's tables (teal + orange) but
// read-only.

import { pastMonths } from '@/lib/tsheets/retention'
import { money } from '@/lib/tsheets/format'
import type { MonthlyBudget } from './MonthlyBudgetGrid'
import type { ProjectMonthHours } from './ProjectHoursGrid'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const fmtHrs = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

const thTeal = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal px-3 py-3 whitespace-nowrap'
const thOrange = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-orange-fg)] px-3 py-3 whitespace-nowrap'
const rowLabel = 'text-left text-[12px] font-(family-name:--font-display) font-bold text-tn-ink px-3 py-2.5 sticky left-0 bg-white whitespace-nowrap'

export function PastScheduleTables({ budgets, hours, projects }: {
  budgets: MonthlyBudget[]
  hours: ProjectMonthHours[]
  projects: readonly string[]
}) {
  const months = pastMonths(new Date())
  const bByMonth = new Map(budgets.map(b => [b.month, b]))
  const hByKey = new Map(hours.map(h => [`${h.project}|${h.month}`, h.hours]))

  return (
    <div>
      <div className="mb-3">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink">Past schedule</h3>
        <p className="text-xs text-muted">Read-only · older months within the 24-month window</p>
      </div>

      {months.length === 0 ? (
        <div className="rounded-[12px] border border-slate-200 bg-white p-6 text-center text-sm text-muted">
          No past months yet, the schedule starts this month.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly budget (teal) */}
          <div>
            <div className="border-l-[3px] border-tn-teal pl-3 mb-2.5">
              <h4 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Monthly budget</h4>
            </div>
            <div className="rounded-[12px] border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-tn-teal-soft border-b border-slate-200">
                    <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal px-3 py-3 sticky left-0 bg-tn-teal-soft w-52">Month →</th>
                    {months.map(ym => <th key={ym} className={thTeal}>{monthLabel(ym)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(['budget', 'extra', 'total'] as const).map(rowKind => (
                    <tr key={rowKind} className={`border-b border-slate-100 last:border-0 ${rowKind === 'total' ? 'bg-tn-teal-soft' : ''}`}>
                      <td className={`${rowLabel} ${rowKind === 'total' ? '!bg-tn-teal-soft !text-tn-teal' : ''}`}>
                        {rowKind === 'budget' ? 'Budget ($)' : rowKind === 'extra' ? 'Extra ($)' : 'Total'}
                      </td>
                      {months.map(ym => {
                        const b = bByMonth.get(ym)
                        const v = !b ? null : rowKind === 'budget' ? b.budget : rowKind === 'extra' ? b.extra : b.budget + b.extra
                        const strong = rowKind === 'total'
                        return (
                          <td key={ym} className={`px-3 py-2.5 text-right tabular-nums ${strong ? 'font-bold text-tn-teal' : 'font-semibold text-tn-ink'}`}>
                            {v ? money(v) : <span className="text-slate-300">-</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget hours per project (orange) */}
          <div>
            <div className="border-l-[3px] border-[#e08a1e] pl-3 mb-2.5">
              <h4 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Budget hours per project</h4>
            </div>
            <div className="rounded-[12px] border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-hfa-soft border-b border-slate-200">
                    <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-orange-fg)] px-3 py-3 sticky left-0 bg-hfa-soft w-52">Project</th>
                    {months.map(ym => <th key={ym} className={thOrange}>{monthLabel(ym)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p} className="border-b border-slate-100 last:border-0">
                      <td className={rowLabel}>{p}</td>
                      {months.map(ym => {
                        const h = hByKey.get(`${p}|${ym}`)
                        return (
                          <td key={ym} className="px-3 py-2.5 text-right tabular-nums font-semibold text-tn-ink">
                            {h != null && h > 0 ? fmtHrs(h) : <span className="text-slate-300">-</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
