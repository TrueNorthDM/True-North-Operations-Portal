'use client'

/**
 * The Columns menu (owner, 25 October 2026): on Rates & Costs and the
 * Directory's tables each person ticks the columns they want, and the choice
 * is kept in their account (lib/settings/columns.ts). A tick applies at once
 * and saves in the background; a save that fails puts the columns back as
 * they were and says so beside the button. The fixed columns are listed,
 * ticked and greyed, "Always shown".
 *
 * useColumnChoices holds every table's choice of a page in one place, so a
 * tab that unmounts and comes back keeps what was ticked, and saves one at a
 * time, so they reach the server in the order they were made.
 */

import { useEffect, useRef, useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { hiddenFor, type HiddenColumns, type SaveHidden, type TableId } from '@/lib/settings/columns'

/** One table's choice: the keys hidden, how to change them, and the last save's error. */
export interface ColumnChoice {
  hidden: string[]
  onChange: (hidden: string[]) => void
  error: string | null
}

const NOT_SAVED = 'Columns not saved. Try again in a moment.'

/** Every table's choice for a page, started from what the server read. */
export function useColumnChoices(initial: HiddenColumns, save: SaveHidden): (table: TableId) => ColumnChoice {
  const [stored, setStored] = useState<HiddenColumns>(initial)
  const [errors, setErrors] = useState<Partial<Record<TableId, string>>>({})
  // What the server holds for each table (the last save that went through), to go back to.
  const confirmed = useRef<HiddenColumns>(initial)
  const latest = useRef<Partial<Record<TableId, number>>>({})
  const queue = useRef<Promise<void>>(Promise.resolve())

  function change(table: TableId, next: string[]) {
    setStored(s => ({ ...s, [table]: next }))
    setErrors(e => ({ ...e, [table]: undefined }))
    const seq = (latest.current[table] ?? 0) + 1
    latest.current[table] = seq
    queue.current = queue.current.then(async () => {
      let r: { ok: boolean; error?: string }
      try { r = await save(table, next) } catch { r = { ok: false, error: NOT_SAVED } }
      if (r.ok) { confirmed.current = { ...confirmed.current, [table]: next }; return }
      // Only the newest change puts the table back; an older one that failed is overtaken by it.
      if (latest.current[table] !== seq) return
      const before = confirmed.current[table]
      setStored(s => {
        const out = { ...s }
        if (before) out[table] = before
        else delete out[table]
        return out
      })
      setErrors(e => ({ ...e, [table]: r.error ?? NOT_SAVED }))
    })
  }

  return table => ({ hidden: hiddenFor(stored, table), onChange: next => change(table, next), error: errors[table] ?? null })
}

/** The choice a table was given, or one kept only on this screen (design checks, previews). */
export function useColumnChoice(table: TableId, given?: ColumnChoice): ColumnChoice {
  const [local, setLocal] = useState<string[]>(() => hiddenFor({}, table))
  return given ?? { hidden: local, onChange: setLocal, error: null }
}

export function ColumnsMenu({ columns, fixed, choice, align = 'left' }: {
  /** The columns this table shows now, in its order. */
  columns: readonly { key: string; label: string }[]
  fixed: readonly string[]
  choice: ColumnChoice
  /** Which edge the menu lines up with: the button's left (the default) or right. */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const isFixed = (k: string) => fixed.includes(k)
  const shown = columns.filter(c => isFixed(c.key) || !choice.hidden.includes(c.key)).length
  const anyHidden = columns.some(c => !isFixed(c.key) && choice.hidden.includes(c.key))

  // A click outside or Escape closes it; Escape gives the focus back to the button.
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('mousedown', down)
    document.addEventListener('touchstart', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('touchstart', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  // Columns this table does not draw now (a hidden column of another view) stay as they were.
  function toggle(k: string) {
    choice.onChange(choice.hidden.includes(k) ? choice.hidden.filter(x => x !== k) : [...choice.hidden, k])
  }

  return (
    <div ref={box} className="relative inline-flex items-center gap-2">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[12.5px] rounded-full px-3.5 py-[7px] border transition-all ${
          open || anyHidden ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground hover:border-tn-teal hover:text-tn-teal'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>
        Columns
        <span className={`font-(family-name:--font-display) font-extrabold text-[11px] rounded-full px-[7px] py-px ${anyHidden ? 'text-tn-teal bg-white/70' : 'text-muted bg-subtle'}`}>{shown}</span>
      </button>
      {choice.error && !open && <span role="alert" className="text-[12px] text-[var(--bdg-red-fg)]">{choice.error}</span>}

      {open && (
        <div role="menu" aria-label="Show columns" className={`absolute top-[calc(100%+8px)] ${align === 'right' ? 'right-0' : 'left-0'} z-[31] w-[250px] max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-[13px] shadow-[0_24px_60px_-22px_rgba(1,35,88,.5)] p-2`}>
          <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-2">
            <span className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.07em] uppercase text-muted">Show columns</span>
            {anyHidden && (
              <button type="button" onClick={() => choice.onChange([])} className="font-(family-name:--font-display) font-extrabold text-[11.5px] text-tn-teal hover:underline">Show all</button>
            )}
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {columns.map(c => {
              const always = isFixed(c.key)
              const on = always || !choice.hidden.includes(c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  aria-disabled={always || undefined}
                  disabled={always}
                  onClick={() => toggle(c.key)}
                  className={`flex items-center gap-2.5 w-full p-2.5 rounded-[9px] text-left transition-colors ${always ? 'opacity-65 cursor-default' : 'hover:bg-subtle'}`}
                >
                  <span className={`shrink-0 w-[18px] h-[18px] rounded-md inline-flex items-center justify-center transition-all ${on ? 'bg-tn-teal text-white border border-tn-teal' : 'bg-transparent text-transparent border-[1.5px] border-slate-300'}`}>
                    {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                  </span>
                  <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink">{c.label}</span>
                  {always && <span className="ml-auto text-[10.5px] font-bold text-muted whitespace-nowrap">Always shown</span>}
                </button>
              )
            })}
          </div>
          {choice.error && <p role="alert" className="m-0 px-2.5 pt-1.5 pb-1 text-[12px] text-[var(--bdg-red-fg)]">{choice.error}</p>}
        </div>
      )}
    </div>
  )
}
