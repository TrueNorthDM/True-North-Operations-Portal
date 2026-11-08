import { PILL, pillTone } from '@/components/ui/Pill'
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
export const chip = `${PILL} align-top`

export const PRIORITY_CHIP: Record<string, string> = {
  high: pillTone('red'),
  medium: pillTone('gray'),
  // #66727f is 4.9:1 on white. It was #9aa7b6, 2.5:1, quiet enough to be
  // unreadable (audit, 10 October 2026).
  low: 'text-[#66727f]',
}

export type DueState = 'late' | 'today' | 'upcoming' | 'odd'

export const DUE_BADGE: Record<DueState, { label: string; className: string }> = {
  late: { label: 'Late', className: pillTone('red') },
  today: { label: 'Due today', className: pillTone('amber') },
  upcoming: { label: 'Upcoming', className: pillTone('blue') },
  odd: { label: 'Check date', className: pillTone('gray') },
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
