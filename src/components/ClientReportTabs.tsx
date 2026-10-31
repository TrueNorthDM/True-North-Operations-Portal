// The tabs of Client Reports (navigation redesign, 22 September 2026): one tab
// per client report the person is granted, each still its own team grant
// (i7-budget, grant-pass-report). Drawn only when there is more than one; a
// person with one report just sees that report.

import Link from 'next/link'
import { ROUTES } from '@/lib/nav/routes'
import { TAB_LIST, tabClass } from '@/lib/ui/tabs'

const TABS = [
  { tool: 'i7-budget', label: 'i7', href: ROUTES.i7 },
  { tool: 'grant-pass-report', label: 'Project Hours & Others', href: ROUTES.projectHours },
] as const

/** The client reports this person may open, in tab order. */
export function clientReportTabs(canTool: (key: string) => boolean) {
  return TABS.filter(t => canTool(t.tool))
}

export function ClientReportTabs({ active, canTool }: { active: 'i7-budget' | 'grant-pass-report'; canTool: (key: string) => boolean }) {
  const tabs = clientReportTabs(canTool)
  if (tabs.length < 2) return null
  return (
    <nav aria-label="Client reports" className={TAB_LIST}>
      {tabs.map(t => (
        <Link
          key={t.tool}
          href={t.href}
          aria-current={t.tool === active ? 'page' : undefined}
          className={tabClass(t.tool === active)}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
