'use client'

/**
 * Sidebar — left-rail navigation.
 *
 * Client Component because it uses usePathname() to highlight the active item.
 * Hidden on mobile (md:flex) — the top bar remains usable on its own there.
 * The signed-in block moved to the top-bar avatar (UserMenu).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const iconClass = 'w-6 h-6 shrink-0'

// Home — house outline.
const HomeIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
)

// Grid icon — used for the Projects overview.
const DashboardIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

// Boards Review — kanban board outline (split into columns). Distinct from the
// dashboard grid icon so the two top-level views read differently at a glance.
const BoardsIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18" />
  </svg>
)

// Tools — wrench outline (capabilities that run inside a project).
const ToolsIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

// My Work — briefcase outline (everything assigned to you across Monday).
const WorkIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

// Directory — two people (the org directory / people & teams).
const DirectoryIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

// Admin — shield with check (access control: people, teams, permissions).
const AdminIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

// Settings — gear icon
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
  label: 'Home',
  icon: HomeIcon,
  match: p => p === '/',
}

// Dashboards landing → the Boards Review dashboards. Also highlights while on
// any /boards-beta route, since those are reached from this section.
const dashboards: Item = {
  href: '/dashboards',
  label: 'Dashboards',
  icon: DashboardIcon,
  match: p => p === '/dashboards' || p.startsWith('/boards-beta'),
}

// Projects overview (AAAF/HFA hreflang management) — the former root dashboard.
const projectsNav: Item = {
  href: '/projects',
  label: 'Projects',
  icon: BoardsIcon,
  match: p => p === '/projects',
}

// Tools — capabilities that run inside a project (Href Link Management, …).
const toolsNav: Item = {
  href: '/tools',
  label: 'Tools',
  icon: ToolsIcon,
  match: p => p === '/tools' || p.startsWith('/tools/'),
}

// My Work — the signed-in person's tasks across Monday (board + list).
const myWorkNav: Item = {
  href: '/my-work',
  label: 'My Work',
  icon: WorkIcon,
  match: p => p === '/my-work',
}

// Directory — the People & Teams directory (its own top-level page). Admin-only,
// like Admin; the /directory route also guards server-side.
const directoryNav: Item = {
  href: '/directory',
  label: 'Directory',
  icon: DirectoryIcon,
  match: p => p === '/directory' || p.startsWith('/directory/'),
}

// Admin — people, teams, and access control. Only shown to portal admins; the
// /admin route also guards server-side, so hiding the link is convenience only.
const adminNav: Item = {
  href: '/admin',
  label: 'Admin',
  icon: AdminIcon,
  match: p => p === '/admin' || p.startsWith('/admin/'),
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={`group relative mx-auto flex w-11 h-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${
        active
          ? 'bg-tn-teal/10 text-tn-teal'
          : 'text-slate-400 hover:bg-slate-100 hover:text-tn-primary'
      }`}
    >
      {item.icon}
      {/* Name tooltip — appears to the right on hover/focus. bg-slate-800 +
          text-white auto-invert in dark mode via the palette remap. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {item.label}
      </span>
    </Link>
  )
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    // Icon-only rail. No overflow clipping, so the hover tooltips can extend
    // past the rail to the right (the few items always fit vertically).
    <aside className="hidden md:flex flex-col w-16 shrink-0 border-r border-slate-200 bg-white sticky top-[65px] h-[calc(100vh-65px)]">
      <nav className="py-3 space-y-1.5">
        <NavLink item={home} active={home.match(pathname)} />
        <NavLink item={dashboards} active={dashboards.match(pathname)} />
        <NavLink item={projectsNav} active={projectsNav.match(pathname)} />
        <NavLink item={toolsNav} active={toolsNav.match(pathname)} />
        <NavLink item={myWorkNav} active={myWorkNav.match(pathname)} />
        {isAdmin && <NavLink item={directoryNav} active={directoryNav.match(pathname)} />}
      </nav>

      <div className="mt-auto border-t border-slate-100 py-3 space-y-1.5">
        {/* Admin (management) is kept separate from the content pillars above,
            and only rendered for admins. */}
        {isAdmin && <NavLink item={adminNav} active={adminNav.match(pathname)} />}
        <NavLink
          item={{
            href: '/settings',
            label: 'Settings',
            icon: SettingsIcon,
            match: p => p === '/settings' || p.startsWith('/settings/'),
          }}
          active={pathname === '/settings' || pathname.startsWith('/settings/')}
        />
      </div>
    </aside>
  )
}
