'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'api' | 'tools'

interface Props {
  apiTab: ReactNode
  toolsTab: ReactNode
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'api', label: 'API & Monday Settings' },
  { key: 'tools', label: 'Tools & Projects' },
]

export function SettingsShell({ apiTab, toolsTab }: Props) {
  const [tab, setTab] = useState<Tab>('api')

  return (
    <div className="space-y-8">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted (toggled with `hidden`) so inner state —
          the Budget Usage Report's active sub-tab, open edit forms — survives
          switching between the two settings tabs. */}
      <div className={tab === 'api' ? '' : 'hidden'}>{apiTab}</div>
      <div className={tab === 'tools' ? '' : 'hidden'}>{toolsTab}</div>
    </div>
  )
}
