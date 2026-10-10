'use client'

/**
 * ActivityLog: the recent Monday events of one site, below its page list.
 *
 * Shown on each site's page so the SEO team sees a Run Link that failed
 * (audit, 10 October 2026, decided by Arnaldo the same day). It opens by
 * itself when something in it went wrong, and its header counts the lines
 * that need a look, so a failure is not hidden behind a closed section.
 *
 * Receives shaped rows from the server (lib/href-links/data.ts); it makes no
 * request of its own and is fresh whenever the page is.
 */

import { useState, useEffect, useMemo } from 'react'
import { summarizeResult, relativeTime, activityMoment, type ActivityTag } from '@/lib/activity'
import type { ActivityRow } from '@/lib/href-links/data'

interface Props {
  rows: ActivityRow[]
}

/**
 * Colour per tag. Same shape as the Monday / System / WordPress chips in the
 * overview's "How to do this": a small uppercase pill, one colour family.
 */
const tagStyle: Record<ActivityTag, { label: string; className: string }> = {
  URL_RECEIVED: { label: 'Link received', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  APPLY_LINK:   { label: 'Apply Link',    className: 'bg-purple-50 text-purple-700 border-purple-200' },
  DONE:         { label: 'Done',          className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ALL_LIVE:     { label: 'All live',      className: 'bg-green-100 text-green-800 border-green-300' },
  DELETED:      { label: 'Deleted',       className: 'bg-red-50 text-red-700 border-red-200' },
  WARN:         { label: 'Warning',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ERROR:        { label: 'Error',         className: 'bg-red-50 text-red-700 border-red-200' },
}

export function ActivityLog({ rows }: Props) {
  const summaries = useMemo(() => rows.map(r => summarizeResult(r.result)), [rows])
  const failures = summaries.filter(s => s.severity === 'error').length
  const warnings = summaries.filter(s => s.severity === 'warn').length

  // Open from the start when something failed: that is what the feed is for.
  const [open, setOpen] = useState(failures > 0)

  // "Fresh" = the newest line is under 5 minutes old. In an effect because it
  // reads the clock, which would differ between the server and the browser.
  const [hasFresh, setHasFresh] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasFresh(rows.length > 0 && Date.now() - new Date(rows[0].received_at).getTime() < 5 * 60 * 1000)
  }, [rows])

  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden" aria-labelledby="activity-log-title">
      {/* The heading holds the button (a heading cannot sit inside one). */}
      <h2 id="activity-log-title" className="m-0 text-sm font-semibold text-slate-700">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="activity-log-list"
          className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
        >
          <span className="flex items-center gap-3">
            <svg
              width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>Recent activity from Monday</span>
            {hasFresh && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                new
              </span>
            )}
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {rows.length === 0 ? 'None yet' : (
              <>
                {failures > 0 && <span className="font-bold text-red-700">{failures} failed · </span>}
                {warnings > 0 && <span className="font-semibold text-amber-700">{warnings} to check · </span>}
                {rows.length} recent {rows.length === 1 ? 'event' : 'events'}
              </>
            )}
          </span>
        </button>
      </h2>

      {open && (
        <div id="activity-log-list" className="border-t border-slate-100">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 text-center m-0">No activity from Monday yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                const summary = summaries[i]
                const style = tagStyle[summary.tag]
                return (
                  <li key={row.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <span
                      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 mt-0.5 ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      {/* Same ink as the page names in the list: the tag is
                          the category, this line is the content. */}
                      <div className="font-medium text-slate-800 break-words">{summary.message}</div>
                      {row.page_name && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate" title={row.page_name}>
                          {row.page_name}
                        </div>
                      )}
                    </div>
                    <time
                      dateTime={row.received_at}
                      title={activityMoment(row.received_at)}
                      className="text-xs text-slate-400 shrink-0 tabular-nums mt-1"
                      suppressHydrationWarning
                    >
                      {relativeTime(row.received_at)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
