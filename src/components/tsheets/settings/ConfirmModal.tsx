'use client'

import { TEXTAREA } from '@/lib/ui/fields'
import { useState } from 'react'
import { MODAL_BACKDROP, MODAL_PANEL, MODAL_TITLE } from '@/lib/ui/modal'
import { BTN } from '@/lib/ui/buttons'

interface Props {
  open: boolean
  title: string
  lines: string[]
  onConfirm: (justification: string) => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmModal({ open, title, lines, onConfirm, onCancel, loading }: Props) {
  const [justification, setJustification] = useState('')

  if (!open) return null

  const valid = justification.trim().length >= 10

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${MODAL_BACKDROP} p-4`}>
      <div className={`w-full max-w-md ${MODAL_PANEL} p-6 space-y-5`}>
        <h2 className={MODAL_TITLE}>{title}</h2>

        <ul className="space-y-1 text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-400 select-none">&#8250;</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            className={`w-full ${TEXTAREA}`}
            rows={3}
            placeholder="Why is this change being made?"
            value={justification}
            onChange={e => setJustification(e.target.value)}
          />
          {!valid && justification.length > 0 && (
            <p className="text-xs text-amber-600">Minimum 10 characters required.</p>
          )}
          {justification.length === 0 && (
            <p className="text-xs text-slate-400">A justification is required before saving.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`${BTN.white} disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (valid) onConfirm(justification.trim()) }}
            disabled={!valid || loading}
            className={`${BTN.navy} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? 'Saving...' : 'Confirm change'}
          </button>
        </div>
      </div>
    </div>
  )
}
