/**
 * How Clocky writes times, days, ranges, zones and jobs (SPEC section 3, "Copy
 * and format rules"): 12-hour times ("8:00 AM"), dates like "Oct 9, 2026",
 * short days like "Thu, Oct 15", ranges like "Oct 11 to 17", the zone
 * abbreviation where people from several zones meet ("2:15 PM EAT"), and a job
 * by its path ("2 - i7 Marketing › Web Dev") or short ("i7 › Web Dev").
 *
 * Built from the zone's parts rather than Intl's own "8:00 AM", which puts a
 * narrow no-break space before AM in current engines and so would not match
 * the copy the screens and the tests expect.
 *
 * Pure: the server writes notifications, toasts and history lines with it, and
 * the screens can import it too.
 */

import { MONTH_LONG, MONTH_SHORT } from '@/lib/format/months'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const PARTS = new Map<string, Intl.DateTimeFormat>()
function partsOf(at: Date, zone: string): Record<string, number> {
  let f = PARTS.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    PARTS.set(zone, f)
  }
  const out: Record<string, number> = {}
  for (const p of f.formatToParts(at)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  out.hour = out.hour % 24
  return out
}

const toDate = (t: Date | string): Date => (t instanceof Date ? t : new Date(t))

/** The calendar day an instant falls on in a zone, YYYY-MM-DD. */
export function localDate(t: Date | string, zone: string): string {
  const p = partsOf(toDate(t), zone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Minutes since local midnight, in a zone. */
export function localMinutes(t: Date | string, zone: string): number {
  const p = partsOf(toDate(t), zone)
  return p.hour * 60 + p.minute
}

/** A minute of the day as "8:00 AM". */
export function minutesLabel(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** "8:00 AM", in the zone given. */
export const timeLabel = (t: Date | string, zone: string): string => minutesLabel(localMinutes(t, zone))

/** "HH:MM" on a 24-hour clock in the zone: what the time pickers send back. */
export function hhmm(t: Date | string, zone: string): string {
  const m = localMinutes(t, zone)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const dayParts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

/** "Thu, Oct 15" */
export function dayLabel(iso: string): string {
  const p = dayParts(iso)
  return `${WEEKDAY_SHORT[p.w]}, ${MONTH_SHORT[p.m - 1]} ${p.d}`
}

/** "Oct 9, 2026" */
export function dateLabel(iso: string): string {
  const p = dayParts(iso)
  return `${MONTH_SHORT[p.m - 1]} ${p.d}, ${p.y}`
}

/** "Sunday, Oct 4, 2026": the pay period start as Company settings writes it. */
export function longDateLabel(iso: string): string {
  return `${WEEKDAY_LONG[dayParts(iso).w]}, ${dateLabel(iso)}`
}

/** "Wed": the week grid's day name. */
export const weekdayShort = (iso: string): string => WEEKDAY_SHORT[dayParts(iso).w]

/** "October" */
export const monthLong = (iso: string): string => MONTH_LONG[dayParts(iso).m - 1]

/** "October 2026" */
export const monthYear = (iso: string): string => `${monthLong(iso)} ${dayParts(iso).y}`

/** "Oct 15, 2026, 5:12 PM": when something happened, in a zone (history, approvals). */
export function stampLabel(t: Date | string, zone: string): string {
  return `${dateLabel(localDate(t, zone))}, ${timeLabel(t, zone)}`
}

/** "Oct 4 to 17", "Oct 25 to Nov 7": a range of days, no year. */
export function rangeLabel(from: string, to: string): string {
  const a = dayParts(from)
  const b = dayParts(to)
  return a.m === b.m && a.y === b.y
    ? `${MONTH_SHORT[a.m - 1]} ${a.d} to ${b.d}`
    : `${MONTH_SHORT[a.m - 1]} ${a.d} to ${MONTH_SHORT[b.m - 1]} ${b.d}`
}

/** "Oct 4 to 17, 2026" */
export const rangeLabelYear = (from: string, to: string): string => `${rangeLabel(from, to)}, ${dayParts(to).y}`

// ── Zones ──────────────────────────────────────────────────────────────────

/**
 * The zone's abbreviation at an instant: "EDT", "CDT", "PDT", "EAT", "CAT".
 * English in the United States names only American zones; for the others the
 * region's own English names them ("EAT" for Nairobi), else "GMT+3".
 */
const REGION_LOCALE: Record<string, string> = { Africa: 'en-KE', Europe: 'en-GB', Australia: 'en-AU', Asia: 'en-IN' }
export function zoneAbbr(zone: string, at: Date = new Date()): string {
  const name = (locale: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''
    } catch { return '' }
  }
  const us = name('en-US')
  if (us && !/^(GMT|UTC)/.test(us)) return us
  const regional = REGION_LOCALE[zone.split('/')[0]]
  const other = regional ? name(regional) : ''
  return other && !/^(GMT|UTC)/.test(other) ? other : us || zone
}

/** "2:15 PM EAT" when the person's zone is not the viewer's, else "2:15 PM". */
export function timeWithZone(t: Date | string, zone: string, viewerZone: string): string {
  const label = timeLabel(t, zone)
  return zone === viewerZone ? label : `${label} ${zoneAbbr(zone, toDate(t))}`
}

// ── Jobs ───────────────────────────────────────────────────────────────────

/** A job by its path: "2 - i7 Marketing › Web Dev". */
export const jobPath = (name: string, parentName: string | null): string =>
  parentName ? `${parentName} › ${name}` : name

/**
 * The short job of the top bar, the tab title and the panel's labels, as the
 * prototypes write it: "i7 › Web Dev", "TN › Administrative", "HFA", "DDI".
 */
export function shortJob(path: string): string {
  if (!path) return ''
  const [top, leaf] = path.split(' › ')
  if (!leaf) return top === 'Adventist Messengers/HFA' ? 'HFA' : top
  const root = top.replace(/^\d+\s*-\s*/, '')
  const short = /^i7\b/i.test(root) ? 'i7' : root === 'True North' ? 'TN' : root
  return `${short} › ${leaf}`
}

/**
 * The client a job belongs to, for "hours by client": its top folder without
 * the number ("1 - True North" is True North), and HFA for Adventist
 * Messengers/HFA, as the Time entries prototype groups them.
 */
export function clientOf(path: string): string {
  if (!path) return 'Other'
  const top = path.split(' › ')[0]
  if (top === 'Adventist Messengers/HFA') return 'HFA'
  if (top.startsWith('Rwanda')) return 'Rwanda'
  return top.replace(/^\d+\s*-\s*/, '')
}

/** "AO" */
export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase()
