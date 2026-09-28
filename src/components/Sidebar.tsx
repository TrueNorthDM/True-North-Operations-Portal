'use client'

/**
 * Sidebar: the navy rail, and the panel a hub opens beside it.
 *
 * The navigation redesign of 22 September 2026 (Design/Redesign Handoff,
 * "Direction B"): a solid navy band, icon only, with a gold active state. Four
 * places are hubs (My Work, My Hours, Tools, People, and for admins Admin and
 * Clocky): clicking one opens a white panel of its pages beside the rail, and
 * the hub stays lit while any of its pages is open. Plain places (Home, Chat,
 * Emails) go straight there. The avatar sits at the foot, and holds Settings.
 *
 * What the rail offers is resolved on the server for the person signed in
 * (lib/access/nav.ts, buildRail) and handed over as plain data, so hiding an
 * item and blocking its route come from the same configuration. No counts or
 * dots here: the two notification buttons in the top bar are the only place a
 * number appears.
 *
 * Client Component for the pathname and the open panel. Hidden on a phone
 * (md:flex); the top bar stays usable on its own there.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { UserMenu } from '@/components/UserMenu'
import { NavIcon } from '@/components/NavIcon'
import { onPath, pathOf, type NavItem, type ResolvedEntry } from '@/lib/access/nav'

type Hub = Extract<ResolvedEntry, { kind: 'hub' }>

/** A panel row is lit only for a plain address: a tab (?tab=) or a section (#) shares its page with another row. */
const rowActive = (pathname: string, href: string) => !/[?#]/.test(href) && onPath(pathname, href)

const RAIL_BUTTON = 'group relative flex w-11 h-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C40A]/60'
/**
 * A module that is not finished is drawn faded (22 September 2026), and comes
 * up to full strength while it is the page open, so it never looks off when
 * someone is actually using it.
 */
const railTone = (on: boolean, faded = false) => (on
  ? 'bg-white/[.14] text-[#F2C40A]'
  : faded ? 'bg-transparent text-white/[.28] hover:bg-white/10 hover:text-white/50' : 'bg-transparent text-white/[.62] hover:bg-white/10')
const READINESS_NOTE = { soon: 'Coming soon', building: 'In progress' } as const

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}

/** The click is acknowledged at once, before the server answers: a thin gold bar under the icon. */
function PendingBar({ pending }: { pending: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#F2C40A] transition-opacity ${pending ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0'}`}
    />
  )
}

