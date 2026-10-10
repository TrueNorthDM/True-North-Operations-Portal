// The badge vocabulary of the work list.
//
// Its own module, with no 'use client', for two reasons. A server component
// cannot read a plain constant out of a client module: it gets a reference to
// it and the value arrives undefined, which is how the catalogue page failed
// first. And these are data, not components; keeping them beside the table
// only made the table the place everything had to be imported from.

/**
 * A badge: 20px line box, no vertical padding, so it sits on the text line
 * beside it rather than half a line below.
 */
export const chip =
  'inline-flex items-center align-top font-[family-name:var(--font-open-sans)] text-[10px] font-extrabold tracking-[.06em] uppercase px-2 leading-5 rounded-[5px]'

export const PRIORITY_CHIP: Record<string, string> = {
  high: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]',
  medium: 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]',
  // #66727f is 4.9:1 on white. It was #9aa7b6, 2.5:1, quiet enough to be
  // unreadable (audit, 10 October 2026).
  low: 'text-[#66727f]',
}

export type DueState = 'late' | 'today' | 'upcoming' | 'odd'

export const DUE_BADGE: Record<DueState, { label: string; className: string }> = {
  late: { label: 'Late', className: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]' },
  today: { label: 'Due today', className: 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]' },
  upcoming: { label: 'Upcoming', className: 'bg-[rgba(30,125,127,.12)] text-tn-teal' },
  odd: { label: 'Check date', className: 'bg-[var(--chip-neutral-bg)] text-muted' },
}

export const DUE_TIME: Record<DueState, string> = {
  late: 'text-[#c2410c] font-semibold',
  today: 'text-muted',
  upcoming: 'text-tn-teal font-semibold',
  odd: 'text-[var(--faint)]',
}

/** Monday's own label colours, as they arrive on a real board. */
export const STATUS_COLOURS: [string, string][] = [
  ['Working on it', '#FDAB3D'],
  ['Stuck', '#E2445C'],
  ['Waiting for review', '#579BFC'],
  ['Done', '#00C875'],
]
