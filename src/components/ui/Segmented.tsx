'use client'

/**
 * A row of choices where one is picked (a radio group): "6:00 AM | 7:00 AM",
 * "As it happens | Daily summary". Keyboard as a radio group is: only the
 * picked one is in the Tab order, and the arrow keys move and pick (audit,
 * 9 October 2026). One control for the Settings page and the notification
 * table, which each had their own.
 *
 * Its look is the portal's one segmented look (owner, 31 October 2026), kept
 * in lib/ui/segmented.ts for the places that draw their own markup.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { SEG_ON, SEG_OFF } from '@/lib/ui/segmented'

export interface SegmentedOption<K> { key: K; label: string; glyph?: ReactNode }

export function Segmented<K extends string | number>({ options, value, onChange, label, disabled, disabledKeys, compact, warn, display }: {
  options: readonly SegmentedOption<K>[]
  /** Null: nothing picked yet (a required choice not made). */
  value: K | null
  onChange: (k: K) => void
  /** Names the group for a screen reader. */
  label: string
  disabled?: boolean
  /** Options shown but not pickable (Edit work's Hours limit: Per month for someone paid every 2 weeks, 9 November 2026). */
  disabledKeys?: readonly K[]
  /** The small one inside a table row (Rates & Costs' Timesheet column, 16 October 2026). */
  compact?: boolean
  /** An amber edge: a changed value not saved yet. */
  warn?: boolean
  /** Overrides the padding and size of the options ('px-3 py-1.5 text-[12.5px]').
   *  Left out everywhere since the 31 October 2026 sweep: every control is the
   *  same size now. */
  display?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step || disabled) return
    e.preventDefault()
    const at = Math.max(0, options.findIndex(o => o.key === value))
    let next = (at + step + options.length) % options.length
    for (let i = 0; i < options.length && disabledKeys?.includes(options[next].key); i++) next = (next + step + options.length) % options.length
    if (disabledKeys?.includes(options[next].key)) return
    onChange(options[next].key)
    box.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }
  return (
    <div ref={box} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKeyDown}
      className={`inline-flex items-center gap-0.5 bg-white border ${warn ? 'border-[#e9d48a]' : 'border-[var(--panel-border)]'} ${compact ? 'rounded-[9px] p-0.5' : 'rounded-[10px] p-[3px]'} flex-wrap ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {options.map(o => {
        const on = o.key === value
        const off = !!disabledKeys?.includes(o.key)
        return (
          <button key={String(o.key)} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled || off}
            onClick={() => onChange(o.key)}
            className={`${off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} inline-flex items-center gap-1.5 border-0 leading-[normal] font-(family-name:--font-display) font-bold whitespace-nowrap transition-colors ${compact ? 'rounded-[7px]' : 'rounded-[8px]'} ${display ?? (compact ? 'px-2.5 py-[5px] text-[12px]' : 'px-3.5 py-[7px] text-[12.5px]')} ${on ? SEG_ON : SEG_OFF}`}>
            {o.glyph}{o.label}
          </button>
        )
      })}
    </div>
  )
}
