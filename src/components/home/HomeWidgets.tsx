/**
 * HomeWidgets — the top block of the Home page: five compact destination
 * widgets side by side (Dashboards, Projects, Tools, My Team, My Work).
 * My Team and My Work are placeholders for now ("Soon" badge, not clickable) —
 * shown rather than hidden so the direction is visible in-product.
 * Server-rendered, no state.
 */

const icon = 'w-5 h-5'

const DashboardsIcon = (
  <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)
const ToolsIcon = (
  <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
const TeamIcon = (
  <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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
}

const WIDGETS: Widget[] = [
  { title: 'Dashboards', description: 'Boards Review — pipeline & publishing goals.', icon: DashboardsIcon, href: '/dashboards' },
  { title: 'Tools', description: 'Capabilities used inside a project.', icon: ToolsIcon, href: '/tools' },
  { title: 'My Team', description: 'Your team at a glance.', icon: TeamIcon },
  { title: 'My Work', description: 'Everything you’re working on across Monday.', icon: WorkIcon },
]

export function HomeWidgets() {
  return (
    // Fixed-width cards centred as a group → equal space at both ends, the
    // cards keep their natural size instead of stretching to fill the row.
    <div className="flex flex-wrap justify-center gap-4">
      {WIDGETS.map(w =>
        w.href ? (
          <a
            key={w.title}
            href={w.href}
            className="group w-full sm:w-72 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md"
          >
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              {w.icon}
            </span>
            <h2 className="mt-3 text-sm font-bold text-slate-900">{w.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500 leading-snug">{w.description}</p>
          </a>
        ) : (
          <div
            key={w.title}
            className="w-full sm:w-72 rounded-xl border border-dashed border-slate-300 bg-white/50 p-4"
            aria-disabled="true"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                {w.icon}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                Soon
              </span>
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-400">{w.title}</h2>
            <p className="mt-0.5 text-xs text-slate-400 leading-snug">{w.description}</p>
          </div>
        ),
      )}
    </div>
  )
}
