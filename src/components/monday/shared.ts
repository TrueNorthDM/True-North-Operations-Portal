// What the work list and the priority editor both need, in one place (audit,
// 10 October 2026): each had its own copy of the count format, the "are we in
// the browser yet" hook and a date format, and the copies had started to
// differ.
//
// Days are New York days. The page works out today once on the server
// (my-work/page.tsx) and hands it down, so "late" and "due today" mean the same
// on every screen and in every time zone; todayIso is the same day for a
// caller that was not given one (a design check).

import { useSyncExternalStore } from 'react'
import { todayIso, WORK_ZONE } from '@/lib/monday/worklist/list-view'
import type { DueState } from './tokens'

export { WORK_ZONE }

/** Counts in the thousands, written the way the handoff writes them. */
export const n = (v: number) => v.toLocaleString('en-US')

// True in the browser, false while rendering on the server, without an effect:
// a time worked out from "now" is only written once the page is on the
// reader's side, so the server's render and the browser's agree.
const noSubscribe = () => () => {}
export function useIsClient() {
  return useSyncExternalStore(noSubscribe, () => true, () => false)
}

/** Today in New York, for a component that was not handed the page's day. */
export const workToday = (now = new Date()) => todayIso(now, WORK_ZONE)

/**
 * A calendar date, YYYY-MM-DD, as "Oct 9, 2026". A date and not a moment, so
 * no clock is involved.
 *
 * The year is padded to four digits by hand. Intl prints year 202 as "202",
 * dropping the very digit that shows the value is wrong: "Aug 21, 0202" reads
 * as a typo, "Aug 21, 202" reads as a year nobody recognises.
 */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const at = new Date(Date.UTC(2000, m - 1, d))
  at.setUTCFullYear(y)
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .replace(/\b\d{1,4}$/, String(y).padStart(4, '0'))
}

/** "1y 2m 3d" between two calendar days, from the earlier to the later; "today" when they are the same. */
export function span(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  let y = ty - fy
  let m = tm - fm
  let d = td - fd
  if (d < 0) {
    m--
    // The length of the month before `to`'s.
    d += new Date(Date.UTC(ty, tm - 1, 0)).getUTCDate()
  }
  if (m < 0) { y--; m += 12 }
  const parts = [y ? `${y}y` : '', m ? `${m}m` : '', d ? `${d}d` : ''].filter(Boolean)
  return parts.length ? parts.join(' ') : 'today'
}

/**
 * A deadline as the list shows it: the date, how long ago or how far off, and
 * which badge. `today` is New York's day, from the page.
 *
 * A suspect date is still written the way every other date is written. A year
 * of 0202 reads as a typo at a glance in "Aug 21, 0202"; as a raw 0202-08-21 it
 * reads as a different kind of value, and the point is that it is the same
 * kind with a digit missing.
 */
export function readDue(date: string, suspect: boolean, today: string): { date: string; time: string; state: DueState } {
  const shown = dateLabel(date)
  if (suspect) return { date: shown, time: '', state: 'odd' }
  const day = date.slice(0, 10)
  if (day < today) return { date: shown, time: span(day, today), state: 'late' }
  if (day === today) return { date: shown, time: '', state: 'today' }
  return { date: shown, time: `in ${span(today, day)}`, state: 'upcoming' }
}
