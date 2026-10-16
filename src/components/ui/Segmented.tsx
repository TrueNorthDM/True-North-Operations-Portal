'use client'

/**
 * A row of choices where one is picked (a radio group): "6:00 AM | 7:00 AM",
 * "As it happens | Daily summary". Keyboard as a radio group is: only the
 * picked one is in the Tab order, and the arrow keys move and pick (audit,
 * 9 October 2026). One control for the Settings page and the notification
 * table, which each had their own.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface SegmentedOption<K> { key: K; label: string; glyph?: ReactNode }

export function Segmented<K extends string | number>({ options, value, onChange, label, disabled, compact, warn }: {
  options: readonly SegmentedOption<K>[]
  value: K
  onChange: (k: K) => void
  /** Names the group for a screen reader. */
  label: string
  disabled?: boolean
  /** The small one inside a table row (Rates & Costs' Timesheet column, 16 October 2026). */
  compact?: boolean
  /** An amber edge: a changed value not saved yet. */
  warn?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step || disabled) return
    e.preventDefault()
    const at = Math.max(0, options.findIndex(o => o.key === value))
    const next = (at + step + options.length) % options.length
    onChange(options[next].key)
    box.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }
  return (
    <div ref={box} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKeyDown}
      className={`inline-flex items-center gap-0.5 bg-white border ${warn ? 'border-[#e9d48a]' : 'border-[var(--panel-border)]'} ${compact ? 'rounded-[9px] p-0.5' : 'rounded-[10px] p-[3px]'} flex-wrap ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={String(o.key)} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled}
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] ${compact ? 'text-[12px]' : 'text-[12.5px]'} font-bold whitespace-nowrap transition-colors ${on ? 'bg-tn-primary text-[#ffffff]' : 'text-muted hover:text-tn-ink'}`}>
            {o.glyph}{o.label}
          </button>
        )
      })}
    </div>
  )
}
