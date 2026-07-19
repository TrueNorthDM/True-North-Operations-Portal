'use client'

/**
 * UserMenu: the avatar at the far right of the top bar (always the first
 * thing right-to-left). Initials circle in the portal navy; clicking opens a
 * small menu with the signed-in email and Sign out. Replaces the old
 * "Signed in" block that lived at the bottom of the sidebar.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/auth/actions'
import { Avatar } from '@/components/Avatar'

export function UserMenu({ userEmail, userName, avatarUrl }: { userEmail: string | null; userName?: string | null; avatarUrl?: string | null }) {
  // Name for the avatar initials, the person's name, else the email local part.
  const initialsName = userName ?? (userEmail ? userEmail.split('@')[0].replace(/[._-]+/g, ' ') : null)
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
        title={userName ?? userEmail ?? 'Account'}
        className="inline-flex items-center justify-center rounded-full hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-tn-primary/40"
      >
        <Avatar name={initialsName} avatarUrl={avatarUrl} size={36} color="#012358" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-60 z-30 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Signed in</div>
            {userName && <div className="text-sm text-slate-800 font-semibold truncate" title={userName}>{userName}</div>}
            <div className={`truncate ${userName ? 'text-[12.5px] text-slate-500' : 'text-sm text-slate-800 font-medium'}`} title={userEmail ?? undefined}>
              {userEmail ?? '-'}
            </div>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-tn-ink transition-colors border-b border-slate-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            My profile
          </Link>
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
