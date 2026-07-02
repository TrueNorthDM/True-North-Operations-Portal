'use client'

import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { saveTrBudget } from '@/lib/tsheets/settings-actions'

interface CurrentBudget {
  hoursAllocated: number | null
  budgetAmount: number | null
  extraBudget: number
  startDate: string
  budgetEndDate: string | null
  extraStartDate: string | null
  extraEndDate: string | null
}

interface Props {
  client: { id: number; name: string }
  current: CurrentBudget | null
  onClose: () => void
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return ''
  return String(n)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-01" -> "Jul 1, 2026" (parsed from the string, so no timezone drift). */
function dateLabel(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const idx = m - 1
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${day}, ${y}` : d
}

export function BudgetForm({ client, current, onClose }: Props) {
  const [hours, setHours] = useState(fmtNum(current?.hoursAllocated))
  const [budget, setBudget] = useState(fmtNum(current?.budgetAmount))
  const [budgetStart, setBudgetStart] = useState(current?.startDate ?? '')
  const [budgetEnd, setBudgetEnd] = useState(current?.budgetEndDate ?? '')
  const [extra, setExtra] = useState(fmtNum(current?.extraBudget ?? 0))
  const [extraStart, setExtraStart] = useState(current?.extraStartDate ?? '')
  const [extraEnd, setExtraEnd] = useState(current?.extraEndDate ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extraVal = extra === '' ? 0 : Number(extra)
  const hasExtra = extraVal > 0

  function period(start: string, end: string): string {
    if (!start) return '(not set)'
    return end ? `${dateLabel(start)} – ${dateLabel(end)}` : `${dateLabel(start)} – ongoing`
  }

  function buildLines(): string[] {
    const lines: string[] = [`Client: ${client.name}`]
    const newHours = hours === '' ? null : Number(hours)
    const newBudget = budget === '' ? null : Number(budget)

    if (current?.hoursAllocated !== newHours) {
      lines.push(`Hours allocated: ${current?.hoursAllocated ?? 'none'} → ${newHours ?? 'none'}`)
    }
    if (current?.budgetAmount !== newBudget) {
      lines.push(`Budget: $${current?.budgetAmount ?? 0} → $${newBudget ?? 0}`)
    }
    lines.push(`Budget period: ${period(budgetStart, budgetEnd)}`)

    if (hasExtra) {
      if ((current?.extraBudget ?? 0) !== extraVal) {
        lines.push(`Extra budget: $${current?.extraBudget ?? 0} → $${extraVal}`)
      }
      lines.push(`Extra period: ${period(extraStart, extraEnd)}`)
    } else if ((current?.extraBudget ?? 0) > 0) {
      lines.push(`Extra budget: $${current?.extraBudget} → $0 (removed)`)
    }
    return lines
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!budgetStart) { setError('Budget start date is required.'); return }
    if (budgetEnd && budgetEnd < budgetStart) { setError('Budget end can’t be before its start.'); return }
    if (hasExtra && !extraStart) { setError('Extra budget start date is required when an extra budget is set.'); return }
    if (hasExtra && extraEnd && extraEnd < extraStart) { setError('Extra budget end can’t be before its start.'); return }
    setError(null)
    setConfirmOpen(true)
  }

  async function handleConfirm(justification: string) {
    setLoading(true)
    const result = await saveTrBudget({
      clientId: client.id,
      hoursAllocated: hours === '' ? null : Number(hours),
      budgetAmount: budget === '' ? null : Number(budget),
      budgetStartDate: budgetStart,
      budgetEndDate: budgetEnd || null,
      extraBudget: extraVal,
      extraStartDate: hasExtra && extraStart ? extraStart : null,
      extraEndDate: hasExtra && extraEnd ? extraEnd : null,
      justification,
    })
    setLoading(false)
    if (result.ok) {
      setConfirmOpen(false)
      onClose()
    } else {
      setError(result.error ?? 'Save failed.')
      setConfirmOpen(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
  const labelCls = 'block text-xs font-medium text-slate-600'

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Budget for {client.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Base budget ── */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Hours allocated</label>
                <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 160" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Budget ($)</label>
                <input type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 8000" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Start date <span className="text-red-500">*</span></label>
                <input type="date" value={budgetStart} onChange={e => setBudgetStart(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>End date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="date" value={budgetEnd} min={budgetStart || undefined} onChange={e => setBudgetEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
          </fieldset>

          {/* ── Extra budget ── */}
          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">Extra budget</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Extra budget ($)</label>
                <input type="number" min="0" step="0.01" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div />
              <div className="space-y-1">
                <label className={labelCls}>
                  Start date {hasExtra ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(when extra is set)</span>}
                </label>
                <input type="date" value={extraStart} onChange={e => setExtraStart(e.target.value)} disabled={!hasExtra} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>End date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="date" value={extraEnd} min={extraStart || undefined} onChange={e => setExtraEnd(e.target.value)} disabled={!hasExtra} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
              </div>
            </div>
            {!hasExtra && (
              <p className="text-xs text-slate-400">Enter an extra budget amount to set its own period.</p>
            )}
          </fieldset>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Review change</button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm budget change"
        lines={buildLines()}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={loading}
      />
    </>
  )
}
