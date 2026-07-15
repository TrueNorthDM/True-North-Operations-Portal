'use client'

/**
 * SettingsNav — the Settings surface as a top action row (help + sync + change
 * history) over a sticky left sub-nav + content panel, matching the handoff.
 * Only the active section mounts. "Change history" is a top-right toggle, not a
 * nav item.
 */

import { useState, type ReactNode } from 'react'
import { EditingContext } from './settings/editing-context'
import { HistoryContext } from './settings/history-context'

export interface SettingsSection {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
  /** When false, the Edit button is hidden on this section (nothing to toggle). */
  editable?: boolean
}

const HISTORY = '__history__'

export function SettingsNav({
  signedIn,
  sections,
  historyContent,
}: {
  signedIn: { name: string; role: string }
  sections: SettingsSection[]
  historyContent?: ReactNode
}) {
  const [active, setActive] = useState(sections[0]?.id)
  const [beforeHistory, setBeforeHistory] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState(false)

  function toggleHistory() {
    if (active === HISTORY) setActive(beforeHistory ?? sections[0]?.id)
    else { setBeforeHistory(active); setActive(HISTORY) }
  }

  const activeSection = sections.find(s => s.id === active)
  const showEdit = active !== HISTORY && activeSection?.editable !== false

  return (
    <div className="space-y-6">
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

        {/* panel — only the active section mounts (like the previous tabbed
            settings), so inactive editors' heavy grids don't render up front. */}
        <section className="min-w-0">
          <HistoryContext.Provider value={{ isHistory: active === HISTORY, toggle: toggleHistory }}>
            <EditingContext.Provider value={editing}>
              {active === HISTORY ? historyContent : activeSection?.content}
            </EditingContext.Provider>
          </HistoryContext.Provider>

          {showEdit && (
            <div className="flex justify-end mt-6 pt-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditing(v => !v)}
                className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-[11px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-all shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] hover:-translate-y-px ${
                  editing ? 'bg-tn-teal text-white' : 'bg-tn-primary text-white'
                }`}
              >
                {editing ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                )}
                <span className="text-[#ffffff]">{editing ? 'Done' : 'Edit'}</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