export function Sidebar({
  rail, user, canSettings = false, menuOpen = false, startHub = null,
}: {
  rail: ResolvedEntry[]
  /** The person signed in (or previewed), for the avatar at the foot of the rail. */
  user: { email: string | null; name: string | null; avatarUrl: string | null }
  /** Settings is a row of the avatar menu, for whoever may reach it. */
  canSettings?: boolean
  /** Design check only: the account menu open. */
  menuOpen?: boolean
  /** Design check only: a hub's panel open. */
  startHub?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, start] = useTransition()
  // The panel belongs to the page it was opened on, so moving to another page
  // closes it without an effect having to notice.
  const [open, setOpen] = useState<{ key: string; path: string } | null>(startHub ? { key: startHub, path: pathname } : null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const aside = useRef<HTMLElement>(null)
  const openKey = open && open.path === pathname ? open.key : null
  const hub = rail.find((e): e is Hub => e.kind === 'hub' && e.key === openKey) ?? null

  const go = (key: string, href: string) => {
    setPendingKey(key)
    setOpen(null)
    start(() => router.push(withViewAs(href)))
  }

  // Outside click and Escape close the panel.
  useEffect(() => {
    if (!openKey) return
    const onDown = (e: MouseEvent) => {
      if (aside.current && !aside.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey])

  // Prefetch every destination, panels included. These are buttons, not
  // <Link>s, so nothing prefetches on its own; deferred until the browser is
  // idle so it never competes with the page still loading. Keyed on the
  // destinations as a string, because the rail is rebuilt on every render.
  const destinations = rail
    .flatMap(e => (e.kind === 'page' ? [e.item.href] : e.kind === 'hub' ? e.groups.flatMap(g => g.items.map(i => i.href)) : []))
    .map(pathOf)
    .filter((h, i, all) => all.indexOf(h) === i)
    .join('|')
  useEffect(() => {
    const run = () => { for (const href of destinations.split('|')) router.prefetch(withViewAs(href)) }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(run, 1500)
    return () => window.clearTimeout(id)
  }, [router, destinations])

  const pageButton = (item: NavItem, readiness?: 'soon' | 'building') => {
    const on = onPath(pathname, pathOf(item.href))
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => go(item.key, item.href)}
        aria-label={item.label}
        aria-current={on ? 'page' : undefined}
        aria-busy={(pending && pendingKey === item.key) || undefined}
        className={`${RAIL_BUTTON} ${railTone(on, !!readiness)}`}
      >
        <NavIcon name={item.icon} />
        <PendingBar pending={pending && pendingKey === item.key} />
        <Tooltip label={readiness ? `${item.label} · ${READINESS_NOTE[readiness]}` : item.label} />
      </button>
    )
  }

  const hubButton = (h: Hub) => {
    const isOpen = openKey === h.key
    const on = isOpen || h.matches.some(m => onPath(pathname, m))
    return (
      <button
        key={h.key}
        type="button"
        onClick={() => {
          if (h.direct) { go(h.key, h.direct); return }
          setOpen(isOpen ? null : { key: h.key, path: pathname })
        }}
        aria-label={h.label}
        aria-haspopup={h.direct ? undefined : 'menu'}
        aria-expanded={h.direct ? undefined : isOpen}
        aria-busy={(pending && pendingKey === h.key) || undefined}
        className={`${RAIL_BUTTON} ${railTone(on, !!h.readiness)}`}
      >
        <NavIcon name={h.icon} />
        <PendingBar pending={pending && pendingKey === h.key} />
        {!isOpen && <Tooltip label={h.readiness ? `${h.label} · ${READINESS_NOTE[h.readiness]}` : h.label} />}
      </button>
    )
  }

  return (
    <aside ref={aside} className="hidden md:flex shrink-0 sticky top-[65px] h-[calc(100vh-65px)] z-30">
      <div className="w-16 flex flex-col items-center bg-[#012358] py-2.5">
        <nav aria-label="Main" className="flex flex-col items-center gap-0.5">
          {rail.map((e, i) =>
            e.kind === 'rule'
              ? <div key={`rule-${i}`} aria-hidden="true" className="shrink-0 w-7 h-px bg-white/[.16] my-[7px]" />
              : e.kind === 'page' ? pageButton(e.item, e.readiness) : hubButton(e),
          )}
        </nav>
        <div className="mt-auto pb-1.5 flex justify-center">
          <UserMenu userEmail={user.email} userName={user.name} avatarUrl={user.avatarUrl} placement="rail" startOpen={menuOpen} canSettings={canSettings} />
        </div>
      </div>

      {hub && (
        <div
          role="menu"
          aria-label={hub.label}
          className="w-[244px] shrink-0 bg-white border-r border-[var(--panel-border)] px-2.5 py-4 flex flex-col gap-1.5 overflow-y-auto shadow-[10px_0_24px_rgba(1,35,88,.10)]"
        >
          <div className="flex items-center justify-between px-2 pb-1.5">
            {hub.landing ? (
              <Link
                href={withViewAs(hub.landing)}
                onClick={() => setOpen(null)}
                className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink hover:text-tn-teal transition-colors"
                title={`Open ${hub.label}`}
              >
                {hub.label}
              </Link>
            ) : (
              <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{hub.label}</span>
            )}
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-muted hover:text-tn-ink text-[18px] leading-none px-1">×</button>
          </div>
          <p className="text-[12px] text-muted leading-normal px-2 pb-2.5 m-0">{hub.hint}</p>
          {hub.groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5 pb-2">
              {g.label && <div className="px-2 pt-1.5 pb-1 text-[10.5px] font-bold tracking-[.09em] uppercase text-muted">{g.label}</div>}
              {g.items.map(item => {
                const on = rowActive(pathname, item.href)
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => go(item.key, item.href)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg p-2 text-left text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${on ? 'bg-tn-teal/10 text-tn-teal' : 'text-foreground hover:bg-subtle'}`}
                  >
                    <NavIcon name={item.icon} size={17} className="shrink-0" />
                    <span className="flex-1 min-w-0 leading-snug">{item.label}</span>
                    {item.soon && <span className="shrink-0 rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">SOON</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
