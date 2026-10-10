/**
 * The colour of a language chip in Href Links: the language's flag colour
 * (lib/language-display.ts) with words dark or white, whichever reads on it.
 *
 * One place for it (audit, 10 October 2026): the page list and the page
 * detail each kept their own copy of the flag table, for four languages only,
 * so a fifth language got a grey chip in one and a coloured one nowhere.
 * Literal colours, the same in light and dark, like the handoff.
 */

import { languageDot } from '@/lib/language-display'

export function langChipStyle(code: string): { backgroundColor: string; color: string } {
  const bg = languageDot(code)
  const [r, g, b] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16))
  // Perceived brightness: a light flag (Spanish yellow) takes the navy ink.
  const light = (r * 299 + g * 587 + b * 114) / 1000 > 160
  return { backgroundColor: bg, color: light ? '#012358' : '#ffffff' }
}
