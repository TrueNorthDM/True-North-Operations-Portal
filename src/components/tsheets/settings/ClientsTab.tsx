'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BudgetForm } from './BudgetForm'
import { ProjectBudgets, type ProjectBudget } from './ProjectBudgets'
import { MonthlyBudgetGrid, type MonthlyBudget } from './MonthlyBudgetGrid'

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
  // Per-project budget-hours guide (populated for i7; empty for other clients).
  projectBudgets: ProjectBudget[]
  // The per-month budget schedule the report reads — set for i7 only. When
  // present, the modal shows the month grid (source of truth) instead of the
  // legacy single-budget form.
  monthlyBudgets?: MonthlyBudget[]
}

interface Props {
  clients: ClientWithBudget[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-01" -> "Jul 1, 2026" (parsed from the string, so no timezone drift). */
function dateLabel(date: string): string {
  const [y, m, d] = date.split('-')
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${Number(d)}, ${y}` : date
}

/** A start/optional-end pair as "Jul 1, 2026 – Sep 30, 2026" or "Jul 1, 2026 – ongoing". */
function periodLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—'
  return end ? `${dateLabel(start)} – ${dateLabel(end)}` : `${dateLabel(start)} – ongoing`
}

const Dash = () => <span className="text-slate-300">&mdash;</span>

export function ClientsTab({ clients }: Props) {
  // Only the selected id is state — the client object is derived from `clients`,
  // so after a save + router.refresh() the modal shows the fresh values.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = clients.find(c => c.id === selectedId) ?? null

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
              return (
                <tr
                  key={client.id}
                  onClick={() => setSelectedId(client.id)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                >
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
                      onClick={e => { e.stopPropagation(); setSelectedId(client.id) }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      {b ? 'View / edit' : 'Set budget'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && <ClientBudgetModal client={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

// ── Modal: view what's set, or switch to the full edit form ──────────────────
function ClientBudgetModal({ client, onClose }: { client: ClientWithBudget; onClose: () => void }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const b = client.budget

  // After a save (or cancel) inside the form, return to the view and pull the
  // fresh values so the popup reflects the change without closing.
  function backToView() {
    setMode('view')
    router.refresh()
  }

  // i7 uses the monthly schedule grid (source of truth); other clients keep the
  // legacy single-budget view/edit flow.
  const isI7 = !!client.monthlyBudgets

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${isI7 ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-900">{client.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {isI7 ? (
            <div className="space-y-6">
              <MonthlyBudgetGrid budgets={client.monthlyBudgets!} />
              {client.projectBudgets.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <ProjectBudgets clientId={client.id} projects={client.projectBudgets} onSaved={() => router.refresh()} />
                </div>
              )}
            </div>
          ) : mode === 'view' ? (
            <ViewBudget client={client} onEdit={() => setMode('edit')} />
          ) : (
            <div className="space-y-4">
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
                onClose={backToView}
              />
              {client.projectBudgets.length > 0 && (
                <ProjectBudgets clientId={client.id} projects={client.projectBudgets} onSaved={() => router.refresh()} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Read-only summary — shows ONLY the fields this client actually has set.
function ViewBudget({ client, onEdit }: { client: ClientWithBudget; onEdit: () => void }) {
  const b = client.budget
  const projectHours = client.projectBudgets.filter(p => p.hours != null)

  if (!b) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-500">No budget set for this client yet.</p>
        <div className="flex justify-end">
          <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Set budget</button>
        </div>
      </div>
    )
  }

  const rows: { label: string; value: ReactNode }[] = []
  if (b.hoursAllocated != null) rows.push({ label: 'Hours allocated', value: b.hoursAllocated.toLocaleString() })
  if (b.budgetAmount != null) rows.push({ label: 'Budget', value: `$${b.budgetAmount.toLocaleString()}` })
  rows.push({ label: 'Budget period', value: periodLabel(b.startDate, b.budgetEndDate) })
  if (b.extraBudget > 0) {
    rows.push({ label: 'Extra budget', value: `$${b.extraBudget.toLocaleString()}` })
    if (b.extraStartDate) rows.push({ label: 'Extra period', value: periodLabel(b.extraStartDate, b.extraEndDate) })
  }

  return (
    <div className="space-y-6">
      <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</dt>
            <dd className="text-sm font-semibold text-slate-800 tabular-nums text-right">{r.value}</dd>
          </div>
        ))}
      </dl>

      {projectHours.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Budget hours per project</div>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {projectHours.map(p => (
              <div key={p.project} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-slate-700">{p.project}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800">{p.hours!.toLocaleString()} h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Edit</button>
      </div>
    </div>
  )
}
