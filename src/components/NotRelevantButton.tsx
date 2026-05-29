'use client'

/**
 * NotRelevantButton — toggle a page's not_relevant flag.
 *
 * When OFF (default): page is part of the normal workflow. Button label
 *   is "Not relevant" with a muted appearance, inviting opt-out.
 * When ON: page is excluded from the normal flow and counted as done.
 *   Button label is "Marked not relevant" with a soft slate background
 *   so it stops looking like an action and starts looking like a status
 *   chip the user can click to undo.
 *
 * No confirm dialog — the action is fully reversible, so a single click
 * is fine. Errors surface inline.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPageNotRelevant } from '@/app/actions'

interface Props {
  pageId: string
  siteCode: 'aaaf' | 'hfa'
  initialValue: boolean
}

export function NotRelevantButton({ pageId, siteCode, initialValue }: Props) {
  // Optimistic local state so the toggle feels instant even on slow links.
  // We still revalidate via revalidatePath in the action, so the DB is
  // source of truth on next render.
  const [value, setValue] = useState(initialValue)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    const next = !value
    setValue(next)
    setError(null)
    startTransition(async () => {
      const res = await setPageNotRelevant({ pageId, siteCode, value: next })
      if (!res.ok) {
        setValue(!next) // rollback
        setError(res.error ?? 'Could not update.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={value}
        className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          value
            ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
            : 'border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        {value ? 'Marked not relevant' : 'Not relevant'}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  )
}
