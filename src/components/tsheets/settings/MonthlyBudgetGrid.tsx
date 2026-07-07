'use client'

// The i7 monthly budget schedule — THE source of truth the report reads
// (i7_monthly_budget). Transposed: rows are Budget / Extra / Total, columns are
// months. The popup shows a 6-month window (current month + next 5); older
// months live in the read-only "past schedule" modal under Change History.

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

export function MonthlyBudgetGrid({ budgets }: { budgets: MonthlyBudget[] }) {
  const router = useRouter()
  const months = editableMonths(new Date())     // current + next 5, all editable
  const existing = new Map(budgets.map(b => [b.month, b]))

  const [vals, setVals] = useState<Record<string, { budget: string; extra: string }>>(() => {
    const o: Record<string, { budget: string; extra: string }> = {}
    for (const ym of months) {
      const b = existing.get(ym)
      o[ym] = { budget: b ? String(b.budget) : '', extra: b && b.extra ? String(b.extra) : '' }
    }
    return o
  })
  const [pending, setPending] = useState<null | { changes: { month: string; budgetAmount: number; extraAmount: number }[]; lines: string[] }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(ym: string, field: 'budget' | 'extra', v: string) {
    setVals(s => ({ ...s, [ym]: { ...s[ym], [field]: v } }))
  }

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
    if (res.ok) { setPending(null); router.refresh() }
    else { setError(res.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400'
  const th = 'text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 whitespace-nowrap'
  const rowLabel = 'text-left text-xs font-semibold text-slate-600 px-3 py-2 sticky left-0 bg-white whitespace-nowrap'
  const changeCount = diff().changes.length

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Monthly budget the report reads — current month and the next 5. Older months are in <span className="font-medium">Change History → Past schedule</span>.
      </p>
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 sticky left-0 bg-slate-50">Month →</th>
              {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className={rowLabel}>Budget ($)</td>
              {months.map(ym => (
                <td key={ym} className="px-3 py-2">
                  <input type="number" min="0" step="100" value={vals[ym].budget} onChange={e => set(ym, 'budget', e.target.value)} placeholder="0" className={cellInput} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-100">
              <td className={rowLabel}>Extra ($)</td>
              {months.map(ym => (
                <td key={ym} className="px-3 py-2">
                  <input type="number" min="0" step="100" value={vals[ym].extra} onChange={e => set(ym, 'extra', e.target.value)} placeholder="0" className={cellInput} />
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50/60">
              <td className={`${rowLabel} bg-slate-50`}>Total</td>
              {months.map(ym => {
                const nb = vals[ym].budget === '' ? 0 : Number(vals[ym].budget)
                const ne = vals[ym].extra === '' ? 0 : Number(vals[ym].extra)
                const total = nb + ne
                return <td key={ym} className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{total ? money(total) : '—'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {changeCount > 0 && <span className="text-xs text-slate-500">{changeCount} month{changeCount !== 1 ? 's' : ''} changed</span>}
        <button
          onClick={review}
          disabled={changeCount === 0}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review changes
        </button>
      </div>

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
