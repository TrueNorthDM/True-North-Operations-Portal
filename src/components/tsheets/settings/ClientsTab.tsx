'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BudgetForm } from './BudgetForm'
import { ProjectBudgets, type ProjectBudget } from './ProjectBudgets'
import { MonthlyBudgetGrid, type MonthlyBudget } from './MonthlyBudgetGrid'
import { ProjectHoursGrid, type ProjectMonthHours } from './ProjectHoursGrid'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'

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
  // Per-month budgeted hours per project (i7 only) — the matrix editor.
  projectMonthHours?: ProjectMonthHours[]
}

export interface ProjectRate { project: string; avgRate: number | null }

interface Props {
  clients: ClientWithBudget[]
  // Auto-calculated average billing rate per i7 project (from the roster). Shown
  // in the i7 budget modal so "budgeted hours × rate = dollars" is visible where
  // hours are allocated. Sourced from the Clients, Projects & Job Codes listing.
  projectRates?: ProjectRate[]
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
const TH = 'text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3.5'

export function ClientsTab({ clients, projectRates }: Props) {
  // Only the selected id is state — the client object is derived from `clients`,
  // so after a save + router.refresh() the modal shows the fresh values.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = clients.find(c => c.id === selectedId) ?? null

  if (clients.length === 0) {
    return (
      <div className="rounded-[16px] border border-slate-200 bg-white p-8 text-center space-y-2">
        <p className="text-sm font-medium text-tn-ink">No clients yet</p>
        <p className="text-xs text-muted">Sync clients from the top of the page to pull job codes from TSheets.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className={`text-left ${TH}`}>Client</th>
              <th className={`text-right ${TH}`}>Hours</th>
              <th className={`text-right ${TH}`}>Budget</th>
              <th className={`text-right ${TH}`}>Extra</th>
              <th className={`text-left ${TH}`}>Budget period</th>
              <th className={`text-right ${TH}`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => {
              const b = client.budget
              return (
                <tr
                  key={client.id}
                  onClick={() => setSelectedId(client.id)}
                  className="border-b border-slate-100 last:border-0 hover:bg-subtle cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <span className="font-(family-name:--font-display) font-bold text-tn-ink">{client.name}</span>
                    {!client.active && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)] px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-foreground">
                    {b?.hoursAllocated != null ? b.hoursAllocated.toLocaleString() : <Dash />}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums font-semibold text-tn-ink">
                    {b?.budgetAmount != null ? `$${b.budgetAmount.toLocaleString()}` : <Dash />}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-foreground">
                    {b && b.extraBudget > 0 ? (
                      <div>
                        <div className="font-semibold text-tn-ink">${b.extraBudget.toLocaleString()}</div>
                        {b.extraStartDate && (
                          <div className="text-[11px] text-muted font-normal">{periodLabel(b.extraStartDate, b.extraEndDate)}</div>
                        )}
                      </div>
                    ) : <Dash />}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {b ? periodLabel(b.startDate, b.budgetEndDate) : <span className="text-muted italic">No budget set</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedId(client.id) }}
                      className="text-[12px] font-(family-name:--font-display) font-extrabold px-3.5 py-2 rounded-[9px] border border-slate-200 text-foreground hover:border-tn-teal hover:text-tn-teal transition-colors whitespace-nowrap"
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

      {selected && <ClientBudgetModal client={selected} projectRates={projectRates} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

// ── Modal: view what's set, or switch to the full edit form ──────────────────
function ClientBudgetModal({ client, projectRates, onClose }: { client: ClientWithBudget; projectRates?: ProjectRate[]; onClose: () => void }) {
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
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(1,20,45,.44)] backdrop-blur-[2px] p-4 py-10 overflow-y-auto" onClick={onClose}>
      <div
        className={`w-full ${isI7 ? 'max-w-5xl' : 'max-w-2xl'} rounded-[18px] bg-white shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] overflow-hidden tn-modal animate-[tn-modal-in_.2s_ease]`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            {isI7 && (
              <span className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] bg-tn-teal text-white">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </span>
            )}
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink truncate">{client.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted hover:bg-subtle hover:text-tn-ink transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {isI7 ? (
            <div className="space-y-6">
              <MonthlyBudgetGrid budgets={client.monthlyBudgets!} />
              <div className="border-t border-slate-100 pt-6 space-y-4">
                {projectRates && projectRates.length > 0 && <ProjectRateStrip rates={projectRates} />}
                <ProjectHoursGrid clientId={client.id} projects={I7_PROJECTS} hours={client.projectMonthHours ?? []} />
              </div>
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

// Average billing rate per project (auto, from the roster) — the multiplier the
// report applies to each project's budgeted hours. Read-only reference so hours
// allocation is legible: hours × this rate = dollars. Edit rates via People &
// rates (assign people to projects); manage the listing in Clients, Projects &
// Job Codes.
function ProjectRateStrip({ rates }: { rates: ProjectRate[] }) {
  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Average rate per project</div>
        <div className="text-[10.5px] text-muted">budgeted hours × rate = budget</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {rates.map(r => (
          <div key={r.project} className="rounded-[10px] border border-slate-200 bg-subtle px-3 py-2.5">
            <div className="text-[11px] font-semibold text-foreground truncate" title={r.project}>{r.project}</div>
            {r.avgRate != null ? (
              <>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-teal tabular-nums">{money(r.avgRate)}</span>
                  <span className="text-[10px] font-semibold text-muted">/h</span>
                </div>
                <div className="text-[9.5px] mt-0.5 font-(family-name:--font-display) font-bold uppercase tracking-wide text-muted">Average</div>
              </>
            ) : (
              <div className="text-[10.5px] mt-1 text-muted italic">Not set</div>
            )}
          </div>
        ))}
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
        <p className="text-sm text-muted">No budget set for this client yet.</p>
        <div className="flex justify-end">
          <button onClick={onEdit} className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white text-sm font-(family-name:--font-display) font-extrabold hover:brightness-110 transition-all">Set budget</button>
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
      <dl className="rounded-[12px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">{r.label}</dt>
            <dd className="text-sm font-bold text-tn-ink tabular-nums text-right">{r.value}</dd>
          </div>
        ))}
      </dl>

      {projectHours.length > 0 && (
        <div>
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted mb-2">Budget hours per project</div>
          <div className="rounded-[12px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {projectHours.map(p => (
              <div key={p.project} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-foreground">{p.project}</span>
                <span className="text-sm font-bold tabular-nums text-tn-ink">{p.hours!.toLocaleString()} h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={onEdit} className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white text-sm font-(family-name:--font-display) font-extrabold hover:brightness-110 transition-all">Edit</button>
      </div>
    </div>
  )
}
