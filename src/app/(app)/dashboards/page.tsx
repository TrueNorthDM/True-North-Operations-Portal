// Dashboards — landing page linking to the Boards Review dashboards.

import { NavCard } from '@/components/NavCard'

// Line-chart icon (Publishing Goals) — pulses. Matches the handoff.
const ChartIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-pulse 3s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="m7 14 3-3 3 2 4-5" />
  </svg>
)
// Kanban/columns icon (Workload) — wiggles. Matches the handoff.
const ColumnsIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-wiggle 3.2s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18" />
  </svg>
)

export default function DashboardsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-tn-ink">Dashboards</h1>
        <p className="mt-1 text-muted">Boards Review dashboards.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NavCard
          href="/dashboards/publishing"
          title="Publishing Goals"
          description="Weekly publishing pace vs target — the live dashboard."
          icon={ChartIcon}
        />
        <NavCard
          href="/boards-beta"
          title="Workload"
          description="Native rewrite (Goals, Translation, Targets). Work in progress."
          icon={ColumnsIcon}
          soon
        />
      </div>
    </div>
  )
}
