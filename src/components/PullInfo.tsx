'use client'

import { useEffect, useState } from 'react'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day !== 1 ? 's' : ''} ago`
}

// The cron runs in UTC; convert to the viewer's local timezone so the listed
// times mean something to whoever is looking.
function localSchedule(utcHours: number[], utcMinute: number): { times: string; tz: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  const times = utcHours
    .map(h => fmt.format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, utcMinute))))
    .sort()
    .join(', ')
  const tz = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(now)
    .find(p => p.type === 'timeZoneName')?.value ?? 'local'
  return { times, tz }
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
}

/** Footer for an API card: the exact times data is pulled + when it last ran. */
export function PullInfo({ syncedAt, utcHours, utcMinute = 0, label, pastVerb }: Props) {
  // Times/relative-time are timezone- and clock-dependent, so compute them only
  // after mount — otherwise the server (UTC) and client render differently and
  // React reports a hydration mismatch. The tick also refreshes "X ago".
  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    // Intentional: flip to client-computed text only after mount (avoids the
    // UTC-server vs local-client hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  let text: string
  if (!mounted) {
    text = `${label} every 4 hours`
  } else {
    const { times, tz } = localSchedule(utcHours, utcMinute)
    const last = syncedAt ? `last ${pastVerb} ${timeAgo(syncedAt)}` : `not ${pastVerb} yet`
    text = `${label} at ${times} (${tz}) · ${last}`
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-100 pt-3">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v5l3 2" />
      </svg>
      <span>{text}</span>
    </div>
  )
}
