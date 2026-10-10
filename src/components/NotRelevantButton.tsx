'use client'

/**
 * NotRelevantButton: sets a page aside (Not relevant) or brings it back.
 *
 * A toggle button: the words stay "Not relevant" and the state is
 * aria-pressed, shown as a ticked box, so a screen reader says it once. A set
 * aside page counts as done.
 *
 * No confirmation: it is undone with the same click. The server finds the
 * page's site itself (audit, 10 October 2026), so only the page is sent.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPageNotRelevant } from '@/app/(app)/seo/href-links/actions'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

interface Props {
  pageId: string
  initialValue: boolean
}

export function NotRelevantButton({ pageId, initialValue }: Props) {
  // Shown at once; the server's answer puts it back if it was refused.
  const [value, setValue] = useState(initialValue)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    const next = !value
    setValue(next)
    setError(null)
    startTransition(async () => {
      const res = await setPageNotRelevant({ pageId, value: next })
      if (!res.ok) {
        setValue(!next)
        setError(res.error ?? 'Not saved. Try again in a moment.')
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
        className={`${BTN.white} disabled:opacity-50`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          {value && <path d="m8 12 3 3 5-6" />}
        </svg>
        Not relevant
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  )
}
