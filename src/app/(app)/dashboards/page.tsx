// Dashboards — landing page linking to the Boards Review dashboards.

import { NavCard } from '@/components/NavCard'

const ChartIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 3v18h18" />
    <rect x="7" y="11" width="3" height="6" rx="0.5" />
    <rect x="12" y="7" width="3" height="10" rx="0.5" />
    <rect x="17" y="13" width="3" height="4" rx="0.5" />
  </svg>
)
const GridIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
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
          title="Workload — IN CONSTRUCTION"
          description="Native rewrite (Goals, Translation, Targets). Work in progress."
          icon={GridIcon}
        />
      </div>
    </div>
  )
}
