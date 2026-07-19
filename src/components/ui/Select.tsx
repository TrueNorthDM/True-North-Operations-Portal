'use client'

/**
 * Select — the portal's custom dropdown, replacing native <select> everywhere.
 *
 * Why not a native <select>? Its option popup is drawn by the OS: it ignores our
 * fonts and follows the system light/dark appearance (a dark popup on a light
 * page). This one is ours end to end — white surface in light mode, dark in dark
 * (the app's tokens remap under .dark), and the brand display font throughout.
 *
 * The menu is portalled to <body> and positioned `fixed` from the trigger's rect,
 * so it floats above everything and is never clipped inside a scrolling modal —
 * the one thing the native control did for free.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption { value: string; label: string; disabled?: boolean }

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  fullWidth = false,
  mutePlaceholder = true,
  ariaLabel,
  disabled = false,
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  fullWidth?: boolean
  /** Show the placeholder in muted colour (off for CTA-style pickers). */
  mutePlaceholder?: boolean
  ariaLabel?: string
  disabled?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Clamp within the viewport so a wide menu never spills off the right edge.
      const left = Math.min(r.left, window.innerWidth - r.width - 8)
      setPos({ top: r.bottom + 6, left: Math.max(8, left), width: r.width })
    }
    place()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const menu = open && pos
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
          className="z-[9999] w-max max-w-[min(84vw,360px)] max-h-72 overflow-auto bg-white border border-slate-200 rounded-[11px] shadow-[0_20px_44px_-18px_rgba(1,35,88,.5)] p-1.5"
        >
          {options.map(o => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false) } }}
                className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-[8px] font-(family-name:--font-display) font-semibold text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  active ? 'bg-tn-teal-soft text-tn-teal' : 'text-foreground hover:bg-subtle'
                }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body,
      )
    : null

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        className={`${fullWidth ? 'w-full ' : ''}inline-flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${selected ? '' : mutePlaceholder ? 'text-muted' : ''}`}>{selected ? selected.label : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {menu}
    </div>
  )
}
