'use client'

import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { saveTrBudget } from '@/lib/tsheets/settings-actions'
import { MONTH_SHORT } from '@/lib/format/months'

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

/** "2026-07-01" -> "Jul 1, 2026" (parsed from the string, so no timezone drift). */
function dateLabel(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const idx = m - 1
  return idx >= 0 && idx < 12 ? `${MONTH_SHORT[idx]} ${day}, ${y}` : d
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

  const inputCls = 'w-full rounded-[10px] border border-slate-200 bg-subtle px-3.5 py-2.5 text-sm text-tn-ink focus:outline-none focus:border-tn-teal transition-colors'
  const labelCls = 'block text-[13px] font-(family-name:--font-display) font-bold text-tn-ink mb-1.5'
  const legendCls = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted mb-3'

  return (
    <>
      <div className="rounded-[14px] border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Budget for {client.name}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex w-7 h-7 items-center justify-center rounded-[8px] text-muted hover:bg-subtle hover:text-tn-ink transition-colors text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Base budget ── */}
        <fieldset>
          <legend className={legendCls}>Budget</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Hours allocated</label>
              <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 160" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Budget ($)</label>
              <input type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 8000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start date <span className="text-red-500">*</span></label>
              <input type="date" value={budgetStart} onChange={e => setBudgetStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End date <span className="text-muted font-normal">(optional)</span></label>
              <input type="date" value={budgetEnd} min={budgetStart || undefined} onChange={e => setBudgetEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* ── Extra budget ── */}
        <fieldset className="border-t border-slate-200 pt-5">
          <legend className={legendCls}>Extra budget</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Extra budget ($)</label>
              <input type="number" min="0" step="0.01" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div />
            <div>
              <label className={labelCls}>
                Start date {hasExtra ? <span className="text-red-500">*</span> : <span className="text-muted font-normal">(when extra is set)</span>}
              </label>
              <input type="date" value={extraStart} onChange={e => setExtraStart(e.target.value)} disabled={!hasExtra} className={`${inputCls} disabled:opacity-60`} />
            </div>
            <div>
              <label className={labelCls}>End date <span className="text-muted font-normal">(optional)</span></label>
              <input type="date" value={extraEnd} min={extraStart || undefined} onChange={e => setExtraEnd(e.target.value)} disabled={!hasExtra} className={`${inputCls} disabled:opacity-60`} />
            </div>
          </div>
          {!hasExtra && (
            <p className="text-xs text-muted mt-2">Enter an extra budget amount to set its own period.</p>
          )}
        </fieldset>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-(family-name:--font-display) font-extrabold text-foreground border border-slate-200 rounded-[10px] hover:border-tn-ink hover:text-tn-ink transition-colors">Cancel</button>
          <button type="submit" className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white text-sm font-(family-name:--font-display) font-extrabold shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] hover:brightness-110 transition-all">Review change</button>
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
