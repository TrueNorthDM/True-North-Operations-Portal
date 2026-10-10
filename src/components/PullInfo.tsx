'use client'

// When a pull runs and when it last ran, in New York time on a 12-hour clock
// (audit, 10 October 2026). It used to list the times in the viewer's zone on
// a 24-hour clock and a relative "X ago", which needed a mount-time switch to
// avoid a hydration mismatch; ET is the same on the server and in the browser.

import { formatEt, formatEtTime } from '@/lib/format/et'

const minutesOf = (t: string) => {
  const m = /^(\d+):(\d+) (AM|PM)/.exec(t)
  if (!m) return 0
  return ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2]
}

/**
 * The cron's UTC hours as ET times, in the order of the ET day:
 * "1:00 AM, 5:00 AM, 9:00 AM, 1:00 PM, 5:00 PM and 9:00 PM ET".
 * `on` picks the day, so daylight saving moves the times as it should.
 */
export function etSchedule(utcHours: number[], utcMinute: number, on: Date = new Date()): string {
  const times = utcHours
    .map(h => formatEtTime(new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), h, utcMinute))).replace(/ ET$/, ''))
    .sort((a, b) => minutesOf(a) - minutesOf(b))
  if (!times.length) return ''
  const list = times.length > 1 ? `${times.slice(0, -1).join(', ')} and ${times.at(-1)}` : times[0]
  return `${list} ET`
}

interface Props {
  /** ISO timestamp of the last successful pull, or null if never. */
  syncedAt: string | null
  /** UTC hours the cron fires (e.g. [1,5,9,13,17,21]). */
  utcHours: number[]
  /** UTC minute the cron fires (e.g. 0 for Monday, 30 for TSheets). */
  utcMinute?: number
  /** Prefix, e.g. "Boards pulled" or "Clients & people synced". */
  label: string
  /** Past-tense verb for the last-run line, e.g. "pulled" or "synced". */
  pastVerb: string
  /** Wrapper classes, so a page can place the line in its own frame. */
  className?: string
}

/** Footer for an API card: the exact times data is pulled + when it last ran. */
const DEFAULT_WRAP = 'flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-100 pt-3'

export function PullInfo({ syncedAt, utcHours, utcMinute = 0, label, pastVerb, className = DEFAULT_WRAP }: Props) {
  const last = syncedAt ? `last ${pastVerb} ${formatEt(syncedAt)}` : `not ${pastVerb} yet`
  const text = `${label} at ${etSchedule(utcHours, utcMinute)} · ${last}`

  return (
    <div className={className}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v5l3 2" />
      </svg>
      <span>{text}</span>
    </div>
  )
}
