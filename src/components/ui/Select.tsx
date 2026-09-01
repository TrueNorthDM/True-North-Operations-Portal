'use client'

/**
 * Select: the portal's custom dropdown, replacing native <select> everywhere.
 *
 * Why not a native <select>? Its option popup is drawn by the OS: it ignores our
 * fonts and follows the system light/dark appearance (a dark popup on a light
 * page). This one is ours end to end, white surface in light mode, dark in dark
 * (the app's tokens remap under .dark), and the brand display font throughout.
 *
 * Options may carry a `group`, which draws a heading wherever the group changes.
 * The menu is portalled to <body> and positioned `fixed` from the trigger's rect,
 * so it floats above everything and is never clipped inside a scrolling modal,
 * the one thing the native control did for free.
 */

import { useEffect, useRef, useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /**
   * Heading this option sits under. Options are NOT reordered here: the caller
   * sorts them so that a group's members are adjacent, and a heading is drawn
   * wherever the group changes. Reordering in the component would make the
   * rendered order differ from the array the caller reasons about, and the
   * filter would then have to sort again on every keystroke.
   */
  group?: string
}

/** The menu's tallest and shortest useful heights, in pixels. */
const MAX_MENU_PX = 288
// Below this a menu is a scroll bar with a hint of content, and flipping to
// the roomier side is always better than honouring the preferred one.
const MIN_MENU_PX = 140

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
  searchable = false,
  id,
  defaultOpen = false,
  defaultQuery = '',
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
  /** Add a filter box at the top of the menu (for long lists like countries). */
  searchable?: boolean
  /** Design check only: render the menu already open. */
  defaultOpen?: boolean
  /** Design check only: render the menu's filter already typed into. */
  defaultQuery?: string
  id?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [query, setQuery] = useState(defaultQuery)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = options.find(o => o.value === value)
  const shown = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  // Focus the search box when a searchable menu opens. The query is cleared in
  // the trigger handler (on open), not here, to avoid setState inside an effect.
  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Clamp within the viewport so a wide menu never spills off the right edge.
      const left = Math.min(r.left, window.innerWidth - r.width - 8)

      // And off the bottom edge, which is the same mistake one axis over. A
      // control near the foot of a page opened a menu whose lower half was
      // unreachable: the page cannot scroll to it, because the menu is fixed
      // and moves with the trigger.
      const GAP = 6
      const EDGE = 8
      const below = window.innerHeight - r.bottom - GAP - EDGE
      const above = r.top - GAP - EDGE

      // Flip up only when it genuinely helps. A menu that jumps sides for two
      // extra pixels is harder to use than one that is slightly short.
      const flip = below < Math.min(MAX_MENU_PX, above) && above > below
      const space = Math.max(MIN_MENU_PX, Math.min(MAX_MENU_PX, flip ? above : below))

      setPos({
        top: flip ? Math.max(EDGE, r.top - GAP - space) : r.bottom + GAP,
        left: Math.max(8, left),
        width: r.width,
        maxHeight: space,
      })
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
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: pos.maxHeight }}
          className="z-[9999] w-max max-w-[min(84vw,360px)] overflow-auto bg-white border border-[var(--panel-border)] rounded-[11px] shadow-[0_20px_44px_-18px_rgba(1,35,88,.5)] p-1.5"
        >
          {searchable && (
            <div className="sticky top-0 -mx-1.5 -mt-1.5 mb-1.5 px-1.5 pt-1.5 pb-1 bg-white">
              {/* Escape clears the filter first and closes the menu on the
                  second press, which is how a combobox is expected to behave. */}
              <SearchField
                inputRef={searchRef}
                size="sm"
                value={query}
                onChange={setQuery}
                placeholder="Search…"
                focus="focus:border-tn-teal"
              />
            </div>
          )}
          {shown.length === 0 && <div className="px-2.5 py-2 text-[13px] text-muted">No matches</div>}
          {shown.map((o, i) => {
            const active = o.value === value
            // A heading wherever the group changes, filtering included: search
            // for "MKTG" and the headings still say which project each hit
            // belongs to, which is the whole reason they are there.
            const heading = o.group && o.group !== shown[i - 1]?.group ? o.group : null
            return (
              <div key={o.value}>
              {heading && (
                <div role="presentation" className="px-2.5 pt-2.5 pb-1 font-(family-name:--font-display) font-bold text-[10.5px] uppercase tracking-wider text-tn-teal">
                  {heading}
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={active}
                aria-label={o.group ? `${o.label}, ${o.group}` : undefined}
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
              </div>
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
        onClick={() => { if (!open) setQuery(''); setOpen(o => !o) }}
        className={`${fullWidth ? 'w-full ' : ''}inline-flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {/* A chosen value reads as ink and an unchosen one as muted, which is
            how the trigger says whether it is filtering anything. */}
        <span className={`truncate ${selected ? 'text-tn-ink' : mutePlaceholder ? 'text-muted' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {menu}
    </div>
  )
}
