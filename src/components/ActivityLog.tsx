'use client'

/**
 * ActivityLog — collapsible feed of recent Monday webhook events for one site.
 *
 * Collapsed by default to keep the project page focused on its primary
 * job (managing pages). When something interesting happens (a recent
 * event in the last 5 minutes) we hint with a small green dot, so the
 * user knows it's worth expanding without forcing them to look.
 *
 * Receives pre-shaped rows from a Server Component — no API call from the
 * client. Refreshes naturally when the project page revalidates.
 */

import { useState, useEffect } from 'react'
import { summarizeResult, relativeTime, type ActivityTag } from '@/lib/activity'

export interface ActivityRow {
  id: string
  received_at: string
  monday_item_id: string | null
  /** Resolved from monday_item_id → page_urls.page_id → pages.name (in the Server query) */
  page_name: string | null
  /** Raw result string from monday_events */
  result: string | null
}

interface Props {
  rows: ActivityRow[]
}

/**
 * Visual style per tag. Same shape as the System / Monday / WordPress
 * badges in the dashboard's "How to do this" section — keeps the visual
 * grammar consistent: small uppercase pill with bg/text/border in the
 * same color family.
 */
const tagStyle: Record<ActivityTag, { label: string; className: string }> = {
  URL_RECEIVED: { label: 'URL received', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  APPLY_LINK:   { label: 'Apply Link',   className: 'bg-purple-50 text-purple-700 border-purple-200' },
  DONE:         { label: 'Done',         className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ALL_LIVE:     { label: 'All live',     className: 'bg-green-100 text-green-800 border-green-300' },
  DELETED:      { label: 'Deleted',      className: 'bg-red-50 text-red-700 border-red-200' },
  WARN:         { label: 'Warning',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ERROR:        { label: 'Error',        className: 'bg-red-50 text-red-700 border-red-200' },
}

export function ActivityLog({ rows }: Props) {
  const [open, setOpen] = useState(false)

  // "Fresh activity" = the newest row is < 5 minutes old. Draws attention to the
  // (collapsed) section. Computed in an effect because it reads the clock
  // (Date.now is impure in render, and it'd differ from the server on hydrate).
  const [hasFresh, setHasFresh] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasFresh(rows.length > 0 && Date.now() - new Date(rows[0].received_at).getTime() < 5 * 60 * 1000)
  }, [rows])

  return (
    <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="activity-log-list"
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg
            width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">Recent activity</span>
          {hasFresh && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              new
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {rows.length === 0 ? 'No events yet' : `${rows.length} recent ${rows.length === 1 ? 'event' : 'events'}`}
        </span>
      </button>

      {open && (
        <div id="activity-log-list" className="border-t border-slate-100">
          {rows.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-500 text-center">
              Nothing yet. Events will show up here when Monday sends a webhook for a Run Link or Done change.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map(row => {
                const summary = summarizeResult(row.result)
                const style = tagStyle[summary.tag]
                return (
                  <li key={row.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <span
                      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 mt-0.5 ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      {/* Body text uses slate-800 (same as page names in the
                          table) so the visual hierarchy stays consistent:
                          tag = category, text = content. */}
                      <div className="font-medium text-slate-800">
                        {summary.message}
                      </div>
                      {row.page_name && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate" title={row.page_name}>
                          {row.page_name}
                        </div>
                      )}
                    </div>
                    <time
                      dateTime={row.received_at}
                      title={new Date(row.received_at).toLocaleString()}
                      className="text-xs text-slate-400 shrink-0 tabular-nums mt-1"
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
