'use client'

/**
 * Generic UI primitives used by PageList — a CSS-only Tooltip, a click-outside
 * Popover (filter dropdowns), its PopoverItem, and a sortable SortHeader.
 * Split out of PageList (audit M6) so the list component keeps to its data +
 * table concerns; these are reusable leaves with no PageList state.
 */

import { useState, useEffect, useRef } from 'react'

export type SortDir = 'asc' | 'desc'

/**
 * Lightweight CSS-only tooltip. Appears instantly on hover (no 2s delay like
 * the native `title` attribute) and matches the app's visual language. Uses
 * `group-hover` + absolute positioning — no JS, no library.
 */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" aria-hidden="true" />
      </span>
    </span>
  )
}

/**
 * Generic popover used by the filter dropdowns.
 *
 * Why a custom component vs. native <select>? <select> doesn't support
 * multi-checkbox layouts and is impossible to style consistently across
 * browsers. The trade-off is we own the click-outside + escape-key
 * dismissal manually; the implementation below is the smallest correct
 * version that doesn't pull in a library.
 */
export function Popover({
  label,
  highlight,
  accentRing,
  children,
}: {
  label: React.ReactNode
  highlight: boolean
  accentRing: string
  children: (api: { close: () => void }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 ${accentRing} ${
          highlight
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

export function PopoverItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={`w-full text-left flex items-center px-3 py-2 text-sm hover:bg-slate-50 ${
          selected ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
        }`}
      >
        <span className={`w-4 mr-2 ${selected ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">✓</span>
        {children}
      </button>
    </li>
  )
}

/**
 * Sortable column header. Click cycles asc → desc → off.
 * The asc/desc arrow appears only on the active column; inactive
 * columns keep an outlined "↕" hint to communicate sortability.
 */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  const ariaSort = !active ? 'none' : dir === 'asc' ? 'ascending' : 'descending'
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-5 py-3 ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 group font-(family-name:--font-display) font-extrabold text-[11px] transition-colors ${
          active ? 'text-tn-ink' : 'text-tn-ink/70 hover:text-tn-ink'
        }`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] leading-none">
          {active ? (dir === 'asc' ? '↑' : '↓') : <span className="opacity-40 group-hover:opacity-70">↕</span>}
        </span>
      </button>
    </th>
  )
}
