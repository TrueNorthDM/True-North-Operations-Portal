'use client'

/**
 * Where a person chooses which columns of My Work to see. Five are always on,
 * and say so. Split out of WorkList.tsx (audit, 10 October 2026).
 *
 * A popover the keyboard can use: opening it moves focus to the first column
 * that can be switched, Escape closes it, and focus goes back to the button.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { ALL_COLUMNS, toggleColumn, type ColumnDef, type ColumnKey } from '@/lib/monday/worklist/columns'
import { BTN_ICON } from '@/lib/ui/buttons'

export function ColumnsMenu({ visible, onChange, offered }: {
  visible: ColumnKey[]
  onChange: (v: ColumnKey[]) => void
  /** The columns this list can show at all: Team only while it follows a team's order. */
  offered: ColumnDef[]
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const hidden = offered.filter(c => !c.required && !visible.includes(c.key)).length

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('input:not([disabled]), button')?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border bg-white font-(family-name:--font-display) font-semibold text-[13px] transition-colors ${
          hidden ? 'border-tn-teal text-tn-teal' : 'border-[var(--panel-border)] text-muted hover:text-tn-ink'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></svg>
        {hidden ? `Columns · ${hidden} hidden` : 'Columns'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            id={panelId}
            role="group"
            aria-label="Columns"
            className="absolute right-0 mt-2 z-40 w-[240px] rounded-[12px] border border-[var(--panel-border)] bg-white p-2 shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)]"
          >
            <div className="px-2 pt-1 pb-2 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted" aria-hidden="true">Columns</div>
            {offered.map(c => (
              <label
                key={c.key}
                className={`flex items-center gap-2.5 px-2 py-[7px] rounded-[8px] text-[13px] ${c.required ? 'text-muted' : 'text-tn-ink cursor-pointer hover:bg-[var(--row-hover)]'}`}
              >
                <input
                  type="checkbox"
                  checked={c.required || visible.includes(c.key)}
                  disabled={c.required}
                  onChange={() => onChange(toggleColumn(visible, c.key))}
                  className="w-4 h-4 accent-[#1E7D7F]"
                />
                <span className="flex-1">{c.label}</span>
                {c.required && <span className="text-[11px] text-muted">always</span>}
              </label>
            ))}
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => onChange(ALL_COLUMNS)}
                className="w-full text-left px-2 pt-2.5 pb-1 mt-1 border-t border-[var(--row-rule)] text-[12.5px] font-semibold text-tn-teal hover:underline"
              >
                Show every column
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
