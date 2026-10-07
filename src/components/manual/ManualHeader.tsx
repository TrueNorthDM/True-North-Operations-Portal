// The System manual's title and its two tabs: "The portal" (what the portal is
// and how it is used, SystemManual) and "How it runs" (the server, the
// accounts, staging, backups, keys: HowItRuns). The tab is a search param so
// each is linkable and the page stays a server component.

import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export type ManualTab = 'portal' | 'runs'

const TABS: { key: ManualTab; label: string; href: string }[] = [
  { key: 'portal', label: 'The portal', href: '/admin/manual' },
  { key: 'runs', label: 'How it runs', href: '/admin/manual?tab=runs' },
]

const INTRO: Record<ManualTab, string> = {
  portal: 'How the Operations Portal is put together, every page, who can see what, and how Monday, WordPress and QuickBooks Time feed the numbers you see.',
  runs: 'Where the portal runs and how it is looked after: the server and its accounts, how a change travels through staging to production, the alerts, the backups, people, what to do when something breaks, and the keys.',
}

export function ManualHeader({ active, tabs = ['portal', 'runs'] }: { active: ManualTab; tabs?: readonly ManualTab[] }) {
  return (
    <div className="space-y-4">
      <div>
        <Breadcrumb parents={['/admin']} now="System manual" />
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">System manual</h1>
        <p className="mt-1.5 text-muted">{INTRO[active]}</p>
      </div>
      <nav aria-label="System manual" className="flex items-center gap-0.5 border-b border-[var(--panel-border)]">
        {TABS.filter(t => tabs.includes(t.key)).map(t => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? 'page' : undefined}
            className={`px-4 py-2.5 text-[13.5px] font-semibold -mb-px border-b-2 transition-colors ${
              t.key === active ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
