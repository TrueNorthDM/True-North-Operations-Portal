'use client'

/**
 * SettingsNav — the Settings surface as a sticky left sub-nav + content panel,
 * matching the handoff. Each section's content stays mounted (toggled with
 * `hidden`) so open edit forms / inner tab state survive switching sections.
 */

import { useState, type ReactNode } from 'react'

export interface SettingsSection {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

export function SettingsNav({ signedIn, sections }: { signedIn: { name: string; role: string }; sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr] gap-6 items-start">
      {/* sub-nav */}
      <nav className="flex flex-col gap-[3px] lg:sticky lg:top-[81px]">
        <div className="mb-5 px-[15px] py-3.5 border border-slate-200 rounded-[12px] bg-white">
          <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.09em] uppercase text-muted">Signed in as</div>
          <div className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink mt-1.5 truncate">{signedIn.name}</div>
          <div className="text-[11.5px] text-muted mt-px">{signedIn.role}</div>
        </div>
        {sections.map(s => {
          const on = active === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-[11px] w-full text-left rounded-[11px] px-[13px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-all ${
                on ? 'bg-tn-teal-soft text-tn-teal' : 'text-foreground hover:bg-subtle'
              }`}
            >
              <span className="inline-flex w-5 h-5 items-center justify-center shrink-0">{s.icon}</span>
              <span className="flex-1">{s.label}</span>
            </button>
          )
        })}
      </nav>

      {/* panel */}
      <section className="min-w-0">
        {sections.map(s => (
          <div key={s.id} className={active === s.id ? '' : 'hidden'}>{s.content}</div>
        ))}
      </section>
    </div>
  )
}
