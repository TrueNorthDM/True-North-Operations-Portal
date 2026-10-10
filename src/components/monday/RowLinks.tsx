'use client'

/**
 * The two ways out of a row on My Work, and the symbols the list draws. Split
 * out of WorkList.tsx (audit, 10 October 2026), behaviour unchanged.
 */

import { useState } from 'react'

const TOOLTIP = 'absolute top-[calc(100%+8px)] left-0 z-20 whitespace-nowrap rounded-[8px] bg-tn-primary px-2.5 py-[7px] text-[12px] text-[#dfe8f5] shadow-[0_12px_26px_-14px_rgba(1,35,88,.6)]'
const SQUARE = 'inline-flex items-center justify-center w-7 h-7 rounded-[7px] bg-[var(--chip-neutral-bg)] text-tn-teal hover:bg-[rgba(30,125,127,.12)] transition-colors'

/**
 * The eye that opens the item in Monday, with the label written into the page.
 *
 * A chip rather than a bare icon, because at 17px on a busy row an outline of
 * an eye is easy to miss; the tinted square gives it an edge to find. The
 * label is a real element and not the title attribute, so it appears at once
 * instead of after the browser's own delay, and it can sit where the handoff
 * puts it.
 */
export function OpenInMonday({ href, label, showLabel = false }: {
  href: string
  label: string
  /** Design check only: hold the label open. */
  showLabel?: boolean
}) {
  const [over, setOver] = useState(showLabel)
  return (
    <span className="relative inline-flex">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        onFocus={() => setOver(true)}
        onBlur={() => setOver(false)}
        aria-label={`Open ${label} in Monday`}
        className={SQUARE}
      >
        <EyeIcon />
      </a>
      {over && <span role="tooltip" className={TOOLTIP}>Open in Monday</span>}
    </span>
  )
}

/**
 * The history of an item, beside the Monday link and drawn the same way, so the
 * two ways out of a row read as a pair.
 */
export function OpenHistory({ label, onOpen, showLabel = false }: {
  label: string
  onOpen: () => void
  /** Design check only: hold the label open. */
  showLabel?: boolean
}) {
  const [over, setOver] = useState(showLabel)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        onFocus={() => setOver(true)}
        onBlur={() => setOver(false)}
        aria-label={`Show the history of ${label}`}
        className={SQUARE}
      >
        <HistoryIcon />
      </button>
      {over && <span role="tooltip" className={TOOLTIP}>Show history</span>}
    </span>
  )
}

/** Three lines shortening: a list in an order. */
export function OrderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="stroke-tn-teal shrink-0">
      <path d="M4 6h16M4 12h10M4 18h6" />
    </svg>
  )
}

/** A clock turning back: the history of the item. */
export function HistoryIcon() {
  return (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 2.64-6.36" />
      <polyline points="3 4 3 9 8 9" />
      <polyline points="12 7.5 12 12 15 14" />
    </svg>
  )
}

/** The same eye the Href Links list uses for "open this". */
export function EyeIcon() {
  return (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
