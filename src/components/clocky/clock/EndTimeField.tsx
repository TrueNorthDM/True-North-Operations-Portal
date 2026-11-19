'use client'

/**
 * The real end time after the clock stopped by itself (owner, 19 November
 * 2026): one field to type the time in, which is also a list of the times,
 * earliest first, with a quarter hour less or more on its two sides. A typed
 * time is rounded to the quarter hour when the field is left or Enter is
 * pressed (5:07 PM is 5:00 PM, 5:08 PM is 5:15 PM). The rules are
 * lib/timeclock/end-time.ts.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { clockLabel } from '@/lib/agenda/time'
import { choiceForTyped, stepChoice, type EndChoice } from '@/lib/timeclock/end-time'
import { formatDuration } from '@/lib/timeclock/rounding'
import { FOCUS, Icon } from './ClockParts'

const SIDE = `flex-none w-11 h-11 rounded-[10px] border border-[var(--panel-border)] bg-white text-tn-ink text-[20px] leading-none font-bold cursor-pointer flex items-center justify-center hover:bg-subtle disabled:opacity-40 disabled:cursor-default ${FOCUS}`

export function EndTimeField({ label, value, choices, startedAt, stoppedAt, disabled, onChange }: {
  /** "Real end time · Wed, Nov 18" */
  label: string
  /** The chosen time (one of `choices`). */
  value: string
  choices: readonly EndChoice[]
  /** When the clock started, for the hours each time makes. */
  startedAt: string
  /** When it stopped by itself, marked in the list. */
  stoppedAt: string
  disabled?: boolean
  onChange: (iso: string) => void
}) {
  const id = useId()
  const chosen = choices.find(c => c.iso === value) ?? null
  const shown = chosen ? clockLabel(chosen.minutes) : ''
  const [text, setText] = useState(shown)
  // The field follows the chosen time when it changes from outside the typing (the list, the two buttons).
  const [last, setLast] = useState(shown)
  if (last !== shown) { setLast(shown); setText(shown) }
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const worked = (iso: string) => formatDuration(Math.max(0, (Date.parse(iso) - Date.parse(startedAt)) / 1000))
  const first = choices[0], final = choices[choices.length - 1]
  const range = first && final ? `between ${clockLabel(first.minutes)} and ${clockLabel(final.minutes)}` : ''

  // The list opens on the chosen time, and closes on a click anywhere else.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const pick = (c: EndChoice | null) => {
    if (!c) return
    setError(null); setOpen(false)
    if (c.iso !== value) onChange(c.iso)
    else setText(clockLabel(c.minutes))
  }
  const commit = () => {
    if (text.trim() === shown) { setError(null); return }
    const c = choiceForTyped(text, choices, value)
    if (c) { pick(c); return }
    setError(text.trim() ? `Type a time ${range}, like 5:30 PM.` : `Type a time ${range}.`)
  }
  const at = choices.findIndex(c => c.iso === value)

  return (
    <div ref={box} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" className={SIDE} disabled={disabled || at <= 0} aria-label="15 minutes earlier" onClick={() => pick(stepChoice(choices, value, -1))}>&minus;</button>
        <div className="relative flex-1 min-w-0">
          <input id={id} type="text" inputMode="text" autoComplete="off" spellCheck={false} disabled={disabled}
            role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="none" aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint`}
            value={text} placeholder="5:30 PM"
            onChange={e => { setText(e.target.value); setError(null) }}
            onFocus={e => e.target.select()}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              else if (e.key === 'Escape') { setOpen(false); setText(shown); setError(null) }
              else if (e.key === 'ArrowDown') { e.preventDefault(); pick(stepChoice(choices, value, 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); pick(stepChoice(choices, value, -1)) }
            }}
            className={`w-full h-11 box-border rounded-[10px] border bg-white pl-3 pr-11 text-center font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink tabular-nums lining-nums ${error ? 'border-[#c8323d]' : 'border-[var(--panel-border)]'} ${FOCUS}`} />
          <button type="button" tabIndex={-1} disabled={disabled} aria-label={open ? 'Close the list of times' : 'Open the list of times'}
            // Kept from taking the focus, so opening the list does not read as leaving the field.
            onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}
            className="absolute right-1 top-1 w-9 h-9 rounded-[8px] border-0 bg-transparent cursor-pointer text-muted flex items-center justify-center hover:bg-subtle">
            <Icon d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} size={16} sw={2.2} />
          </button>
          {open && (
            <div ref={list} id={`${id}-list`} role="listbox" aria-label="Times" className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[264px] overflow-y-auto bg-white border border-[var(--panel-border)] rounded-[12px] shadow-[0_14px_34px_-14px_rgba(1,35,88,.4)] py-1">
              {choices.map(c => {
                const on = c.iso === value
                return (
                  <button key={c.iso} type="button" role="option" aria-selected={on}
                    onMouseDown={e => e.preventDefault()} onClick={() => pick(c)}
                    className={`w-full border-0 cursor-pointer flex items-center justify-between gap-3 px-3.5 py-2 text-left ${on ? 'bg-tn-teal-soft' : 'bg-transparent hover:bg-subtle'}`}>
                    <span className={`font-(family-name:--font-display) text-[13.5px] tabular-nums lining-nums ${on ? 'font-extrabold text-tn-ink' : 'font-bold text-foreground'}`}>{clockLabel(c.minutes)}</span>
                    <span className="text-[12px] text-muted tabular-nums lining-nums">{c.iso === stoppedAt ? `when it stopped · ${worked(c.iso)}` : `${worked(c.iso)} worked`}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button type="button" className={SIDE} disabled={disabled || at < 0 || at >= choices.length - 1} aria-label="15 minutes later" onClick={() => pick(stepChoice(choices, value, 1))}>+</button>
      </div>
      {error
        ? <p id={`${id}-hint`} role="alert" className="m-0 text-[12px] font-semibold text-[#c8323d] text-center">{error}</p>
        : <p id={`${id}-hint`} className="m-0 text-[12px] text-muted text-center tabular-nums lining-nums">{chosen ? `${worked(chosen.iso)} worked. ` : ''}Type a time or pick one: it rounds to 15 minutes.</p>}
    </div>
  )
}
