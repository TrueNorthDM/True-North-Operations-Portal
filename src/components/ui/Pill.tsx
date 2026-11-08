/**
 * The one status pill (owner, 31 October 2026): 10.5px Raleway 800,
 * uppercase, fully rounded, on the badge tokens of globals.css (--bdg-*).
 * Five tones, each with one meaning:
 *
 *   green  approved, done, active
 *   amber  pending, waiting, a warning
 *   red    refused, failed, an error
 *   blue   new, information
 *   gray   draft, neutral, no state of its own
 *
 * North Time's old tone names (ok, warn, bad, neutral) still work, so its
 * pill (components/clocky/entries/ui.tsx) is this one re-exported.
 *
 * A pill whose colour is a category that carries meaning (a team, a Monday
 * status, a kind of item) keeps its colour: pass `colorClass` or `style`
 * instead of a tone and the shape stays the same. Count badges (numbers in
 * circles on tabs and the rail) are not pills.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { PillTone } from '@/lib/timeclock/clocky-types'

export type PillColor = 'green' | 'amber' | 'red' | 'blue' | 'gray'

/** The pill's shape and type, without a colour. */
export const PILL = 'inline-flex items-center rounded-full px-[9px] py-[3px] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.06em] uppercase leading-[normal] whitespace-nowrap'

/** Each tone's fill and text, on the badge tokens. */
export const PILL_TONE: Record<PillColor, string> = {
  green: 'bg-[var(--bdg-green-bg)] text-[var(--bdg-green-fg)]',
  amber: 'bg-[var(--bdg-orange-bg)] text-[var(--bdg-orange-fg)]',
  red: 'bg-[var(--bdg-red-bg)] text-[var(--bdg-red-fg)]',
  blue: 'bg-[var(--bdg-blue-bg)] text-[var(--bdg-blue-fg)]',
  gray: 'bg-[var(--bdg-slate-bg)] text-[var(--bdg-slate-fg)]',
}

/**
 * The tone names the status maps of North Time and Requests use, on the same
 * five: "neu" is gray, "navy" (on an invoice) is blue, and "teal" (approved)
 * is green.
 */
export type PillToneName = PillColor | PillTone | 'neu' | 'teal' | 'navy'
const ALIAS: Record<string, PillColor> = { ok: 'green', warn: 'amber', bad: 'red', neutral: 'gray', info: 'blue', neu: 'gray', teal: 'green', navy: 'blue' }

export function pillTone(tone: PillToneName): string {
  return PILL_TONE[ALIAS[tone] ?? (tone as PillColor)] ?? PILL_TONE.gray
}

/** The class of a pill in a tone, for a span that cannot be the component. */
export function pillClass(tone: PillToneName): string {
  return `${PILL} ${pillTone(tone)}`
}

export function Pill({ text, children, tone = 'gray', tip, colorClass, style, className = '' }: {
  /** The words; children work too. */
  text?: ReactNode
  children?: ReactNode
  tone?: PillToneName
  /** The hover text (title). */
  tip?: string
  /** A category colour in place of the tone (team, Monday status, item kind). */
  colorClass?: string
  style?: CSSProperties
  className?: string
  /** Kept for North Time's callers; the pill has one size now. */
  size?: 'sm' | 'md'
}) {
  const colour = colorClass ?? (style?.background || style?.backgroundColor ? '' : pillTone(tone))
  return (
    <span title={tip || undefined} style={style} className={`${PILL} ${colour} ${className}`.trim()}>
      {text ?? children}
    </span>
  )
}
