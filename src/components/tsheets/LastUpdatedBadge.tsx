'use client'

/**
 * "Last updated 5 minutes ago", over three sources rather than one.
 *
 * Deliberately not the i7 report's "Last synced". That badge measures the
 * QuickBooks Time import, and on this report the import is one of three things
 * that can change a figure: somebody adding hours by hand and somebody entering
 * donations both move the page without moving a sync.
 *
 * What it says out loud is the newest of the three. What it says on hover is
 * which one moved, because "updated" without a source is the same vagueness in
 * a nicer word.
 */

import { useEffect, useState } from 'react'
import { sourceWording, type LastUpdated } from '@/lib/timeclock/last-updated'

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day !== 1 ? 's' : ''} ago`
}

export function LastUpdatedBadge({ status }: { status: LastUpdated }) {
  const [, setTick] = useState(0)
  // Re-render every minute so the relative label stays true.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const label = status.at ? `Last updated ${timeAgo(status.at)}` : 'Nothing recorded yet'
  const why = status.source
    ? `Newest of the imported hours, the hours added by hand and the money entered. This one: ${sourceWording(status.source)}.`
    : 'No hours, donations or prepaid recorded for these months yet.'

  // A failed import is worth its own colour: the figure below is still true, but
  // the imported half of it is older than the badge makes it look.
  const cls = status.importFailed
    ? 'border-amber-300 bg-amber-50 text-[#7a4e05]'
    : 'border-slate-200 text-slate-500'

  return (
    <span
      title={status.importFailed ? `${why} The last import attempt failed, so the imported hours are older than this.` : why}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${cls}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 14.652H7.977v4.992M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 14.652l3.181 3.182a8.25 8.25 0 0013.803-3.7" />
      </svg>
      {/* Only the prefixed form drops the capital, or the plain badge would
          read "last updated" mid-sentence with no sentence around it. */}
      <span>{status.importFailed ? `Import failed, ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label}</span>
    </span>
  )
}
