'use client'

import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { saveTrAssignment, deactivateTrAssignment } from '@/lib/tsheets/settings-actions'

interface CurrentAssignment {
  hourlyRate: number
  effectiveFrom: string
}

interface Props {
  person: { tsheetsUserId: number; name: string }
  client: { id: number; name: string }
  current: CurrentAssignment | null
  onClose: () => void
}

export function AssignmentForm({ person, client, current, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [rate, setRate] = useState(current ? String(current.hourlyRate) : '')
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [mode, setMode] = useState<'edit' | 'deactivate'>('edit')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildLines(): string[] {
    if (mode === 'deactivate') {
      return [
        `Person: ${person.name}`,
        `Client: ${client.name}`,
        `Action: Remove from project (effective ${effectiveFrom})`,
        'Past reports will still show their hours and rate for periods when they were active.',
      ]
    }
    const lines: string[] = [
      `Person: ${person.name}`,
      `Client: ${client.name}`,
    ]
    if (current) {
      lines.push(`Rate: $${current.hourlyRate}/hr -> $${rate}/hr`)
    } else {
      lines.push(`Rate: $${rate}/hr (new assignment)`)
    }
    lines.push(`Effective from: ${effectiveFrom}`)
    return lines
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'edit' && (!rate || Number(rate) <= 0)) {
      setError('Enter a valid hourly rate.')
      return
    }
    if (!effectiveFrom) { setError('Effective date is required.'); return }
    setError(null)
    setConfirmOpen(true)
  }

  async function handleConfirm(justification: string) {
    setLoading(true)
    let result: { ok: boolean; error?: string }

    if (mode === 'deactivate') {
      result = await deactivateTrAssignment({
        tsheetsUserId: person.tsheetsUserId,
        clientId: client.id,
        effectiveFrom,
        justification,
      })
    } else {
      result = await saveTrAssignment({
        tsheetsUserId: person.tsheetsUserId,
        clientId: client.id,
        hourlyRate: Number(rate),
        effectiveFrom,
        justification,
      })
    }

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
            {person.name} &mdash; {client.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
        </div>

        {current && (
          <div className="flex gap-3 text-xs">
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1 rounded-full border ${mode === 'edit' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}
            >
              Change rate
            </button>
            <button
              onClick={() => setMode('deactivate')}
              className={`px-3 py-1 rounded-full border ${mode === 'deactivate' ? 'bg-red-600 text-white border-red-600' : 'border-slate-200 text-slate-600'}`}
            >
              Remove from project
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'edit' && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Hourly rate ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="e.g. 45"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              {mode === 'deactivate' ? 'Remove effective from' : 'Effective from'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="text-xs text-slate-400">Can be retroactive or a future date.</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${mode === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              Review change
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={mode === 'deactivate' ? 'Confirm removal from project' : 'Confirm rate change'}
        lines={buildLines()}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={loading}
      />
    </>
  )
}
