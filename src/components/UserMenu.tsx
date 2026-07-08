'use client'

/**
 * UserMenu — the avatar at the far right of the top bar (always the first
 * thing right-to-left). Initials circle in the portal navy; clicking opens a
 * small menu with the signed-in email and Sign out. Replaces the old
 * "Signed in" block that lived at the bottom of the sidebar.
 */

import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/auth/actions'

function initialsOf(email: string | null): string {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function UserMenu({ userEmail }: { userEmail: string | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // Move focus into the menu so keyboard users land on the first item.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus() // return focus to the trigger
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={userEmail ?? 'Account'}
        className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-tn-primary text-white text-xs font-bold tracking-wide hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-tn-primary/40"
      >
        {initialsOf(userEmail)}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-60 z-30 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Signed in</div>
            <div className="text-sm text-slate-800 font-medium truncate" title={userEmail ?? undefined}>
              {userEmail ?? '—'}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
