// Home — the portal's launcher (top-level pillars) plus the company org chart,
// which lives permanently on the main page. Admin is reachable from the sidebar.

import { NavCard } from '@/components/NavCard'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'

export default async function HomePage() {
  const org = await getOrgChart()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">True North Operations Portal</h1>
        <p className="mt-1 text-slate-500">Where would you like to go?</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <NavCard
          href="/dashboards"
          title="Dashboards"
          description="Boards Review — editorial pipeline & weekly publishing goals."
        />
        <NavCard
          href="/projects"
          title="Projects"
          description="Your workspaces — AAAF & HFA."
        />
        <NavCard
          href="/tools"
          title="Tools"
          description="Capabilities you use inside a project, like Href Link Management."
        />
      </div>

      {/* Company org chart — permanent fixture of the home page. */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-slate-900">Organization</h2>
          {org.total > 0 && (
            <span className="text-xs text-slate-400">{org.total} people</span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
          <OrgChart roots={org.roots} />
        </div>
      </section>
    </div>
  )
}
