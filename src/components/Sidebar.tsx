'use client'

/**
 * Sidebar: left-rail navigation.
 *
 * Client Component because it uses usePathname() to highlight the active item.
 * Hidden on mobile (md:flex), the top bar remains usable on its own there.
 * The signed-in block moved to the top-bar avatar (UserMenu).
 */

import { useEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { NAV_LABEL } from '@/lib/nav/labels'

const iconClass = 'w-6 h-6 shrink-0'

// Home: house outline.
const HomeIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
)

// Grid icon, used for the Projects overview.
const DashboardIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

// My Work, briefcase outline (everything assigned to you across Monday).
const WorkIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

// Directory: two people (the org directory / people & teams).
const DirectoryIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

// Admin: shield with check (access control: people, teams, permissions).
const AdminIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

// Human Resources, an award medal (anniversary badges live here).
const HrIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
)

// Settings: gear icon
const SettingsIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

interface Item {
  href: string
  label: string
  icon: React.ReactNode
  match: (path: string) => boolean
}

const home: Item = {
  href: '/',
  label: NAV_LABEL['/'],
  icon: HomeIcon,
  match: p => p === '/',
}

// Work Tools, the unified hub (Boards Review dashboards + the tools
// used inside a project). Highlights across /work-tools, /dashboards and /boards-beta.
const toolsDash: Item = {
  href: '/work-tools',
  label: NAV_LABEL['/work-tools'],
  icon: DashboardIcon,
  match: p => p === '/work-tools' || p.startsWith('/work-tools/') || p === '/dashboards' || p.startsWith('/dashboards/') || p.startsWith('/boards-beta'),
}

// My Work, the signed-in person's tasks across Monday.
//
// One rail item for a module of three separately granted views. The layout
// resolves where it points, because a person with Report but not My Work has
// to land on the Report rather than on a redirect to login.
const myWorkNav: Item = {
  href: '/my-work',
  label: NAV_LABEL['/my-work'],
  icon: WorkIcon,
  match: p => p === '/my-work' || p === '/report',
}


// My Hours: the person's own clock.
const ClockIcon = (
  <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 12V7" />
    <path d="M12 12h4" />
  </svg>
)

const myHoursNav: Item = {
  href: '/hours',
  label: NAV_LABEL['/hours'],
  icon: ClockIcon,
  match: p => p === '/hours' || p.startsWith('/hours/'),
}

// Clocky Hours, the module behind it: rules, migration, and later approvals. A
// dial rather than a clock face, so the two are not mistaken for each other at
// a glance in a rail of monochrome icons.
const ClockyIcon = (
  <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <path d="M3.5 9.5h2M18.5 9.5h2" />
  </svg>
)

const clockyHoursNav: Item = {
  href: '/clocky-hours',
  label: NAV_LABEL['/clocky-hours'],
  icon: ClockyIcon,
  match: p => p === '/clocky-hours' || p.startsWith('/clocky-hours/'),
}

// Directory: the People & Teams directory (its own top-level page). Admin-only,
// like Admin; the /directory route also guards server-side.
const directoryNav: Item = {
  href: '/directory',
  label: NAV_LABEL['/directory'],
  icon: DirectoryIcon,
  match: p => p === '/directory' || p.startsWith('/directory/'),
}

// Admin: people, teams, and access control. Only shown to portal admins; the
// /admin route also guards server-side, so hiding the link is convenience only.
const adminNav: Item = {
  href: '/admin',
  label: NAV_LABEL['/admin'],
  icon: AdminIcon,
  match: p => p === '/admin' || p.startsWith('/admin/'),
}

// Human Resources, anniversary badges (for now). Privileged only.
const hrNav: Item = {
  href: '/human-resources',
  label: NAV_LABEL['/human-resources'],
  icon: HrIcon,
  match: p => p === '/human-resources' || p.startsWith('/human-resources/'),
}

