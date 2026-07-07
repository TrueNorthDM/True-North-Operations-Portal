'use client'

// The i7 monthly budget schedule — THE source of truth the report reads
// (i7_monthly_budget). Transposed: rows Budget / Extra / Total, columns = a
// 6-month window (current month + next 5). Opens read-only; "Edit" turns the
// section editable with its own Review → Save.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { editableMonths } from '@/lib/tsheets/retention'
import { saveMonthlyBudgets } from '@/lib/tsheets/settings-actions'

export interface MonthlyBudget { month: string; budget: number; extra: number }  // month = 'YYYY-MM'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const money = (n: number) => '$' + n.toLocaleString('en-US')

// Shared first-column width so this table lines up with the project-hours one.
const COL0 = 'w-52'

export function MonthlyBudgetGrid({ budgets }: { budgets: MonthlyBudget[] }) {
  const router = useRouter()
  const months = editableMonths(new Date())
  const existing = new Map(budgets.map(b => [b.month, b]))

  const initial = () => {
    const o: Record<string, { budget: string; extra: string }> = {}
    for (const ym of months) {
      const b = existing.get(ym)
      o[ym] = { budget: b ? String(b.budget) : '', extra: b && b.extra ? String(b.extra) : '' }
    }
    return o
  }
  const [vals, setVals] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<null | { changes: { month: string; budgetAmount: number; extraAmount: number }[]; lines: string[] }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(ym: string, field: 'budget' | 'extra', v: string) {
    setVals(s => ({ ...s, [ym]: { ...s[ym], [field]: v } }))
  }
  function startEdit() { setVals(initial()); setError(null); setEditing(true) }
  function cancel() { setVals(initial()); setError(null); setEditing(false) }

  function diff() {
    const changes: { month: string; budgetAmount: number; extraAmount: number }[] = []
    const lines: string[] = []
    for (const ym of months) {
      const b = existing.get(ym)
      const nb = vals[ym].budget === '' ? 0 : Number(vals[ym].budget)
      const ne = vals[ym].extra === '' ? 0 : Number(vals[ym].extra)
      const ob = b ? b.budget : 0, oe = b ? b.extra : 0
      if (nb !== ob || ne !== oe) {
        changes.push({ month: ym, budgetAmount: nb, extraAmount: ne })
        const fmt = (base: number, ex: number) => money(base) + (ex ? ` +${money(ex)}` : '')
        lines.push(`${monthLabel(ym)}: ${fmt(ob, oe)} → ${fmt(nb, ne)}`)
      }
    }
    return { changes, lines }
  }

  function review() {
    setError(null)
    const { changes, lines } = diff()
    if (!changes.length) { setError('No changes to save.'); return }
    setPending({ changes, lines })
  }

  async function confirm(justification: string) {
    if (!pending) return
    setLoading(true)
    const res = await saveMonthlyBudgets({ changes: pending.changes, justification })
    setLoading(false)
    if (res.ok) { setPending(null); setEditing(false); router.refresh() }
    else { setError(res.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400'
  const th = 'text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 whitespace-nowrap'
  const rowLabel = 'text-left text-xs font-semibold text-slate-600 px-3 py-2 sticky left-0 whitespace-nowrap'
  const changeCount = diff().changes.length

  const view = (ym: string, field: 'budget' | 'extra') => {
    const b = existing.get(ym)
    const v = b ? (field === 'budget' ? b.budget : b.extra) : 0
    return v ? money(v) : <span className="text-slate-300">—</span>
  }
  const total = (ym: string) => {
    if (editing) {
      const nb = vals[ym].budget === '' ? 0 : Number(vals[ym].budget)
      const ne = vals[ym].extra === '' ? 0 : Number(vals[ym].extra)
      return nb + ne
    }
    const b = existing.get(ym)
    return b ? b.budget + b.extra : 0
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Monthly budget</h3>
          <p className="text-xs text-slate-400">The schedule the report reads — current month and the next 5. Older months live in Change History → Past schedule.</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Edit</button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={`text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 sticky left-0 bg-slate-50 ${COL0}`}>Month →</th>
              {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className={`${rowLabel} bg-white`}>Budget ($)</td>
              {months.map(ym => (
                <td key={ym} className="px-3 py-2 text-right">
                  {editing
                    ? <input type="number" min="0" step="100" value={vals[ym].budget} onChange={e => set(ym, 'budget', e.target.value)} placeholder="0" className={cellInput} />
                    : <span className="tabular-nums text-slate-700">{view(ym, 'budget')}</span>}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-100">
              <td className={`${rowLabel} bg-white`}>Extra ($)</td>
              {months.map(ym => (
                <td key={ym} className="px-3 py-2 text-right">
                  {editing
                    ? <input type="number" min="0" step="100" value={vals[ym].extra} onChange={e => set(ym, 'extra', e.target.value)} placeholder="0" className={cellInput} />
                    : <span className="tabular-nums text-slate-700">{view(ym, 'extra')}</span>}
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50/60">
              <td className={`${rowLabel} bg-slate-50 font-bold`}>Total</td>
              {months.map(ym => {
                const t = total(ym)
                return <td key={ym} className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{t ? money(t) : '—'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {editing && (
        <div className="flex items-center justify-end gap-3">
          {changeCount > 0 && <span className="text-xs text-slate-500">{changeCount} month{changeCount !== 1 ? 's' : ''} changed</span>}
          <button onClick={cancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            onClick={review}
            disabled={changeCount === 0}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review changes
          </button>
        </div>
      )}

      <ConfirmModal
        open={pending !== null}
        title="Confirm budget change"
        lines={pending?.lines ?? []}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
        loading={loading}
      />
    </div>
  )
}
