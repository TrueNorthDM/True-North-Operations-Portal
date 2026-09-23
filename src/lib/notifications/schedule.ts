/**
 * When a notification lands, in the company's calendar (New York, like
 * Clocky). Pure: the generators, the delivery and the tests share it.
 *
 * "As it happens" lands at once. "Daily summary" lands at the next 8:00 in New
 * York, which is 12:00 or 13:00 UTC depending on daylight saving, so the hour
 * is worked out from the zone rather than written down as an offset.
 */

import { DAILY_HOUR, DAILY_ZONE, type Timing } from './catalogue'

const DAY = 86_400_000

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: DAILY_ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

function zoneParts(d: Date): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PARTS.formatToParts(d)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out
}

/** How far New York's wall clock is from UTC at this instant, in ms (negative: behind). */
function zoneOffset(d: Date): number {
  const p = zoneParts(d)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000
}

/** The calendar day in New York, as YYYY-MM-DD. */
export function zoneDate(d: Date): string {
  const p = zoneParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10)
}

/** The Monday of the week a day falls in: the key for "once a week". */
export function weekOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(iso, -((dow + 6) % 7))
}

/** The instant a New York wall-clock hour happens on a given day. */
export function zoneTime(iso: string, hour: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour)
  // Twice: the first pass can land across a daylight-saving change from the
  // hour being asked for, the second settles on the right side of it.
  let t = guess - zoneOffset(new Date(guess))
  t = guess - zoneOffset(new Date(t))
  return new Date(t)
}

/** When a notification made now lands for someone who chose this timing. */
export function deliverAt(timing: Timing, now: Date): Date {
  if (timing === 'instant') return now
  const today = zoneDate(now)
  const at = zoneTime(today, DAILY_HOUR)
  return now < at ? at : zoneTime(addDays(today, 1), DAILY_HOUR)
}