const settingsNav: Item = {
  href: '/settings',
  label: NAV_LABEL['/settings'],
  icon: SettingsIcon,
  match: p => p === '/settings' || p.startsWith('/settings/'),
}

// Rail order, one single group. Keys match access/surfaces.ts; the layout
// passes only the ones this person may reach.
const NAV: readonly { key: string; item: Item }[] = [
  { key: 'home', item: home },
  { key: 'tools', item: toolsDash },
  { key: 'my-work', item: myWorkNav },
  { key: 'my-hours', item: myHoursNav },
  { key: 'directory', item: directoryNav },
  { key: 'human-resources', item: hrNav },
  { key: 'admin', item: adminNav },
  { key: 'clocky-hours', item: clockyHoursNav },
  { key: 'settings', item: settingsNav },
]

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const router = useRouter()
  // The click is acknowledged on this item at once, before the server has said
  // anything. next/link's useLinkStatus does this for links, and this rail is
  // buttons, so a transition stands in for it: pending from the click until the
  // new page, or its loading skeleton, is on screen.
  const [pending, start] = useTransition()
  return (
    // A button (not an <a href>) so the browser never surfaces the destination
    // URL on hover, the friendly name tooltip below is all we want to show.
    // router.push keeps SPA navigation. (Trade-off: no cmd/middle-click new tab.)
    <button
      type="button"
      onClick={() => start(() => router.push(withViewAs(item.href)))}
      aria-label={item.label}
      aria-busy={pending || undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative mx-auto flex w-11 h-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${
        active
          ? 'bg-tn-teal/10 text-tn-teal'
          : 'bg-transparent text-slate-400 hover:bg-slate-100 hover:text-tn-primary'
      }`}
    >
      {item.icon}
      {/* Always rendered and faded in, so marking the click never shifts the rail. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-tn-teal transition-opacity ${
          pending ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0'
        }`}
      />
      {/* Name tooltip, appears to the right on hover/focus. bg-slate-800 +
          text-white auto-invert in dark mode via the palette remap. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {item.label}
      </span>
    </button>
  )
}

/**
 * `allowed` is the set of surface keys this person may reach, resolved in the
 * layout from Admin → Access levels. The rail renders only those, so hiding an
 * item and blocking its route now come from the same configuration.
 */
export function Sidebar(
  { allowed, hrefs }: { allowed: readonly string[]; hrefs?: Record<string, string> },
) {
  const pathname = usePathname()
  const router = useRouter()
  const on = new Set(allowed)
  const items = NAV
    .filter(n => on.has(n.key))
    // A module's destination depends on which of its views this person has.
    .map(n => (hrefs?.[n.key] ? { ...n, item: { ...n.item, href: hrefs[n.key] } } : n))

  // Prefetch every destination on the rail. A <Link> does this by itself; these
  // are buttons, so until September 2026 the portal's main navigation never
  // prefetched anything and every click waited on a cold request. Each prefetch
  // fetches the destination's loading skeleton, which is what lets the click show
  // it at once. Deferred until the browser is idle so it never competes with the
  // page that is still loading. Keyed on the destinations as a string, because the
  // array is rebuilt on every render.
  const destinations = items.map(n => n.item.href).join('|')
  useEffect(() => {
    const run = () => { for (const href of destinations.split('|')) router.prefetch(withViewAs(href)) }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(run, 1500)
    return () => window.clearTimeout(id)
  }, [router, destinations])

  return (
    // Icon-only rail. No overflow clipping, so the hover tooltips can extend
    // past the rail to the right (the few items always fit vertically).
    <aside className="hidden md:flex flex-col w-16 shrink-0 border-r border-slate-200 bg-white sticky top-[65px] h-[calc(100vh-65px)] z-30">
      <nav className="py-3 space-y-1.5">
        {items.map(n => <NavLink key={n.key} item={n.item} active={n.item.match(pathname)} />)}
      </nav>
    </aside>
  )
}
