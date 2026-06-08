'use client'

/** Tab nav between the two Boards Review views (beta). */

import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/boards-beta', label: 'Goals' },
  { href: '/boards-beta/translation', label: 'Translation' },
]

export function BoardsTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <a
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </div>
  )
}
