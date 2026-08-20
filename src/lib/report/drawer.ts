// The person drawer's two small rules.

/** How many deliveries the drawer shows before offering the rest. */
export const DRAWER_ROW_CAP = 50

export type Delivery = {
  id: string
  item: string
  step: string
  /** Days from the step landing on them to being marked done. */
  heldDays: number
  /** Days past the due date. 0 or null is on time; there is no bare boolean. */
  lateDays: number | null
}

export type LoggedHours = { project: string; hours: number }

export type PersonDetail = {
  deliveries: Delivery[]
  hours: LoggedHours[]
  /** Total deliveries in the period, which can exceed what is shown. */
  totalDeliveries: number
}

/**
 * The Landed chip.
 *
 * Late carries the overshoot in days rather than saying Late on its own. One
 * day late and three weeks late are different conversations, and a chip that
 * cannot tell them apart makes the reader open the item to find out.
 */
export function landed(lateDays: number | null): { label: string; late: boolean } {
  const n = lateDays ?? 0
  return n > 0 ? { label: `Late ${n}d`, late: true } : { label: 'On time', late: false }
}

/** Newest first, then capped: a fast translator over 90 days is hundreds of rows. */
export function visibleDeliveries(d: Delivery[]): { rows: Delivery[]; hidden: number } {
  return { rows: d.slice(0, DRAWER_ROW_CAP), hidden: Math.max(0, d.length - DRAWER_ROW_CAP) }
}

/** Bars share one scale, so the longest project is the biggest bar. */
export function hoursBar(h: LoggedHours, most: number): number {
  return most > 0 ? (h.hours / most) * 100 : 0
}
