'use client'

// The i7 monthly budget schedule — THE source of truth the report reads
// (i7_monthly_budget). Past months are read-only; the current month and later
// are editable inline. "Review changes" diffs against what's saved, asks for a
// justification, and writes only the changed months.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { saveMonthlyBudgets } from '@/lib/tsheets/settings-actions'

export interface MonthlyBudget { month: string; budget: number; extra: number }  // month = 'YYYY-MM'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
function nowYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
// Jan 2026 → Dec of next year, so there's always room to plan ahead.
function windowMonths(): string[] {
  const endYear = new Date().getFullYear() + 1
  const out: string[] = []
  let y = 2026, m = 1
  while (y < endYear || (y === endYear && m <= 12)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
const money = (n: number) => '$' + n.toLocaleString('en-US')

export function MonthlyBudgetGrid({ budgets }: { budgets: MonthlyBudget[] }) {
  const router = useRouter()
  const cur = nowYm()
  const months = windowMonths()
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
      if (ym < cur) continue          // past is locked
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
  const changeCount = diff().changes.length

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        This is the schedule the report reads. Past months are locked — only the current month and later can change.
      </p>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5">Month</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5 w-40">Budget ($)</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5 w-40">Extra ($)</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5 w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map(ym => {
              const locked = ym < cur
              const b = existing.get(ym)
              const nb = vals[ym].budget === '' ? 0 : Number(vals[ym].budget)
              const ne = vals[ym].extra === '' ? 0 : Number(vals[ym].extra)
              const total = locked ? ((b ? b.budget : 0) + (b ? b.extra : 0)) : nb + ne
              return (
                <tr key={ym} className={`border-b border-slate-100 last:border-0 ${locked ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={locked ? 'text-slate-400' : 'text-slate-800 font-medium'}>{monthLabel(ym)}</span>
                    {ym === cur && <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">current</span>}
                    {locked && <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">locked</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {locked
                      ? <span className="tabular-nums text-slate-400">{b ? money(b.budget) : '—'}</span>
                      : <input type="number" min="0" step="100" value={vals[ym].budget} onChange={e => set(ym, 'budget', e.target.value)} placeholder="0" className={cellInput} />}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {locked
                      ? <span className="tabular-nums text-slate-400">{b && b.extra ? money(b.extra) : '—'}</span>
                      : <input type="number" min="0" step="100" value={vals[ym].extra} onChange={e => set(ym, 'extra', e.target.value)} placeholder="0" className={cellInput} />}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-800">{total ? money(total) : '—'}</td>
                </tr>
              )
            })}
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
