// Dashboards — landing page linking to the Boards Review dashboards.

import { NavCard } from '@/components/NavCard'

export default function DashboardsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboards</h1>
        <p className="mt-1 text-slate-500">Boards Review dashboards.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NavCard
          href="/boards-beta"
          title="Boards Review"
          description="Goals, Translation, and Targets — the native dashboard."
        />
        <NavCard
          href="/boards.html"
          title="Boards Review — Legacy"
          description="The original COE dashboard. Kept until cutover."
        />
      </div>
    </div>
  )
}
