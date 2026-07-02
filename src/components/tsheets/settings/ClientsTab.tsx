'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BudgetForm } from './BudgetForm'

export interface ClientWithBudget {
  id: number
  name: string
  active: boolean
  budget: {
    id: number
    hoursAllocated: number | null
    budgetAmount: number | null
    extraBudget: number
    startDate: string
    budgetEndDate: string | null
    extraStartDate: string | null
    extraEndDate: string | null
  } | null
}

interface Props {
  clients: ClientWithBudget[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-01" -> "Jul 2026" (parsed from the string, so no timezone drift). */
function monthLabel(date: string): string {
  const [y, m] = date.split('-')
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${y}` : date
}

/** A start/optional-end pair as "Jul 2026 – Sep 2026" or "Jul 2026 – ongoing". */
function periodLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—'
  return end ? `${monthLabel(start)} – ${monthLabel(end)}` : `${monthLabel(start)} – ongoing`
}

const Dash = () => <span className="text-slate-300">&mdash;</span>

export function ClientsTab({ clients }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null)

  function handleClose() {
    setEditing(null)
    router.refresh()
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No clients yet</p>
        <p className="text-xs text-slate-500">Click &ldquo;Sync clients&rdquo; above to pull job codes from TSheets.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Client</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Hours</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Budget</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Extra</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Budget period</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => {
              const b = client.budget
              const isEditing = editing === client.id
              return (
                <Fragment key={client.id}>
                  <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-900">{client.name}</span>
                      {!client.active && (
                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                      {b?.hoursAllocated != null ? b.hoursAllocated.toLocaleString() : <Dash />}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                      {b?.budgetAmount != null ? `$${b.budgetAmount.toLocaleString()}` : <Dash />}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                      {b && b.extraBudget > 0 ? (
                        <div>
                          <div>${b.extraBudget.toLocaleString()}</div>
                          {b.extraStartDate && (
                            <div className="text-[11px] text-slate-400 font-normal">{periodLabel(b.extraStartDate, b.extraEndDate)}</div>
                          )}
                        </div>
                      ) : <Dash />}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {b ? periodLabel(b.startDate, b.budgetEndDate) : <span className="text-slate-400">No budget set</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setEditing(isEditing ? null : client.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 ${isEditing ? 'bg-slate-100' : ''}`}
                      >
                        {isEditing ? 'Editing…' : b ? 'Edit budget' : 'Set budget'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/60 px-5 py-4 border-b border-slate-100">
                        <BudgetForm
                          client={{ id: client.id, name: client.name }}
                          current={b ? {
                            hoursAllocated: b.hoursAllocated,
                            budgetAmount: b.budgetAmount,
                            extraBudget: b.extraBudget,
                            startDate: b.startDate,
                            budgetEndDate: b.budgetEndDate,
                            extraStartDate: b.extraStartDate,
                            extraEndDate: b.extraEndDate,
                          } : null}
                          onClose={handleClose}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
