'use client'

/**
 * NotificationBell: the bell in the top bar. Added on 21 September 2026 ahead
 * of its rules: what notifies whom, and when, is still to be decided, so for
 * now it opens a panel that says so and shows no count. A badge with nothing
 * behind it would teach people to ignore it before it means anything.
 */

import { useEffect, useRef, useState } from 'react'

export function NotificationBell({ startOpen = false }: {
  /** Design check only: show the panel without a click. */
  startOpen?: boolean
} = {}) {
  const [open, setOpen] = useState(startOpen)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Notifications"
        title="Notifications"
        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${open ? 'bg-tn-teal/10 text-tn-teal' : 'text-slate-400 hover:bg-slate-100 hover:text-tn-primary'}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 mt-2 w-80 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">
            Notifications
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold text-tn-ink m-0">Nothing here yet</p>
            <p className="mt-1 text-[12.5px] text-slate-500 leading-relaxed m-0">
              Notifications are being set up. When they are on, what needs your attention will show up here.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
