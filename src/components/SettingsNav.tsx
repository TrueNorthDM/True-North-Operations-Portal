'use client'

/**
 * SettingsNav: Company settings (Admin > Configuration) as a sticky left
 * sub-nav and one content panel. Only the active section mounts. An Edit /
 * Done button under the panel turns its editors on and off.
 *
 * The open section follows the address's #hash (a deep link, the back and
 * forward buttons) until one is picked here.
 */

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { EditingContext } from './settings/editing-context'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

export interface SettingsSection {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
  /** When false, the Edit button is hidden on this section (nothing to toggle, or its own). */
  editable?: boolean
  /** A gold "New" tag beside the label (Timesheet periods, 16 October 2026). */
  isNew?: boolean
  /** A count waiting for someone, shown beside the label in place of "New" (North Time rollout, 27 October 2026). */
  badge?: { count: number; label: string }
}


export function SettingsNav({
  signedIn,
  sections,
  startSection = null,
}: {
  signedIn: { name: string; role: string }
  sections: SettingsSection[]
  /** Design check only: the section open at first. */
  startSection?: string | null
}) {
  const [editing, setEditing] = useState(false)
  // The hash read as an outside value (audit, 9 October 2026): copying it into
  // state in an effect drew the first section and then jumped to the linked
  // one, and missed back and forward. The server has no hash: '' there.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => '')
  // replaceState fires no event: the pick also re-renders, which reads the new hash.
  const [picked, setPicked] = useState<string | null>(startSection)
  const want = hash || picked
  const active = want && sections.some(s => s.id === want) ? want : sections[0]?.id

  function select(id: string) {
    history.replaceState(null, '', `#${id}`)
    setPicked(id)
  }

  const activeSection = sections.find(s => s.id === active)
  const showEdit = activeSection?.editable !== false

  return (
      <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr] gap-6 items-start">
        {/* sub-nav */}
        <nav className="flex flex-col gap-[3px] leading-[normal] lg:sticky lg:top-[81px]">
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
                aria-current={on ? 'page' : undefined}
                onClick={() => select(s.id)}
                className={`flex items-center gap-[11px] w-full text-left rounded-[11px] px-[13px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-all ${
                  on ? 'bg-tn-teal-soft text-tn-teal' : 'text-foreground hover:bg-subtle'
                }`}
              >
                <span className="inline-flex w-[17px] h-[17px] items-center justify-center shrink-0">{s.icon}</span>
                <span className="flex-1">{s.label}</span>
                {/* NEW marks a section not opened yet; the open one does not need it (Company Settings.dc.html). */}
                {s.badge && s.badge.count > 0
                  ? <span title={s.badge.label} aria-label={s.badge.label} className="font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink bg-[#F2C40A] rounded-full px-[7px] py-px tabular-nums lining-nums leading-[normal]">{s.badge.count}</span>
                  : s.isNew && !on && <span className="font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.06em] uppercase text-tn-ink bg-[#F2C40A] rounded-full px-[7px] py-0.5 leading-[normal]">New</span>}
              </button>
            )
          })}
        </nav>

        {/* panel, only the active section mounts (like the previous tabbed
            settings), so inactive editors' heavy grids don't render up front. */}
        <section className="min-w-0">
          <EditingContext.Provider value={editing}>
            {activeSection?.content}
          </EditingContext.Provider>

          {showEdit && (
            <div className="flex justify-end mt-6 pt-5 border-t border-slate-200">
              {/* The portal's two buttons: Edit is navy with a gold symbol;
                  Done, while editing, is white with a green one. */}
              <button type="button" aria-pressed={editing} onClick={() => setEditing(v => !v)} className={editing ? BTN.white : BTN.navy}>
                {editing ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                )}
                {editing ? 'Done' : <span className="text-[#ffffff]">Edit</span>}
              </button>
            </div>
          )}
        </section>
      </div>
  )
}

function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
