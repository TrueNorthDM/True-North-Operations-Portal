'use client'

/**
 * Sidebar: the navy rail, and the panel a hub opens beside it.
 *
 * The navigation redesign of 22 September 2026 (Design/Redesign Handoff,
 * "Direction B"): a solid navy band, icon only, with a gold active state. Five
 * places are hubs (My Work, Tools, People, Clocky, and for admins Admin; My
 * Hours went into Clocky on 16 October 2026): clicking one opens a white panel
 * of its pages beside the rail, and
 * the hub stays lit while any of its pages is open. Plain places (Home, Chat,
 * Emails) go straight there. The avatar sits at the foot, and holds Settings.
 *
 * What the rail offers is resolved on the server for the person signed in
 * (lib/access/nav.ts, buildRail) and handed over as plain data, so hiding an
 * item and blocking its route come from the same configuration. Counts on
 * the rail itself since 25 October 2026 (owner, reversing "no counts on the
 * rail"): a panel row carries what in its page needs this person's attention
 * (lib/nav/counts.ts NavCount), and its hub's icon carries the sum, gold on
 * the navy, drawn only above zero. They are read together in one call on
 * mount, after each navigation (a decision made on a page shows on the next
 * one) and when a panel opens.
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
import type { NavItem, ResolvedEntry } from '@/lib/access/nav'
import { NAV_COUNT_LABEL, badgeText, hubCount, railCountKeys, type NavCount } from '@/lib/nav/counts'
import { getRailCounts } from '@/app/(app)/rail-actions'
import { onPath, pathOf } from '@/lib/nav/path'

type Hub = Extract<ResolvedEntry, { kind: 'hub' }>

/** A panel row is lit only for a plain address: a tab (?tab=) or a section (#) shares its page with another row. */
const rowActive = (pathname: string, href: string) => !/[?#]/.test(href) && onPath(pathname, href)

const RAIL_BUTTON = 'group relative flex w-11 h-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C40A]/60'
/**
 * A module that is not finished is drawn faded (22 September 2026), and comes
 * up to full strength while it is the page open, so it never looks off when
 * someone is actually using it.
 */
// As Design/design_handoff_clocky draws the rail (owner, 20 October 2026): the
// page you are on is a white icon on a 14% white square; a hub whose panel is
// open turns its icon gold; the rest are 62% white.
const railTone = (state: 'open' | 'current' | 'off', faded = false) => (state === 'open'
  ? 'bg-white/[.14] text-[#F2C40A]'
  : state === 'current' ? 'bg-white/[.14] text-white'
  : faded ? 'bg-transparent text-white/[.40] hover:bg-white/10 hover:text-white/60' : 'bg-transparent text-white/[.62] hover:bg-white/10')
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

/**
 * A hub's number on its icon (owner, 25 October 2026): gold on the navy, in the
 * button's top right corner, ringed in the navy so it stands off the glyph. A
 * pill, never a corner triangle (owner rule for rail icons).
 */
function RailBadge({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[3px] right-[3px] min-w-4 h-4 box-border px-1 rounded-full bg-[#F2C40A] text-[#012358] text-[10px] font-bold leading-none tabular-nums inline-flex items-center justify-center ring-2 ring-[#012358]"
    >
      {badgeText(n)}
    </span>
  )
}

const attention = (n: number) => (n > 0 ? `${n} need${n === 1 ? 's' : ''} your attention` : '')

export function Sidebar({
  rail, user, menuOpen = false, startHub = null, twoStepDaysLeft = null, canMyTeam = true, startCounts, activePath,
}: {
  rail: ResolvedEntry[]
  /** The person signed in (or previewed), for the avatar at the foot of the rail. */
  user: { email: string | null; name: string | null; avatarUrl: string | null }
  /** Design check only: the account menu open. */
  menuOpen?: boolean
  /** Design check only: a hub's panel open. */
  startHub?: string | null
  /** Days left to set up two-step sign-in, while that week runs: the avatar menu offers it. */
  twoStepDaysLeft?: number | null
  canMyTeam?: boolean
  /** Design check only: the counts, fixed, without asking the server (an empty object: none). */
  startCounts?: Partial<Record<NavCount, number>>
  /** Design check only: the page the rail marks as current, instead of the address. */
  activePath?: string
}) {
  const realPath = usePathname()
  const pathname = activePath ?? realPath
  const router = useRouter()
  const [pending, start] = useTransition()
  // The panel belongs to the page it was opened on, so moving to another page
  // closes it without an effect having to notice.
  const [open, setOpen] = useState<{ key: string; path: string } | null>(startHub ? { key: startHub, path: pathname } : null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const aside = useRef<HTMLElement>(null)
  const openKey = open && open.path === pathname ? open.key : null
  const hub = rail.find((e): e is Hub => e.kind === 'hub' && e.key === openKey) ?? null
  const [counts, setCounts] = useState<Partial<Record<NavCount, number>>>(startCounts ?? {})
  // Every count this person's rail carries, in one call: on mount, after each
  // navigation, and each time a panel opens (`asked`), so they are current.
  // Keyed on the keys as a string, because the rail is rebuilt on every render.
  const countKeys = railCountKeys(rail).join('|')
  const fixed = startCounts !== undefined
  const [asked, setAsked] = useState(0)
  useEffect(() => {
    if (!countKeys || fixed) return
    let live = true
    getRailCounts(countKeys.split('|')).then(c => { if (live) setCounts(prev => ({ ...prev, ...c })) }).catch(() => {})
    return () => { live = false }
  }, [countKeys, fixed, realPath, asked])

  const go = (key: string, href: string) => {
    setPendingKey(key)
    setOpen(null)
    start(() => router.push(withViewAs(href)))
  }

  // Outside click and Escape close the panel. Keyboard (audit, 8 October 2026):
  // focus moves into the panel when it opens, the arrow keys move between its
  // rows, and Escape gives focus back to the rail button that opened it.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!openKey) return
    panel.current?.querySelector<HTMLElement>('[data-row]')?.focus({ preventScroll: true })
    const onDown = (e: MouseEvent) => {
      if (aside.current && !aside.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null)
        aside.current?.querySelector<HTMLElement>(`[data-hub="${openKey}"]`)?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const rows = [...(panel.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])]
      const at = rows.indexOf(document.activeElement as HTMLElement)
      if (at < 0) return
      e.preventDefault()
      rows[(at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]?.focus()
    }
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
        aria-label={readiness ? `${item.label}, ${READINESS_NOTE[readiness].toLowerCase()}` : item.label}
        aria-current={on ? 'page' : undefined}
        aria-busy={(pending && pendingKey === item.key) || undefined}
        className={`${RAIL_BUTTON} ${railTone(on ? 'current' : 'off', !!readiness)}`}
      >
        <NavIcon name={item.icon} />
        <PendingBar pending={pending && pendingKey === item.key} />
        <Tooltip label={readiness ? `${item.label} · ${READINESS_NOTE[readiness]}` : item.label} />
      </button>
    )
  }

  const hubButton = (h: Hub) => {
    const isOpen = openKey === h.key
    const here = h.matches.some(m => onPath(pathname, m))
    const n = hubCount(h, counts)
    const spoken = [h.label, h.readiness ? READINESS_NOTE[h.readiness].toLowerCase() : '', attention(n)].filter(Boolean).join(', ')
    const tip = [h.label, h.readiness ? READINESS_NOTE[h.readiness] : '', attention(n)].filter(Boolean).join(' · ')
    return (
      <button
        key={h.key}
        type="button"
        onClick={() => {
          if (h.direct) { go(h.key, h.direct); return }
          if (!isOpen) setAsked(a => a + 1)
          setOpen(isOpen ? null : { key: h.key, path: pathname })
        }}
        data-hub={h.key}
        aria-label={spoken}
        aria-expanded={h.direct ? undefined : isOpen}
        aria-controls={h.direct || !isOpen ? undefined : 'rail-panel'}
        aria-busy={(pending && pendingKey === h.key) || undefined}
        className={`${RAIL_BUTTON} ${railTone(isOpen ? 'open' : here ? 'current' : 'off', !!h.readiness)}`}
      >
        <NavIcon name={h.icon} />
        <RailBadge n={n} />
        <PendingBar pending={pending && pendingKey === h.key} />
        {!isOpen && <Tooltip label={tip} />}
      </button>
    )
  }

  return (
    <aside ref={aside} className="hidden md:flex shrink-0 sticky top-[var(--chrome-top)] h-[calc(100vh-var(--chrome-top))] z-30">
      <div className="w-16 flex flex-col items-center bg-[#012358] py-2.5">
        <nav aria-label="Main" className="flex flex-col items-center gap-0.5">
          {rail.map((e, i) =>
            e.kind === 'rule'
              ? <div key={`rule-${i}`} aria-hidden="true" className="shrink-0 w-7 h-px bg-white/[.16] my-[7px]" />
              : e.kind === 'page' ? pageButton(e.item, e.readiness) : hubButton(e),
          )}
        </nav>
        <div className="mt-auto pb-1.5 flex justify-center">
          <UserMenu userEmail={user.email} userName={user.name} avatarUrl={user.avatarUrl} placement="rail" startOpen={menuOpen} twoStepDaysLeft={twoStepDaysLeft} canMyTeam={canMyTeam} />
        </div>
      </div>

      {hub && (
        <nav
          ref={panel}
          id="rail-panel"
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
                const count = item.count ? counts[item.count] ?? 0 : 0
                const meaning = item.count ? NAV_COUNT_LABEL[item.count] : ''
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-row
                    onClick={() => go(item.key, item.href)}
                    aria-label={item.soon ? `${item.label}, coming soon` : count > 0 ? `${item.label}, ${count} ${meaning.toLowerCase()}` : undefined}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg p-2 text-left text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${on ? 'bg-tn-teal/10 text-tn-teal' : 'text-foreground hover:bg-subtle'}`}
                  >
                    <NavIcon name={item.icon} size={17} className="shrink-0" />
                    <span className="flex-1 min-w-0 leading-snug">{item.label}</span>
                    {item.soon && <span className="shrink-0 rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#8a6703]">SOON</span>}
                    {count > 0 && (
                      <span title={meaning} className="shrink-0 min-w-5 h-5 box-border px-1.5 rounded-full bg-[var(--warn-bg)] border border-[#e9d48a] text-[var(--warn-fg)] text-[11px] font-bold inline-flex items-center justify-center tabular-nums">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      )}
    </aside>
  )
}
