'use client'

/**
 * NotificationButton: a top-bar button that opens one of the two notification
 * drawers (navigation redesign, 22 September 2026). `bell` is Notifications
 * (Tools and System), `inbox` is Messages (Chat and Email).
 *
 * Grown out of the NotificationBell placeholder of 21 September 2026, keeping
 * its button, its outside-click and Escape handling and its dialog wiring. The
 * badge is the unread count of both tabs together and is drawn only when
 * there is something unread. The bell is fed by the layout since 22 September
 * 2026; Messages has no source yet, so it never shows a count. What was read
 * since the page loaded is kept here, so the count drops the moment something
 * is opened. The chosen tab is remembered per drawer.
 */

import { useEffect, useRef, useState } from 'react'
import { NavIcon } from '@/components/NavIcon'
import { DRAWERS, NotificationDrawer, type DrawerKind, type NotificationItem } from '@/components/NotificationDrawer'

const TAB_KEY = (kind: DrawerKind) => `tn.notifications.tab.${kind}`

function storedTab(kind: DrawerKind): string | null {
  try { return window.localStorage.getItem(TAB_KEY(kind)) } catch { return null }
}

const BADGE: Record<DrawerKind, string> = {
  bell: 'bg-tn-primary text-[#F2C40A]',
  inbox: 'bg-tn-teal text-[#ffffff]',
}

export function NotificationButton({ kind, items = {}, startOpen = false }: {
  kind: DrawerKind
  /** Rows per tab key, from the layout. */
  items?: Record<string, NotificationItem[]>
  /** Design check only: show the drawer without a click. */
  startOpen?: boolean
}) {
  const d = DRAWERS[kind]
  const [open, setOpen] = useState(startOpen)
  const [tab, setTab] = useState<string>(d.tabs[0].key)
  const [read, setRead] = useState<ReadonlySet<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const unread = d.tabs.reduce((n, t) => n + (items[t.key] ?? []).filter(i => i.unread && !read.has(i.id)).length, 0)

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

  const toggle = () => {
    if (!open) {
      const saved = storedTab(kind)
      if (saved && d.tabs.some(t => t.key === saved)) setTab(saved)
    }
    setOpen(o => !o)
  }
  const pickTab = (key: string) => {
    setTab(key)
    try { window.localStorage.setItem(TAB_KEY(kind), key) } catch { /* private window: not remembered */ }
  }

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `${d.title}, ${unread} unread` : d.title}
        title={kind === 'bell' ? 'Tools and system' : 'Chat and email'}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${open ? 'bg-tn-teal/10 text-tn-teal' : 'text-slate-500 hover:bg-slate-100 hover:text-tn-primary'}`}
      >
        <NavIcon name={d.icon} />
        {unread > 0 && (
          <span className={`absolute top-[3px] right-[2px] min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold leading-none ring-2 ring-white whitespace-nowrap ${BADGE[kind]}`}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <NotificationDrawer
          kind={kind} tab={tab} onTab={pickTab} items={items}
          read={read} onRead={ids => setRead(prev => new Set([...prev, ...ids]))}
          onUnread={ids => setRead(prev => new Set([...prev].filter(id => !ids.includes(id))))}
          // Every way out gives focus back to the button, not only Escape.
          onClose={() => { setOpen(false); btnRef.current?.focus({ preventScroll: true }) }}
        />
      )}
    </div>
  )
}
