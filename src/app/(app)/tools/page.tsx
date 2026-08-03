// Tools & Dashboards, the unified hub. Two sections: the Boards Review
// dashboards, and the capabilities (tools) used inside a project. The former
// /dashboards landing redirects here; its sub-pages keep their own paths.

import { NavCard } from '@/components/NavCard'
import { requireSurface } from '@/lib/access/resolve'

// Line-chart (Publishing Goals), pulses.
const ChartIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-pulse 3s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="m7 14 3-3 3 2 4-5" />
  </svg>
)
// Kanban/columns (Workload), wiggles.
const ColumnsIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-wiggle 3.2s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18" />
  </svg>
)
// Wrench (Href Link Management), wiggles.
const LinkMgmtIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-wiggle 3.4s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
// Budget / dollar-in-circle (i7 report), pulses.
const BudgetIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-pulse 3s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.4A3.2 3.2 0 0 0 12 7.7c-1.7 0-3 1-3 2.3 0 3.2 6 1.6 6 4.8 0 1.4-1.4 2.5-3 2.5a3.3 3.3 0 0 1-3-1.7" />
    <path d="M12 6.1v1.6M12 16.3v1.6" />
  </svg>
)

export default async function ToolsPage() {
  const access = await requireSurface('tools')

  // Which cards appear is per-team (Directory → Teams → Tool access); the keys
  // are the catalogue's (lib/access/tools.ts).
  const dashboards = [
    access.canTool('publishing') && (
      <NavCard
        key="publishing"
        href="/dashboards/publishing"
        title="Publishing Goals"
        description="Weekly publishing pace vs target, the live dashboard."
        icon={ChartIcon}
      />
    ),
    access.canTool('workload') && (
      <NavCard
        key="workload"
        href="/boards-beta"
        title="Workload"
        description="Native rewrite (Goals, Translation, Targets). Work in progress."
        icon={ColumnsIcon}
        soon
      />
    ),
  ].filter(Boolean)

  const tools = [
    access.canTool('href-links') && (
      <NavCard
        key="href-links"
        href="/projects"
        icon={LinkMgmtIcon}
        title="Href Link Management"
        description="Manage hreflang tags for a project's WordPress pages. Open a project (AAAF or HFA) to use it."
      />
    ),
    access.canTool('i7-budget') && (
      <NavCard
        key="i7-budget"
        href="/tools/time-report"
        icon={BudgetIcon}
        title="Clients Reports"
        description="Hours, cost and budget usage per client. Includes the i7 Marketing report, with more clients coming."
      />
    ),
  ].filter(Boolean)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-tn-ink">Tools &amp; Dashboards</h1>
        <p className="mt-1 text-muted">Boards Review dashboards and the capabilities you use inside a project.</p>
      </div>

      {dashboards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Dashboards</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{dashboards}</div>
        </section>
      )}

      {tools.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Tools</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{tools}</div>
        </section>
      )}

      {dashboards.length === 0 && tools.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-tn-ink m-0">No tools yet</p>
          <p className="mt-1.5 text-sm text-muted m-0">
            Tools are granted per team. Ask an admin to add yours on the Directory&apos;s Teams tab.
          </p>
        </div>
      )}
    </div>
  )
}
