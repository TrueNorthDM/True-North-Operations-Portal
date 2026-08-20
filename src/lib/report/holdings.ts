// What each person is holding: open steps for the next 30 days, split by board.
//
// The stacked bar is the only chart in the Report that carries two units at
// once, hours as length and boards as colour, so both rules are here where
// they can be tested rather than inside the markup.

/** Fixed, so the same board is the same colour on every screen. */
const BOARD_COLOURS: [RegExp, string][] = [
  [/\baaaf\b/i, '#A9C0DE'],
  [/\bhfa\b|hope for africa/i, '#2a5cab'],
  [/\bi7\b/i, '#012358'],
  [/team reports/i, '#F2C40A'],
]

export const BOARD_FALLBACK = '#94C4C5'

export function boardColour(boardName: string): string {
  return BOARD_COLOURS.find(([re]) => re.test(boardName))?.[1] ?? BOARD_FALLBACK
}

/**
 * Ink or white on top of a board colour, by luminance rather than by name.
 *
 * The handoff's own sample picks ink for AAAF and white for everything else,
 * which puts white on the #F2C40A of Team Reports: unreadable, and its own
 * prose says ink on the light boards. Measuring the colour means a board
 * added later cannot get an unreadable label by default.
 */
export function labelOn(background: string): '#012358' | '#ffffff' {
  const hex = background.replace('#', '')
  const to = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(to(0)) + 0.7152 * lin(to(2)) + 0.0722 * lin(to(4))
  return luminance > 0.45 ? '#012358' : '#ffffff'
}

export type Holding = {
  board: string
  steps: number
  /** Estimated hours, which is what the segment is sized by. */
  hours: number
}

export type PersonHoldings = {
  id: string
  name: string
  /** Team and typical week, the context the bar is read against. */
  role: string
  holdings: Holding[]
  /** Hours they have available over the horizon. */
  availableHours: number
}

export function totalSteps(h: PersonHoldings): number {
  return h.holdings.reduce((s, x) => s + x.steps, 0)
}

export function totalHours(h: PersonHoldings): number {
  return h.holdings.reduce((s, x) => s + x.hours, 0)
}

/**
 * Bar length as a share of the busiest person in the selection.
 *
 * One shared scale is the whole point: the longest bar is the busiest person.
 * Scaling each row to its own total would draw everybody the same length and
 * answer nothing.
 */
export function barWidth(person: PersonHoldings, busiest: number): number {
  return busiest > 0 ? (totalHours(person) / busiest) * 100 : 0
}

/** Steps, estimated hours, hours available: the two units tied together. */
export function holdingReadout(h: PersonHoldings): string {
  return `${totalSteps(h)} steps · ${totalHours(h)}h of ${h.availableHours}h`
}
