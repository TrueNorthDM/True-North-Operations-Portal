'use client'

/**
 * A time field you can type in or pick from (owner, 9 November 2026: the New
 * event drawer only offered the half hours of a list). Type "1:15 pm", "13:15"
 * or "9a" and press Enter or leave the field; or open the list and pick. A
 * time that cannot be read goes back to the last good one.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { clockLabel } from '@/lib/agenda/time'
import { parseTime } from '@/lib/ui/parse-time'

export interface TimeOption { value: number; label: string }

export function TimeField({ value, onChange, options, ariaLabel, className = '', allowMidnightEnd = false }: {
  /** Minutes after midnight; 1440 is midnight at the end of the day. */
  value: number
  onChange: (minutes: number) => void
  /** The times the list offers (the field also takes any typed minute). */
  options: readonly TimeOption[]
  ariaLabel: string
  /** The field's look: the same classes as a Select's button. */
  className?: string
  /** Read "12:00 AM" and "midnight" as the end of the day (a To field). */
  allowMidnightEnd?: boolean
}) {
  const labelOf = (m: number) => (m === 1440 ? '12:00 AM (midnight)' : clockLabel(m))
  // What is being typed; null shows the value, so a change from outside shows at once.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const text = draft ?? labelOf(value)

  const commit = (raw: string) => {
    const m = parseTime(raw, { allowMidnightEnd })
    setDraft(null)
    if (m != null && m !== value) onChange(m)
  }
  const close = () => { if (draft != null) commit(draft); setOpen(false) }
  const pick = (m: number) => { setDraft(null); setOpen(false); if (m !== value) onChange(m) }
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close })

  // The list opens on the current time.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) closeRef.current() }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])

  // While typing, the list narrows to the times that start like the text.
  const q = draft != null ? draft.trim().toLowerCase().replace(/\s+/g, '') : ''
  const shown = q ? options.filter(o => o.label.toLowerCase().replace(/\s+/g, '').startsWith(q)) : options

  return (
    <div ref={box} className="relative w-full">
      <input
        role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        value={text} inputMode="text" autoComplete="off" spellCheck={false}
        onFocus={e => { e.target.select(); setOpen(true) }}
        onClick={() => setOpen(true)}
        onChange={e => { setDraft(e.target.value); setOpen(true) }}
        onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node)) close() }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(text); setOpen(false) }
          else if (e.key === 'Escape') { setDraft(null); setOpen(false) }
        }}
        className={`${className} w-full text-left`} />
      {open && shown.length > 0 && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={ariaLabel}
          className="absolute z-50 left-0 right-0 mt-1 max-h-[260px] overflow-y-auto rounded-[12px] border border-[var(--panel-border)] bg-white py-1 shadow-[0_12px_30px_rgba(1,35,88,.14)]">
          {shown.map(o => (
            <li key={o.value} role="option" aria-selected={o.value === value} tabIndex={-1}
              onMouseDown={e => { e.preventDefault(); pick(o.value) }}
              className={`px-3.5 py-2 text-[14px] cursor-pointer tabular-nums ${o.value === value ? 'bg-tn-teal-soft text-tn-teal font-bold' : 'text-tn-ink hover:bg-subtle'}`}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
