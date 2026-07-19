'use client'

/**
 * MondayBoardField: small per-site input for the Monday board ID.
 *
 * Board IDs are the all-digit number in the Monday board URL:
 *   https://yourorg.monday.com/boards/1234567890  ←  "1234567890"
 *
 * Mounted inside each project card on /settings. Not sensitive, board IDs
 * are not secrets, so no masking/blur treatment, just a normal text field
 * with inline save + saved/error flash.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveMondayBoardId } from '@/app/actions'

interface Props {
  siteCode: 'aaaf' | 'hfa'
  initialBoardId: string | null
  accent: 'aaaf' | 'hfa'
}

const accentBtn = {
  aaaf: 'bg-aaaf-primary hover:bg-aaaf-primary-hover',
  hfa: 'bg-hfa-primary hover:bg-hfa-primary-hover',
}

export function MondayBoardField({ siteCode, initialBoardId, accent }: Props) {
  const router = useRouter()
  const [boardId, setBoardId] = useState(initialBoardId ?? '')
  const [saving, startSave] = useTransition()
  const [flash, setFlash] = useState<'saved' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty = boardId.trim() !== (initialBoardId ?? '')

  function handleSave() {
    setError(null)
    startSave(async () => {
      const res = await saveMondayBoardId({ siteCode, boardId })
      if (!res.ok) {
        setError(res.error ?? 'Could not save board ID.')
        return
      }
      setFlash('saved')
      setTimeout(() => setFlash(null), 2000)
      router.refresh()
    })
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Monday board ID
      </label>
      <div className="flex gap-2 items-start">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={boardId}
          onChange={e => setBoardId(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="e.g. 1234567890"
          className="flex-1 max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`text-sm font-medium px-3 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accentBtn[accent]}`}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {flash === 'saved' && (
          <span className="text-xs text-emerald-700 self-center">Saved ✓</span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        The number in the board URL: <span className="font-mono">monday.com/boards/<strong>1234567890</strong></span>
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
