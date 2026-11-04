// The System manual's title and its two tabs: "The portal" (what the portal is
// and how it is used, SystemManual) and "How it runs" (the server, the
// accounts, staging, backups, keys: HowItRuns). The tab is a search param so
// each is linkable and the page stays a server component.

import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { TAB_LIST, tabClass } from '@/lib/ui/tabs'
import { PAGE_TITLE } from '@/lib/ui/type'

export type ManualTab = 'portal' | 'runs'

const TABS: { key: ManualTab; label: string; href: string }[] = [
  { key: 'portal', label: 'The portal', href: '/manual' },
  { key: 'runs', label: 'How it runs', href: '/manual?tab=runs' },
]

const INTRO: Record<ManualTab, string> = {
  portal: 'How the Operations Portal is put together, every page, who can see what, and how Monday, WordPress and QuickBooks Time feed the numbers you see.',
  runs: 'Where the portal runs and how it is looked after: the server and its accounts, how a change travels through staging to production, the alerts, the backups, people, what to do when something breaks, and the keys.',
}

export function ManualHeader({ active, tabs = ['portal', 'runs'] }: { active: ManualTab; tabs?: readonly ManualTab[] }) {
  return (
    <div className="space-y-4">
      <div>
        <Breadcrumb self="/manual" />
        <h1 className={PAGE_TITLE}>System manual</h1>
        <p className="mt-1.5 text-muted">{INTRO[active]}</p>
      </div>
      <nav aria-label="System manual" className={TAB_LIST}>
        {TABS.filter(t => tabs.includes(t.key)).map(t => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? 'page' : undefined}
            className={tabClass(t.key === active)}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
