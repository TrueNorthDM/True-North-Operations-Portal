/**
 * When a notification lands, in a calendar: the company's (New York, like
 * Clocky) unless a person chose their own time zone. Pure: the generators, the
 * delivery, the summary email and the tests share it.
 *
 * "As it happens" lands at once. "Daily summary" lands at the next 8:00 in the
 * person's zone (in New York that is 12:00 or 13:00 UTC depending on daylight
 * saving), so the hour is worked out from the zone rather than written down as
 * an offset.
 */

import { DAILY_HOUR, DAILY_ZONE, type Timing } from './catalogue'

const DAY = 86_400_000

const FORMATS = new Map<string, Intl.DateTimeFormat>()
function parts(zone: string): Intl.DateTimeFormat {
  let f = FORMATS.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    FORMATS.set(zone, f)
  }
  return f
}

/** A zone name the runtime knows. Anything else (a typo, an old name) is the company's. */
export function validZone(zone: string | null | undefined): string {
  if (!zone) return DAILY_ZONE
  try { parts(zone); return zone } catch { return DAILY_ZONE }
}

function zoneParts(d: Date, zone: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of parts(zone).formatToParts(d)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out
}

/** How far a zone's wall clock is from UTC at this instant, in ms (negative: behind). */
function zoneOffset(d: Date, zone: string): number {
  const p = zoneParts(d, zone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000
}

/** The calendar day in a zone (New York unless told), as YYYY-MM-DD. */
export function zoneDate(d: Date, zone: string = DAILY_ZONE): string {
  const p = zoneParts(d, zone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** The wall-clock hour in a zone, 0 to 23. */
export function zoneHour(d: Date, zone: string = DAILY_ZONE): number {
  return zoneParts(d, zone).hour
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

/** The instant a wall-clock hour happens on a given day in a zone. */
export function zoneTime(iso: string, hour: number, zone: string = DAILY_ZONE): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour)
  // Twice: the first pass can land across a daylight-saving change from the
  // hour being asked for, the second settles on the right side of it.
  let t = guess - zoneOffset(new Date(guess), zone)
  t = guess - zoneOffset(new Date(t), zone)
  return new Date(t)
}

/** When a notification made now lands for someone who chose this timing, in their zone, at their summary hour. */
export function deliverAt(timing: Timing, now: Date, zone: string = DAILY_ZONE, hour: number = DAILY_HOUR): Date {
  if (timing === 'instant') return now
  const today = zoneDate(now, zone)
  const at = zoneTime(today, hour, zone)
  return now < at ? at : zoneTime(addDays(today, 1), hour, zone)
}
