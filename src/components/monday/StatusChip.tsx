import { chip } from './tokens'

/**
 * A status badge in Monday's own colour, white on the label's hex, which is
 * how Monday paints it. Grey only when a step has no status column paired.
 */
export function StatusChip({ text, colour }: { text: string; colour: string | null }) {
  if (!colour) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>{text}</span>
  return <span className={`${chip} text-white`} style={{ background: colour }}>{text}</span>
}
