'use client'

import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { saveTrBudget } from '@/lib/tsheets/settings-actions'

interface CurrentBudget {
  hoursAllocated: number | null
  budgetAmount: number | null
  extraBudget: number
  startDate: string
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

function toFirstOfMonth(ym: string): string {
  return ym ? `${ym}-01` : ''
}

function toYearMonth(date: string): string {
  return date ? date.slice(0, 7) : ''
}

export function BudgetForm({ client, current, onClose }: Props) {
  const [hours, setHours] = useState(fmtNum(current?.hoursAllocated))
  const [budget, setBudget] = useState(fmtNum(current?.budgetAmount))
  const [extra, setExtra] = useState(fmtNum(current?.extraBudget ?? 0))
  const [startMonth, setStartMonth] = useState(current ? toYearMonth(current.startDate) : '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildLines(): string[] {
    const lines: string[] = [`Client: ${client.name}`]
    const newHours = hours === '' ? null : Number(hours)
    const newBudget = budget === '' ? null : Number(budget)
    const newExtra = extra === '' ? 0 : Number(extra)

    if (current?.hoursAllocated !== newHours) {
      lines.push(`Hours allocated: ${current?.hoursAllocated ?? 'none'} -> ${newHours ?? 'none'}`)
    }
    if (current?.budgetAmount !== newBudget) {
      lines.push(`Budget: $${current?.budgetAmount ?? 0} -> $${newBudget ?? 0}`)
    }
    if ((current?.extraBudget ?? 0) !== newExtra) {
      lines.push(`Extra budget: $${current?.extraBudget ?? 0} -> $${newExtra}`)
    }
    lines.push(`Effective from: ${startMonth ? startMonth : '(not set)'}`)
    return lines
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startMonth) { setError('Start month is required.'); return }
    setError(null)
    setConfirmOpen(true)
  }

  async function handleConfirm(justification: string) {
    setLoading(true)
    const result = await saveTrBudget({
      clientId: client.id,
      hoursAllocated: hours === '' ? null : Number(hours),
      budgetAmount: budget === '' ? null : Number(budget),
      extraBudget: extra === '' ? 0 : Number(extra),
      startDate: toFirstOfMonth(startMonth),
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

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Budget for {client.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Hours allocated</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="e.g. 160"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 8000"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Extra budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Effective from <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={e => setStartMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              Review change
            </button>
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
