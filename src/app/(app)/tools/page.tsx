// Tools & Dashboards, the unified hub. Two sections: the Boards Review
// dashboards, and the capabilities (tools) used inside a project. The former
// /dashboards landing redirects here; its sub-pages keep their own paths.

import { NavCard } from '@/components/NavCard'
import { requireSurface } from '@/lib/access/resolve'
import { TOOLS } from '@/lib/access/tools'

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

// The card visuals live here (JSX cannot sit in the plain data module), keyed by
// the catalogue key. A tool with no icon still renders, just without one.
const ICONS: Record<string, React.ReactNode> = {
  publishing: ChartIcon,
  workload: ColumnsIcon,
  'href-links': LinkMgmtIcon,
  'i7-budget': BudgetIcon,
  // Same glyph: both are the same kind of thing, one per client.
  'grant-pass-report': BudgetIcon,
}

export default async function ToolsPage() {
  const access = await requireSurface('tools')

  // Rendered from the same catalogue the Teams tab grants from, so the two can
  // never list different tools. Which of them appear is per team (Directory →
  // Teams → Tool access).
  const visible = TOOLS.filter(t => access.canTool(t.key))
  const groups = (['Dashboards', 'Tools'] as const).map(group => ({
    group,
    items: visible.filter(t => t.group === group),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-tn-ink">Tools &amp; Dashboards</h1>
        <p className="mt-1 text-muted">Boards Review dashboards and the capabilities you use inside a project.</p>
      </div>

      {groups.map(({ group, items }) => (
        <section key={group} className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{group}</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {items.map(t => (
              <NavCard
                key={t.key}
                href={t.href}
                title={t.label}
                description={t.description}
                icon={ICONS[t.key]}
                soon={t.soon}
              />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
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
