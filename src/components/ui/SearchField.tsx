'use client'

/**
 * The one search box.
 *
 * Every search field in the portal clears with an × at its right edge, and with
 * Escape while the cursor is in it. That was true of exactly one of the eight
 * search boxes before this component existed, because each screen wrote its own
 * markup and the clear button is the kind of thing you only remember to add
 * when somebody asks. Adding it here means a new search box gets it by being a
 * search box, not by anybody remembering.
 *
 * Layout of the input is owned here (the padding has to leave room for the icon
 * on one side and the × on the other), which is why callers style the wrapper
 * for width and pass a focus ring rather than a full class string: two Tailwind
 * classes setting the same property would resolve by stylesheet order, not by
 * the order they are written in.
 *
 * type="text" and not type="search" on purpose: WebKit draws its own clear
 * button on a search input, so that would show two of them on Safari and one
 * everywhere else.
 */

import { useRef, type RefObject } from 'react'

/**
 * Two sizes only. `md` is a search bar on a page; `sm` is the filter that sits
 * at the top of a dropdown, where a full-height input would eat the menu.
 */
const SIZES = {
  md: {
    input: 'text-sm rounded-[11px] pl-[38px] pr-9 py-[11px] bg-white',
    icon: 'left-[13px]', iconSize: 16,
    clear: 'right-2 w-6 h-6', clearSize: 13,
  },
  sm: {
    input: 'text-[13px] rounded-[8px] pl-[30px] pr-7 py-1.5 bg-subtle',
    icon: 'left-[9px]', iconSize: 13,
    clear: 'right-1 w-5 h-5', clearSize: 11,
  },
} as const

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  focus = 'focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20',
  ariaLabel,
  autoFocus,
  size = 'md',
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Wrapper: width and flex behaviour, which only the caller knows. */
  className?: string
  /** Focus treatment, so a branded page can keep its own accent. */
  focus?: string
  ariaLabel?: string
  autoFocus?: boolean
  size?: keyof typeof SIZES
  /** For a caller that focuses the field itself, like a dropdown on open. */
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const own = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? own
  const sz = SIZES[size]

  const clear = () => {
    onChange('')
    ref.current?.focus()   // clearing is a step in searching, not the end of it
  }

  return (
    <div className={`relative ${className}`}>
      <svg
        width={sz.iconSize} height={sz.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        className={`absolute ${sz.icon} top-1/2 -translate-y-1/2 text-muted pointer-events-none`}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()   // otherwise Escape closes whatever dialog is around it
            e.stopPropagation()
            clear()
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        className={`w-full text-tn-ink border border-slate-200 placeholder-slate-400 focus:outline-none ${sz.input} ${focus}`}
      />

      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          title="Clear"
          className={`absolute ${sz.clear} top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-tn-ink hover:bg-slate-100 transition-colors`}
        >
          <svg width={sz.clearSize} height={sz.clearSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
