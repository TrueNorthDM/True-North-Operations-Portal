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

interface Props {
  /** ISO timestamp of the last successful pull, or null if never. */
  syncedAt: string | null
  /** Human description of the schedule, e.g. "Pulled automatically every 4 hours". */
  schedule: string
}

/** Small footer for an API card showing how often + when data is pulled. */
export function PullInfo({ syncedAt, schedule }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-100 pt-3">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v5l3 2" />
      </svg>
      <span>
        {schedule}
        {syncedAt ? <> &middot; last pulled <span className="text-slate-500">{timeAgo(syncedAt)}</span></> : ' · not pulled yet'}
      </span>
    </div>
  )
}
