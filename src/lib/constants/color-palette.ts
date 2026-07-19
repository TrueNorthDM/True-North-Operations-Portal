// Team colour palette, the swatch set for the Teams-tab colour picker. Mirrors
// the palette used in the group's other portals (Clinica Sentido) so a colour
// chosen here reads the same across products. 21 hues, warm → cool; a team with
// no chosen colour falls back to DEFAULT_COLOR.

export const COLOR_PALETTE = [
  '#DC2626', '#B91C1C', '#F43F5E', '#EA580C', '#F97316', '#FB923C', '#92400E',
  '#78350F', '#CA8A04', '#FBBF24', '#84CC16', '#22C55E', '#047857', '#14B8A6',
  '#0891B2', '#3B82F6', '#1E40AF', '#6D5EF5', '#8B5CF6', '#C026D3', '#64748B',
] as const

export const DEFAULT_COLOR = '#6D5EF5'

// Readable ink/white for text drawn ON a swatch, via YIQ perceived brightness.
// Light swatches (yiq ≥ 160) get dark ink; dark swatches get white, used for
// the check mark on the selected colour.
export function textColorFor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 160 ? '#1E293B' : 'white'
}
