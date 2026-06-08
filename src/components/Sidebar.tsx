'use client'

/**
 * Sidebar — left-rail navigation.
 *
 * Client Component because it uses usePathname() to highlight the active item.
 * Hidden on mobile (md:flex) — the top bar remains usable on its own there.
 */

import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'

const iconClass = 'w-5 h-5 shrink-0'

// Dashboard — system-level destination, uses an outline icon (Lucide-style).
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

// Settings — gear icon
const SettingsIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// Projects use brand-colored monogram avatars (24×24 squares with the first
// letter in white). Pattern is consistent with workspace switchers in Linear,
// Vercel, etc. Brand color carries the identity; same shape across projects
// keeps the rail visually aligned regardless of how many projects exist.
function Monogram({ letter, bgClass }: { letter: string; bgClass: string }) {
  return (
    <span
      aria-hidden="true"
      className={`w-6 h-6 shrink-0 rounded text-white font-bold text-[11px] flex items-center justify-center ${bgClass}`}
    >
      {letter}
    </span>
  )
}

interface Item {
  href: string
  label: string
  icon: React.ReactNode
  match: (path: string) => boolean
}

const dashboard: Item = {
  href: '/',
  label: 'Dashboard',
  icon: DashboardIcon,
  match: p => p === '/',
}

// Boards Review — the editorial pipeline + publishing-goals dashboard (absorbed
// from the COE Dashboard). For now it's served as a self-contained page at
// /boards.html (still behind the portal auth gate), so this is a plain full-page
// navigation out of the React shell. match() never matches a React route, so it
// doesn't highlight — clicking it leaves the SPA entirely. Phase B rewrites it
// into native portal routes.
const boardsReview: Item = {
  href: '/boards.html',
  label: 'Boards Review',
  icon: BoardsIcon,
  match: () => false,
}

// Native React rewrite (Phase B), served at /boards-beta. Shown alongside the
// legacy boards.html during the transition so the two can be compared; the
// legacy link + file are removed at cutover (B6) once this is verified.
const boardsReviewBeta: Item = {
  href: '/boards-beta',
  label: 'Boards Review (beta)',
  icon: BoardsIcon,
  match: p => p === '/boards-beta' || p.startsWith('/boards-beta/'),
}

const projects: Item[] = [
  {
    href: '/aaaf',
    label: 'AAAF',
    icon: <Monogram letter="A" bgClass="bg-aaaf-primary" />,
    match: p => p === '/aaaf' || p.startsWith('/aaaf/'),
  },
  {
    href: '/hfa',
    label: 'HFA',
    icon: <Monogram letter="H" bgClass="bg-hfa-primary" />,
    match: p => p === '/hfa' || p.startsWith('/hfa/'),
  },
]

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <a
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-slate-100 text-slate-900 font-semibold'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span className={active ? 'text-slate-800' : 'text-slate-400'}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </a>
  )
}

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-slate-200 bg-white sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
      <nav className="p-3 space-y-1">
        <NavLink item={dashboard} active={dashboard.match(pathname)} />
        <NavLink item={boardsReview} active={boardsReview.match(pathname)} />
        <NavLink item={boardsReviewBeta} active={boardsReviewBeta.match(pathname)} />
      </nav>

      <div className="px-3 mt-3">
        <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Projects
        </div>
      </div>

      <nav className="p-3 pt-1 space-y-1">
        {projects.map(p => (
          <NavLink key={p.href} item={p} active={p.match(pathname)} />
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-100 p-3 space-y-1">
        <NavLink
          item={{
            href: '/settings',
            label: 'Settings',
            icon: SettingsIcon,
            match: p => p === '/settings' || p.startsWith('/settings/'),
          }}
          active={pathname === '/settings' || pathname.startsWith('/settings/')}
        />

        {/* Signed-in user — email truncated, sign-out as small action below */}
        {userEmail && (
          <div className="px-3 pt-2 pb-1 border-t border-slate-100 mt-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Signed in</div>
            <div
              className="text-xs text-slate-700 font-medium truncate"
              title={userEmail}
            >
              {userEmail}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="mt-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}
