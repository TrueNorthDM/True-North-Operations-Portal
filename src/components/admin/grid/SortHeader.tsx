'use client'

// A column header that sorts on click (unsorted → asc → desc → unsorted). The
// arrow is faint until the column is the active sort, then it points the way.
// Drop-in for the plain <span> header labels the Directory tables already use.

import type { SortDir } from './types'

export function SortHeader({ label, active, dir, align, onClick }: {
  label: string
  active: boolean
  dir: SortDir | null
  align?: 'right'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-1 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase transition-colors ${
        align === 'right' ? 'justify-end' : 'justify-start'
      } ${active ? 'text-tn-teal' : 'text-muted hover:text-tn-ink'}`}
    >
      <span>{label}</span>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        className={`shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
      >
        {active && dir === 'desc' ? <path d="m6 9 6 6 6-6" /> : <path d="m18 15-6-6-6 6" />}
      </svg>
    </button>
  )
}
