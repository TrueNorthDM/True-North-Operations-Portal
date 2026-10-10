import { chip } from './tokens'

const INK = '#012358'

/** WCAG relative luminance of a #rrggbb colour, or null for anything else. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The text colour that reads on a label colour: white or the portal's ink,
 * whichever stands further from it (audit, 10 October 2026). White on every
 * label was 1.9:1 on Monday's orange "Working on it", the label seen most.
 */
export function textOn(colour: string): string {
  const bg = luminance(colour)
  const ink = luminance(INK)!
  if (bg === null) return '#ffffff'
  const onWhite = 1.05 / (bg + 0.05)
  const onInk = (bg + 0.05) / (ink + 0.05)
  return onInk > onWhite ? INK : '#ffffff'
}

/**
 * A status badge in Monday's own colour, with the text that reads on it.
 * Grey only when a step has no status column paired.
 */
export function StatusChip({ text, colour }: { text: string; colour: string | null }) {
  if (!colour) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>{text}</span>
  return <span className={chip} style={{ background: colour, color: textOn(colour) }}>{text}</span>
}
