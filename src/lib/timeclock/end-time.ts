/**
 * The real end time of a clock that stopped by itself (owner, 19 November
 * 2026): the times to choose from, earliest first, and what a typed time
 * means. Every time is on the quarter hour, as everything the clock records:
 * 5:07 PM is 5:00 PM, 5:08 PM is 5:15 PM.
 *
 * The choices stay on the day the clock stopped: from a quarter hour after it
 * started to the end of that day (or now, if that is sooner). Before, the list
 * ran newest first up to the moment it was opened, so opened the next morning
 * it mixed two days with no day written, and "8:30 AM" appeared twice.
 *
 * Plain data only, so it is tested without a browser.
 */

import { localOf } from '@/lib/agenda/time'

export interface EndChoice { iso: string; minutes: number }

/** Earliest first, the stop's own day only, no time twice. */
export function endChoices(options: readonly string[], laterOptions: readonly string[], stoppedAt: string, zone: string): EndChoice[] {
  const day = localOf(Date.parse(stoppedAt), zone).date
  const seen = new Set<string>()
  return [...options, ...laterOptions, stoppedAt]
    .filter(iso => { if (seen.has(iso)) return false; seen.add(iso); return true })
    .map(iso => ({ iso, at: localOf(Date.parse(iso), zone) }))
    .filter(x => x.at.date === day)
    .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso))
    .map(x => ({ iso: x.iso, minutes: x.at.minutes }))
}

/** A minute of the day on the nearest quarter hour: 5:07 is 5:00, 5:08 is 5:15. */
export const roundQuarter = (minutes: number): number => Math.floor((minutes + 7.5) / 15) * 15

/**
 * A typed time as minutes of the day, before rounding: "5:07 pm", "5pm",
 * "517p", "17:07", "5.30", "5". `meridiem` is null when none was typed (and
 * the hour could be either), so the caller picks the half of the day that fits.
 */
export function parseTyped(text: string): { minutes: number; meridiem: 'am' | 'pm' | null } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, ':')
  const m = /^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/.exec(t.replace(/:(?=[ap])/g, ''))
  if (!m) return null
  const h = Number(m[1]), min = m[2] ? Number(m[2]) : 0
  if (min > 59) return null
  const half = m[3] ? (m[3].startsWith('a') ? 'am' as const : 'pm' as const) : null
  if (half) {
    if (h < 1 || h > 12) return null
    return { minutes: (h % 12 + (half === 'pm' ? 12 : 0)) * 60 + min, meridiem: half }
  }
  if (h > 23) return null
  // 13 to 23, and 0, say which half of the day by themselves.
  return { minutes: h * 60 + min, meridiem: h === 0 || h > 12 ? (h >= 12 ? 'pm' : 'am') : null }
}

/**
 * The choice a typed time means: rounded to the quarter hour, then found among
 * the choices. With no AM or PM typed, the half of the day that is on the list;
 * when both are, the one nearer the time already chosen. Null: not a time, or
 * not one of the choices.
 */
export function choiceForTyped(text: string, choices: readonly EndChoice[], current: string): EndChoice | null {
  const p = parseTyped(text)
  if (!p) return null
  const want = roundQuarter(p.minutes)
  const wanted = p.meridiem ? [want] : [want % 720, want % 720 + 720]
  const hits = choices.filter(c => wanted.includes(c.minutes))
  if (hits.length < 2) return hits[0] ?? null
  const at = Date.parse(current)
  return [...hits].sort((a, b) => Math.abs(Date.parse(a.iso) - at) - Math.abs(Date.parse(b.iso) - at))[0]
}

/** The choice a quarter hour before or after, or the same one at either end. */
export function stepChoice(choices: readonly EndChoice[], current: string, by: -1 | 1): EndChoice | null {
  const i = choices.findIndex(c => c.iso === current)
  if (i < 0) return choices[choices.length - 1] ?? null
  return choices[Math.min(choices.length - 1, Math.max(0, i + by))]
}
