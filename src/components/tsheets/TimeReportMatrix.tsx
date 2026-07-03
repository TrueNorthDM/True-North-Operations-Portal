'use client'

// TimeReportMatrix — client component that renders the hours pivot table, the
// month/client pickers, and (Phase B) the budget-vs-actual + cost layer. No
// data fetching here: hours come from TSheets and budgets/rates from the DB,
// both passed as props by the server page.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TimeReportMatrix } from '@/lib/tsheets/types'

interface Props {
  data: TimeReportMatrix
  selectedMonth: string       // "YYYY-MM"
  availableMonths: string[]   // ["2026-06", ...] — last 24 months
  preview?: boolean
  // budgets[clientId] = { hours allocated, $ available (budget + extra) }
  budgets?: Record<number, { hours: number | null; amount: number | null }>
  // rates[clientId][employeeId] = hourly rate in effect for the period
  rates?: Record<number, Record<number, number>>
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

type Status = 'good' | 'warn' | 'bad' | 'none'
function statusOf(actual: number, budget: number | null | undefined): Status {
  if (budget == null || budget === 0) return 'none'
  const p = actual / budget
  if (p > 1) return 'bad'
  if (p >= 0.75) return 'warn'
  return 'good'
}
const BAR_FILL: Record<Status, string> = {
  good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', none: 'bg-slate-300',
}
const PILL: Record<Status, { cls: string; label: string }> = {
  good: { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'On track' },
  warn: { cls: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Watch' },
  bad: { cls: 'text-red-700 bg-red-50 border-red-200', label: 'Over budget' },
  none: { cls: 'text-slate-500 bg-slate-100 border-slate-200', label: 'No budget' },
}

export function TimeReportMatrixView({ data, selectedMonth, availableMonths, preview, budgets, rates }: Props) {
  const router = useRouter()
  const [client, setClient] = useState<string>('all')   // 'all' or String(client.id)

  function onMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/tools/time-report?month=${e.target.value}`)
  }

  const { employees, jobcodes, clients, hours, rowTotals } = data
  const clientNameMap = new Map(clients.map(c => [c.id, c.name]))
  const B = budgets ?? {}
  const R = rates ?? {}
  const hasRates = Object.values(R).some(m => Object.values(m).some(v => v > 0))
  const hasBudgets = Object.keys(B).length > 0

  function rowCost(jc: { id: number; clientId: number }): number {
    const rateMap = R[jc.clientId] ?? {}
    return employees.reduce((sum, emp) => sum + (hours[jc.id]?.[emp.id] ?? 0) * (rateMap[emp.id] ?? 0), 0)
  }

  // Filter to the picked client — shows all its job codes and everyone who
  // logged hours on them. When one is selected, drop employee columns with no
  // hours so the view stays focused on that client.
  const activeJobcodes = client === 'all' ? jobcodes : jobcodes.filter(jc => String(jc.clientId) === client)
  const activeEmployees = client === 'all'
    ? employees
    : employees.filter(emp => activeJobcodes.some(jc => (hours[jc.id]?.[emp.id] ?? 0) > 0))

  const colTotals: Record<number, number> = {}
  for (const emp of activeEmployees) {
    colTotals[emp.id] = activeJobcodes.reduce((sum, jc) => sum + (hours[jc.id]?.[emp.id] ?? 0), 0)
  }
  const totalHours = activeJobcodes.reduce((sum, jc) => sum + (rowTotals[jc.id] ?? 0), 0)
  const totalCost = activeJobcodes.reduce((sum, jc) => sum + rowCost(jc), 0)

  const selClientId = client === 'all' ? null : Number(client)
  const selBudget = selClientId != null ? B[selClientId] : undefined
  const showCost = hasRates
  const showPanel = selClientId != null && (selBudget != null || hasRates)
  const showOverview = client === 'all' && (hasBudgets || hasRates)
  const cols = 2 + activeEmployees.length + (showCost ? 1 : 0)

  function fmt(n: number): string {
    if (n === 0) return '—'
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  }

  const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="space-y-6">
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

      {/* Month + client selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="month-select" className="text-sm font-medium text-slate-700">Pay period</label>
        <select id="month-select" value={selectedMonth} onChange={onMonthChange} className={selectCls}>
          {availableMonths.map(ym => (
            <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
          ))}
        </select>

        <label htmlFor="client-select" className="text-sm font-medium text-slate-700 ml-2">Client</label>
        <select id="client-select" value={client} onChange={e => setClient(e.target.value)} className={selectCls}>
          <option value="all">All clients</option>
          {clients.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        <span className="text-sm text-slate-400 ml-1">{data.startDate} → {data.endDate}</span>
      </div>

      {/* ── Budget usage panel (a client is selected + there's budget/rate data) ── */}
      {showPanel && selClientId != null && (
        <BudgetPanel
          clientName={clientNameMap.get(selClientId) ?? '—'}
          actualHours={totalHours}
          budgetHours={selBudget?.hours ?? null}
          actualCost={totalCost}
          budgetAmount={selBudget?.amount ?? null}
          showCost={hasRates || (selBudget?.amount != null)}
        />
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {client !== 'all' && <Chip label="Client" value={clientNameMap.get(Number(client)) ?? '—'} />}
        <Chip label="Total hours" value={totalHours.toFixed(2)} />
        {showCost && <Chip label="Total cost" value={money(totalCost)} />}
        <Chip label={client === 'all' ? 'Employees' : 'People with hours'} value={String(activeEmployees.length)} />
        <Chip label="Job codes" value={String(activeJobcodes.length)} />
      </div>

      {/* Pivot table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">Job code</th>
              {activeEmployees.map(emp => (
                <th key={emp.id} className="px-3 py-3 text-center font-semibold text-slate-700 whitespace-nowrap min-w-[72px]">{emp.name}</th>
              ))}
              <th className="px-4 py-3 text-center font-bold text-slate-900 whitespace-nowrap bg-slate-100 border-l border-slate-200">Total</th>
              {showCost && <th className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap bg-slate-100 border-l border-slate-200">Cost</th>}
            </tr>
          </thead>
          <tbody>
            {activeJobcodes.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400">
                  No hours logged for this client in {formatMonthLabel(selectedMonth)}.
                </td>
              </tr>
            )}
            {activeJobcodes.map((jc, i) => (
              <tr key={jc.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <td className="sticky left-0 z-10 px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap bg-inherit border-r border-slate-100">
                  {jc.name}
                  {client === 'all' && (
                    <div className="text-xs font-normal text-slate-400">{clientNameMap.get(jc.clientId) ?? ''}</div>
                  )}
                </td>
                {activeEmployees.map(emp => {
                  const h = hours[jc.id]?.[emp.id] ?? 0
                  return (
                    <td key={emp.id} className={`px-3 py-2.5 text-center tabular-nums ${h > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                      {fmt(h)}
                    </td>
                  )
                })}
                <td className="px-4 py-2.5 text-center font-semibold text-slate-900 tabular-nums bg-slate-50 border-l border-slate-200">
                  {fmt(rowTotals[jc.id] ?? 0)}
                </td>
                {showCost && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 bg-slate-50/60 border-l border-slate-200">
                    {rowCost(jc) > 0 ? money(rowCost(jc)) : <span className="text-slate-300">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {activeJobcodes.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100">
                <td className="sticky left-0 z-10 px-4 py-3 font-bold text-slate-900 bg-slate-100 border-r border-slate-200">Total</td>
                {activeEmployees.map(emp => (
                  <td key={emp.id} className="px-3 py-3 text-center font-bold text-slate-900 tabular-nums">{fmt(colTotals[emp.id] ?? 0)}</td>
                ))}
                <td className="px-4 py-3 text-center font-bold text-tn-primary tabular-nums border-l border-slate-200">{totalHours.toFixed(2)}</td>
                {showCost && <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums border-l border-slate-200">{money(totalCost)}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── All-clients budget overview (only on "All clients", once configured) ── */}
      {showOverview && (
        <ClientsOverview
          clients={clients}
          jobcodes={jobcodes}
          rowTotals={rowTotals}
          rowCost={rowCost}
          budgets={B}
          onPick={setClient}
        />
      )}

      <p className="text-xs text-slate-400">
        Hours pulled live from QuickBooks Time · All approved entries · Cost = hours × each person&apos;s rate
      </p>
    </div>
  )
}

// ── Budget-vs-actual panel for one client ───────────────────────────────────
function BudgetPanel({ clientName, actualHours, budgetHours, actualCost, budgetAmount, showCost }: {
  clientName: string
  actualHours: number
  budgetHours: number | null
  actualCost: number
  budgetAmount: number | null
  showCost: boolean
}) {
  const worst = worstStatus([statusOf(actualHours, budgetHours), showCost ? statusOf(actualCost, budgetAmount) : 'good'])
  const pill = PILL[worst]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budget usage</div>
          <div className="text-base font-bold text-slate-900">{clientName}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${pill.cls}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />{pill.label}
        </span>
      </div>
      <div className={`grid gap-6 ${showCost ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <Meter label="Hours" actual={actualHours} budget={budgetHours} fmtVal={n => n.toFixed(1) + ' h'} fmtBudget={n => n.toFixed(0) + ' h'} />
        {showCost && <Meter label="Cost" actual={actualCost} budget={budgetAmount} fmtVal={money} fmtBudget={money} />}
      </div>
    </div>
  )
}

function Meter({ label, actual, budget, fmtVal, fmtBudget }: {
  label: string
  actual: number
  budget: number | null
  fmtVal: (n: number) => string
  fmtBudget: (n: number) => string
}) {
  const st = statusOf(actual, budget)
  const has = budget != null && budget > 0
  const pct = has ? actual / budget! : 0
  const remaining = has ? budget! - actual : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className="text-sm text-slate-500">
          <b className="text-xl font-extrabold text-slate-900 tabular-nums">{fmtVal(actual)}</b>
          {has ? <> <span className="text-slate-400">of {fmtBudget(budget!)}</span></> : ''}
        </span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${BAR_FILL[st]}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        {has ? (
          <>
            <span className="font-bold text-slate-900 tabular-nums">{Math.round(pct * 100)}% used</span>
            <span className={remaining < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
              {remaining < 0 ? `${fmtVal(-remaining)} over` : `${fmtVal(remaining)} remaining`}
            </span>
          </>
        ) : (
          <span className="text-slate-400">No budget set</span>
        )}
      </div>
    </div>
  )
}

// ── At-a-glance overview across all clients ─────────────────────────────────
function ClientsOverview({ clients, jobcodes, rowTotals, rowCost, budgets, onPick }: {
  clients: { id: number; name: string }[]
  jobcodes: { id: number; clientId: number }[]
  rowTotals: Record<number, number>
  rowCost: (jc: { id: number; clientId: number }) => number
  budgets: Record<number, { hours: number | null; amount: number | null }>
  onPick: (id: string) => void
}) {
  const rows = clients.map(c => {
    const jcs = jobcodes.filter(jc => jc.clientId === c.id)
    const ah = jcs.reduce((s, jc) => s + (rowTotals[jc.id] ?? 0), 0)
    const ac = jcs.reduce((s, jc) => s + rowCost(jc), 0)
    const b = budgets[c.id]
    return { c, ah, ac, bh: b?.hours ?? null, ba: b?.amount ?? null }
  }).sort((a, b) => a.c.name.localeCompare(b.c.name))

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">At a glance — all clients</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3">Client</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3 w-52">Hours used</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3 w-52">Cost used</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, ah, ac, bh, ba }) => {
              const st = worstStatus([statusOf(ah, bh), statusOf(ac, ba)])
              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => onPick(String(c.id))}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3"><UsageCell actual={ah} budget={bh} fmt={n => `${n.toFixed(1)} / ${bh?.toFixed(0) ?? '—'} h`} /></td>
                  <td className="px-4 py-3"><UsageCell actual={ac} budget={ba} fmt={() => `${money(ac)} / ${ba != null ? money(ba) : '—'}`} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${PILL[st].cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{PILL[st].label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">Click a client to drill in. Over-budget bars cap at 100% but the % shows the true figure.</p>
    </div>
  )
}

function UsageCell({ actual, budget, fmt }: { actual: number; budget: number | null; fmt: (n: number) => string }) {
  const st = statusOf(actual, budget)
  const has = budget != null && budget > 0
  const pct = has ? actual / budget! : 0
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="inline-block w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <span className={`block h-full rounded-full ${BAR_FILL[st]}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </span>
      {has ? <span className="font-bold text-slate-900 tabular-nums text-xs">{Math.round(pct * 100)}%</span> : <span className="text-slate-300 text-xs">—</span>}
      <span className="text-xs text-slate-400 tabular-nums">{fmt(actual)}</span>
    </div>
  )
}

function worstStatus(list: Status[]): Status {
  if (list.includes('bad')) return 'bad'
  if (list.includes('warn')) return 'warn'
  if (list.includes('good')) return 'good'
  return 'none'
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
