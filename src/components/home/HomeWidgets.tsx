/**
 * HomeWidgets: the top block of the Home page: compact destination widgets
 * side by side (Tools & Dashboards, My Team, My Work). My Team is a placeholder
 * for now ("Soon" badge, not clickable), shown rather than hidden so the
 * direction is visible in-product. Server-rendered, no state.
 */

import Link from 'next/link'
import { loadAccess } from '@/lib/access/resolve'
import { surfaceForPath } from '@/lib/access/nav'

const icon = 'w-5 h-5'

const DashboardsIcon = (
  <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)
// People icon that plays a "2 → 3" split: the two figures slide apart while a
// third fades in between. The three groups render together (same commit) so
// they stay in phase. Motion guarded by .tn-anim (prefers-reduced-motion).
const TeamIcon = (
  <svg className={icon} style={{ overflow: 'visible' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <g className="tn-anim" style={{ animation: 'tn-split-left 3s ease-in-out infinite' }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </g>
    <g className="tn-anim" style={{ animation: 'tn-split-right 3s ease-in-out infinite' }}>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </g>
    <g style={{ transform: 'translateX(3px)' }}>
      <g className="tn-anim" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-appear 3s ease-in-out infinite' }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </g>
    </g>
  </svg>
)
const WorkIcon = (
  <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

interface Widget {
  title: string
  description: string
  icon: React.ReactNode
  href?: string //  absent = placeholder ("Soon")
  /**
   * The surface that gates it, when the route map cannot tell.
   *
   * My Team lives at /my-work?tab=team, and surfaceForPath matches on the
   * prefix, so it would gate this card with My Work's grant. Naming it here
   * is the difference between a card that respects its own permission and one
   * that offers a page the viewer will be turned away from.
   */
  surface?: string
  anim: string  //  looping icon micro-motion (guarded by prefers-reduced-motion)
}

const WIDGETS: Widget[] = [
  { title: 'My Work', description: 'Everything you’re working on across Monday.', icon: WorkIcon, href: '/my-work', anim: 'tn-ico-swing 3.4s ease-in-out infinite' },
  { title: 'My Team', description: 'Your team at a glance.', icon: TeamIcon, href: '/my-work?tab=team', surface: 'my-team', anim: '' }, // split animation lives inside TeamIcon
  { title: 'Tools & Dashboards', description: 'Dashboards and the tools used inside a project.', icon: DashboardsIcon, href: '/tools', anim: 'tn-ico-pulse 3s ease-in-out infinite' },
]

// Wraps the icon so the transform animates the glyph, not the chip. An empty
// `anim` (My Team) means the animation lives inside the icon's own SVG groups.
function AnimIcon({ anim, children }: { anim: string; children: React.ReactNode }) {
  return anim ? <span className="tn-anim inline-flex" style={{ animation: anim }}>{children}</span> : <>{children}</>
}

export async function HomeWidgets() {
  const { can } = await loadAccess()

  // A widget is a door. Showing one that bounces the viewer straight back Home
  // is worse than not showing it: the page guard holds either way, so all the
  // card can do is promise something and fail. The surface comes from the same
  // route map the sidebar uses, so a widget cannot drift from its page.
  // Placeholders (no href) have nothing to gate.
  const visible = WIDGETS.filter(w => {
    if (!w.href) return true
    const surface = w.surface ?? surfaceForPath(w.href)
    return surface ? can(surface) : true
  })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(w =>
        w.href ? (
          <Link
            key={w.title}
            href={w.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-tn-teal hover:shadow-md"
          >
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-tn-teal-soft text-tn-teal">
              <AnimIcon anim={w.anim}>{w.icon}</AnimIcon>
            </span>
            <h2 className="mt-3 text-sm font-extrabold text-tn-ink">{w.title}</h2>
            <p className="mt-0.5 text-xs text-muted leading-snug">{w.description}</p>
          </Link>
        ) : (
          <div
            key={w.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-5"
            aria-disabled="true"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <AnimIcon anim={w.anim}>{w.icon}</AnimIcon>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                Soon
              </span>
            </div>
            <h2 className="mt-3 text-sm font-extrabold text-slate-400">{w.title}</h2>
            <p className="mt-0.5 text-xs text-slate-400 leading-snug">{w.description}</p>
          </div>
        ),
      )}
    </div>
  )
}
