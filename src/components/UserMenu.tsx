'use client'

/**
 * UserMenu: the person's avatar. Initials circle in the portal navy; clicking
 * opens a small menu with the signed-in email, My profile, My Team, Settings and
 * Sign out.
 *
 * Two places since 21 September 2026: at the foot of the rail on a desktop
 * (`placement="rail"`, the menu opening to the right and upward), and at the
 * right of the top bar on a phone, where the rail is hidden.
 *
 * The company settings were a row here from 22 September to 7 October 2026;
 * they now live in Admin, Configuration (/admin/settings), and the row is each
 * person's own Settings (/settings). On the navy rail the avatar is a white
 * circle with navy initials and a faint white ring (the Clocky handoff, 20
 * October 2026), the ring going solid while the menu is open.
 *
 * Since 28 September 2026 (two-step sign-in), someone whose week to set it up is
 * running gets a "Two-step sign-in" row under My profile, straight to the setup
 * screen, and a small amber dot on the avatar. Once it is on the row goes away:
 * from then on it lives in Settings, under Sign-in and security.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/auth/actions'
import { Avatar } from '@/components/Avatar'
import { initialsOf } from '@/lib/directory/people-types'
import { ShieldIcon, SETUP_HREF } from '@/components/mfa/TwoStepBanner'

export function UserMenu({ userEmail, userName, avatarUrl, placement = 'bar', startOpen = false, twoStepDaysLeft = null, canMyTeam = true }: {
  userEmail: string | null
  userName?: string | null
  avatarUrl?: string | null
  /** The top bar (menu drops below, right-aligned) or the foot of the rail (menu opens to the right, upward). */
  placement?: 'bar' | 'rail'
  /** Design check only: show the menu without a click. */
  startOpen?: boolean
  /** Days left to set up two-step sign-in, while that week runs; null otherwise. */
  twoStepDaysLeft?: number | null
  /** My Team (my-team): the item shows only for whoever opens it. */
  canMyTeam?: boolean
}) {
  // Name for the avatar initials, the person's name, else the email local part.
  const initialsName = userName ?? (userEmail ? userEmail.split('@')[0].replace(/[._-]+/g, ' ') : null)
  const [open, setOpen] = useState(startOpen)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // Move focus into the menu so keyboard users land on the first item. The
    // items style their own :focus-visible with an INSET ring: the browser's
    // default outline is drawn outside the element, and this menu clips with
    // overflow-hidden, so its left and right edges were cut away and it read
    // as two stray horizontal lines rather than a focus ring.
    //
    // preventScroll matters inside the View Stage: a plain focus() scrolls the
    // element into view, and that scroll propagates out of the iframe into the
    // preview canvas, shoving the whole column sideways with no way back (the
    // canvas pans by transform and never reads scrollLeft).
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus({ preventScroll: true }) // return focus to the trigger
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
        className={placement === 'rail'
          ? `relative inline-flex items-center justify-center rounded-full ring-2 transition-shadow focus:outline-none focus-visible:ring-white ${open ? 'ring-white' : 'ring-white/35 hover:ring-white/60'}`
          : 'relative inline-flex items-center justify-center rounded-full hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-tn-primary/40'}
      >
        {placement === 'rail'
          // The handoff's rail avatar (owner, 20 October 2026): 38px, white, navy
          // initials in Open Sans 700 12px, inside a 35% white ring.
          ? (avatarUrl
            ? <Avatar name={initialsName} avatarUrl={avatarUrl} size={38} />
            : <span className="shrink-0 inline-flex items-center justify-center w-[38px] h-[38px] rounded-full bg-white text-tn-ink font-sans font-bold text-[12px]">{initialsOf(initialsName)}</span>)
          : <Avatar name={initialsName} avatarUrl={avatarUrl} size={36} color="#012358" />}
        {twoStepDaysLeft !== null && (
          <span aria-hidden="true" className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#e8a317] ring-2 ${placement === 'rail' ? 'ring-[#012358]' : 'ring-white'}`} />
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute w-60 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden ${placement === 'rail' ? 'left-full bottom-0 ml-3' : 'right-0 mt-2'}`}
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
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-tn-ink transition-colors border-b border-slate-100 focus:outline-none focus-visible:bg-slate-50 focus-visible:text-tn-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tn-teal/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            My profile
          </Link>
          {twoStepDaysLeft !== null && (
            <Link
              href={SETUP_HREF}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-tn-ink transition-colors border-b border-slate-100 focus:outline-none focus-visible:bg-slate-50 focus-visible:text-tn-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tn-teal/40"
            >
              <ShieldIcon />
              <span className="flex flex-col leading-tight">
                <span>Two-step sign-in</span>
                <span className="text-[11.5px] font-semibold text-[#9a7400]">
                  Set it up: {twoStepDaysLeft} {twoStepDaysLeft === 1 ? 'day' : 'days'} left
                </span>
              </span>
            </Link>
          )}
          {canMyTeam && <Link
            href="/my-work?tab=team"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-tn-ink transition-colors border-b border-slate-100 focus:outline-none focus-visible:bg-slate-50 focus-visible:text-tn-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tn-teal/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            My Team
          </Link>}
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-tn-ink transition-colors border-b border-slate-100 focus:outline-none focus-visible:bg-slate-50 focus-visible:text-tn-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tn-teal/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors focus:outline-none focus-visible:bg-slate-50 focus-visible:text-red-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tn-teal/40"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
