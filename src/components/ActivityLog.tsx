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

import { useState } from 'react'
import { summarizeResult, relativeTime, type ActivitySeverity } from '@/lib/activity'

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

const dotClass: Record<ActivitySeverity, string> = {
  ok:    'bg-emerald-500',
  warn:  'bg-amber-500',
  error: 'bg-red-500',
}

const textClass: Record<ActivitySeverity, string> = {
  ok:    'text-emerald-700',
  warn:  'text-amber-700',
  error: 'text-red-700',
}

export function ActivityLog({ rows }: Props) {
  const [open, setOpen] = useState(false)

  // "Fresh activity" = anything in the last 5 minutes. Used to draw the
  // user's attention to the (collapsed) section so they know it's worth
  // opening without the section having to be open by default.
  const hasFresh = rows.length > 0 && (Date.now() - new Date(rows[0].received_at).getTime()) < 5 * 60 * 1000

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
                return (
                  <li key={row.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass[summary.severity]}`}
                      aria-label={summary.severity}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${textClass[summary.severity]}`}>
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
                      className="text-xs text-slate-400 shrink-0 tabular-nums"
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
