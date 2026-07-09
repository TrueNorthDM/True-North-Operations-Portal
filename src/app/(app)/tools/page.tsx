// Tools — hub of capabilities. Tools run inside a project (e.g. Href Link
// Management operates on a project's hreflang tags), so each one is entered by
// opening a project. More tools land here as the portal grows.

import { NavCard } from '@/components/NavCard'

// Wrench (Href Link Management) — wiggles. Matches the handoff.
const LinkMgmtIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-wiggle 3.4s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
// Budget / dollar-in-circle (i7 report) — pulses.
const BudgetIcon = (
  <svg className="tn-anim w-5 h-5" style={{ animation: 'tn-ico-pulse 3s ease-in-out infinite' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.4A3.2 3.2 0 0 0 12 7.7c-1.7 0-3 1-3 2.3 0 3.2 6 1.6 6 4.8 0 1.4-1.4 2.5-3 2.5a3.3 3.3 0 0 1-3-1.7" />
    <path d="M12 6.1v1.6M12 16.3v1.6" />
  </svg>
)

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-tn-ink">Tools</h1>
        <p className="mt-1 text-muted">Capabilities you use inside a project.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NavCard
          href="/projects"
          icon={LinkMgmtIcon}
          title="Href Link Management"
          description="Manage hreflang tags for a project's WordPress pages. Open a project (AAAF or HFA) to use it."
        />
        <NavCard
          href="/tools/time-report"
          icon={BudgetIcon}
          title="i7 Budget Usage Report"
          description="Hours, cost and budget usage for the i7 Marketing client — pulled live from QuickBooks Time."
        />
      </div>
    </div>
  )
}
